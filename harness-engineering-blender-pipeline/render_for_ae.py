# SPDX-License-Identifier: GPL-3.0-or-later
#
# Copyright (c) 2026 doer
#
# This file is part of the Blender→AE committed pipeline. It calls the
# Blender Python API (`import bpy`); per Blender's GPL policy, code that
# uses bpy and is redistributed must be GPL-compatible. It is therefore
# distributed under the GNU General Public License v3.0 or later,
# SEPARATELY from the MIT-licensed harness-engineering resource pack.
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version. This program is distributed
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
# General Public License for more details (see ./LICENSE).

"""Committed Blender headless render script for /bl-render-to-ae (Axis C, Phase 3).
/bl-render-to-ae 的 Blender 侧 committed 无头渲染脚本（Axis C，Phase 3）。

EXECUTION MODEL (differs from Phase beta Axis A on purpose):
执行模型（刻意区别于 Phase β Axis A）:
  Axis A export runs INSIDE the GUI Blender via the 19876 socket bridge.
  Axis C render is spawned by the WSL orchestrator as a FRESH, INDEPENDENT
  `blender.exe -b <scene>.blend -P render_for_ae.py -- <render_json>` process
  (subprocess.Popen, detached). It NEVER touches the 19876 bridge, so it is
  non-blocking BY CONSTRUCTION (plan D4 / R1 - the bridge is not involved).
  A fresh interpreter every run also means there is NO module-cache bug
  (plan v0.9.2 finding #3), so this script is self-contained (inlines its own
  convert_path, mirroring blender_to_ae_export.py's own copy) and needs NO
  module-reload workaround and NO project sys.path manipulation.
  Axis A 导出在 GUI Blender 内经 19876 桥接执行；Axis C 渲染由 WSL 编排器
  spawn 一个全新独立 blender.exe -b 进程（Popen 分离），永不碰 19876 桥接，
  故按构造即非阻塞（plan D4/R1）。每轮全新解释器 -> 无模块缓存 bug -> 本
  脚本自包含（内联自己的 convert_path），无需 reload / 无需改 sys.path。

DESIGN DECISIONS embodied here (docs/guides/blender-ae-integration-plan.md):
  D1  per-AOV SINGLE-LAYER linear EXR sequences. NEVER OPEN_EXR_MULTILAYER via
      File Output node - that breaks AE import + slows AE to a standstill,
      reproduced Blender 4.1-4.5 + Epic + Adobe Community (L3, 2026-05 research).
      Beauty/combined goes through scene.render (single-layer OPEN_EXR); extra
      passes get one CompositorNodeOutputFile EACH (plain OPEN_EXR, separate
      files - not one multilayer node).
  D1  OCIO: the orchestrator OWNS the colour decision; this script only applies
      what render.json carries (view_transform). Scene-linear EXR default.
  D3  Cryptomatte PRE-EXTRACT (Cycles-only). EEVEE Next Cryptomatte support is
      incomplete (L3 research) -> when engine != CYCLES the crypto block is a
      scaffold and is SKIPPED with an honest flag, never silently claimed.
  D4  non-blocking spawn - see EXECUTION MODEL above.
  D6  Blender 4.5 LTS baseline.

NOTHING here asserts success on its own. main() prints RENDER_RESULT=<json>
with OBJECTIVE artifact facts (engine readback, frame count actually written,
output paths) so the orchestrator verifies the artifact, not a success flag
(memory feedback_bridge_exec_success_not_verification).
本脚本不自证成功。main() 打印 RENDER_RESULT=<json> 含客观产物事实（引擎
回读、实际写出帧数、输出路径），编排器据产物核验而非 success 标志。
"""

import glob
import json
import os
import sys

import bpy


def convert_path(p):
    """WSL path -> Windows path Blender can write (self-contained copy of the
    project convention, mirrors blender_to_ae_export.convert_path).
    WSL 路径 -> Blender 可写的 Windows 路径（项目惯例的自包含副本）。

    `/mnt/d/foo` -> `D:/foo`; non-/mnt/ prefix returned as-is (already Win/rel).
    """
    if p.startswith("/mnt/"):
        parts = p.split("/")
        if len(parts) >= 3:
            return f"{parts[2].upper()}:/" + "/".join(parts[3:])
    return p.replace("\\", "/")


def _argv_after_double_dash():
    """Blender passes script args after `--`; return them as a list.
    Blender 在 `--` 后传脚本参数；返回为列表。
    """
    if "--" in sys.argv:
        return sys.argv[sys.argv.index("--") + 1:]
    return []


def _read_render_json():
    """Read the per-run render params JSON. The path arg may be a WSL path
    (orchestrator wrote it) - convert to Windows since blender.exe is native.
    读取每轮渲染参数 JSON。路径参数可能是 WSL 路径 -> 转 Windows。
    """
    args = _argv_after_double_dash()
    if not args:
        raise RuntimeError("render_for_ae.py: no render.json path after '--'")
    win = convert_path(args[0])
    with open(win, "r", encoding="utf-8") as fh:
        return json.load(fh)


# Engine token -> bpy engine id. EEVEE Next is the fast-iteration engine for
# testing (user decision 2026-05-16); Cycles is the production / Cryptomatte
# engine. 引擎令牌 -> bpy 引擎 id。EEVEE Next = 测试快速迭代；Cycles = 生产/
# Cryptomatte。
_ENGINE_MAP = {
    "eevee": "BLENDER_EEVEE_NEXT",  # Blender 4.5 EEVEE Next
    "cycles": "CYCLES",
}


def _setup_render(scene, params):
    """Apply engine, colour management, single-layer linear EXR output and
    frame range from render.json onto the (already -b opened) scene.
    把 render.json 的引擎/色彩管理/单层线性 EXR 输出/帧范围应用到场景。
    """
    engine_token = (params.get("engine") or "cycles").lower()
    bpy_engine = _ENGINE_MAP.get(engine_token, "CYCLES")
    scene.render.engine = bpy_engine

    # Snapshot the scene's AUTHORED view transform + look BEFORE forcing Raw,
    # so the dual-output preview (Option 1, user decision 2026-05-17) bakes the
    # EXACT authored look (e.g. AgX + 'AgX - Very High Contrast') rather than a
    # hardcoded guess. The scene-linear EXR itself still goes out as Raw.
    # 在强制 Raw 前快照场景作者设定的 view transform + look，供双输出预览烘焙
    # 出与场景一致的外观（非硬编码）；scene-linear EXR 仍按 Raw 输出。
    orig_view_transform = getattr(scene.view_settings, "view_transform", "")
    orig_look = getattr(scene.view_settings, "look", "")

    # D1 OCIO: orchestrator-owned colour decision; default scene-linear EXR.
    # 'Raw' = no view transform baked -> scene-linear values preserved for AE
    # to interpret (2026-05 research consensus for scene-linear EXR->AE).
    # D1 OCIO：编排器拥有色彩决策；默认场景线性 EXR（'Raw' 不烘焙 view
    # transform，保留场景线性值供 AE 解释）。
    view_transform = params.get("view_transform") or "Raw"
    try:
        scene.view_settings.view_transform = view_transform
    except Exception as exc:  # noqa: BLE001 - surface, never silently pass
        print(f"WARN render_for_ae: view_transform '{view_transform}' "
              f"rejected ({exc!r}); leaving scene default")

    # D1: single-layer OPEN_EXR (NOT OPEN_EXR_MULTILAYER). The File Output
    # multilayer path is the documented AE-breakage trap - we deliberately use
    # the scene render format so beauty is a clean single-layer EXR sequence.
    # D1：单层 OPEN_EXR（非 multilayer）。multilayer File Output 是已记录的
    # AE 崩坏陷阱，故用场景渲染格式输出干净单层 EXR 序列。
    img = scene.render.image_settings
    img.file_format = "OPEN_EXR"
    img.color_mode = params.get("color_mode") or "RGBA"
    img.color_depth = str(params.get("color_depth") or "32")
    img.exr_codec = params.get("exr_codec") or "ZIP"

    out_dir_wsl = params["output_dir"]
    out_dir_win = convert_path(out_dir_wsl)
    # Trailing 'beauty_' -> Blender appends frame number -> beauty_0001.exr ...
    # 末尾 'beauty_' -> Blender 追加帧号 -> beauty_0001.exr ...
    base = params.get("basename") or "beauty_"
    scene.render.filepath = out_dir_win.rstrip("/") + "/" + base

    fs = params.get("frame_start")
    fe = params.get("frame_end")
    if fs is not None:
        scene.frame_start = int(fs)
    if fe is not None:
        scene.frame_end = int(fe)

    # Optional Cycles sample override - TEST-ONLY (orchestrator passes a low
    # value for fast L4 iteration). Omitted -> scene's own samples (production
    # fidelity untouched; same opinion-free philosophy as the EEVEE/frame test
    # params). 可选 Cycles 采样覆盖 - 仅测试（编排器传低值快迭代）；缺省 ->
    # 场景自身采样（生产保真不动，与 EEVEE/帧数测试参数同哲学）。
    samples_applied = None
    cy_samples = params.get("cycles_samples")
    if cy_samples is not None and scene.render.engine == "CYCLES":
        try:
            scene.cycles.samples = int(cy_samples)
            samples_applied = scene.cycles.samples
        except Exception as exc:  # noqa: BLE001 - surface, never silently pass
            print(f"WARN render_for_ae: cycles.samples override rejected ({exc!r})")

    return {
        "engine_requested": engine_token,
        "engine_applied": scene.render.engine,
        "view_transform": getattr(scene.view_settings, "view_transform", None),
        "orig_view_transform": orig_view_transform,
        "orig_look": orig_look,
        "exr": {"format": img.file_format, "depth": img.color_depth,
                "mode": img.color_mode, "codec": img.exr_codec},
        "cycles_samples": samples_applied,
        "filepath": scene.render.filepath,
        "frame_start": scene.frame_start,
        "frame_end": scene.frame_end,
        "out_dir_win": out_dir_win,
        "base": base,
    }


def _compositor_for_passes(scene, report):
    """Host a compositor tree for the extra-pass File Output nodes WITHOUT
    overriding the scene's AUTHORED beauty look (user decision 2026-05-17:
    respect scene.use_nodes - headless must NOT silently force-enable a
    compositor the user disabled).

    - use_nodes was True  -> user authored a compositor (e.g. phase0 GLARE)
      and WANTS it: leave the tree untouched, passes added additively.
      beauty = user's composited result.
    - use_nodes was False -> user disabled the compositor (wants a clean
      scene-linear plate; glow added later in AE / Axis B fusion). We must
      enable use_nodes to host the pass OutputFile, but the beauty MUST stay
      clean: wire Composite <- Render Layers.Image DIRECTLY so the saved
      GLARE chain does NOT reach Composite. Non-destructive: the user's glare
      nodes stay in the tree, just not fed into Composite.

    Returns (node_tree, render_layers_node). IDEMPOTENT across depth+crypto
    via memoization: main() calls this once per extra pass (crypto then
    depth). This function itself sets scene.use_nodes=True, so a naive 2nd
    call would re-read scene.use_nodes==True, mis-decide "respected user
    compositor", and OVERWRITE the first call's correct report (bug found
    2026-05-17: crypto+depth combined falsely reported authored_use_nodes
    =true while artifact stayed clean). Fix: the FIRST call records the
    user's AUTHORED value in report["compositor"]; later calls reuse it
    instead of re-reading the (already-mutated) scene.use_nodes.
    为额外 pass 的 File Output 启用 compositor，但不覆盖场景作者 beauty 外观
    （尊重 scene.use_nodes）。=True 原样不动；=False 时建干净直连
    Composite<-Render Layers（旁路 GLARE，非破坏保留节点），保 plate 干净。
    幂等靠 memoize：本函数会设 scene.use_nodes=True，故第二次调用必须复用
    首次记入 report 的用户真值，不可 re-read 被自己污染的 scene.use_nodes。
    """
    # Memoize the user's authored use_nodes on the FIRST call; reuse on
    # subsequent calls (do NOT re-read scene.use_nodes - this fn mutates it).
    _prior = report.get("compositor")
    if _prior is not None and "authored_use_nodes" in _prior:
        orig_use_nodes = bool(_prior["authored_use_nodes"])
    else:
        orig_use_nodes = bool(scene.use_nodes)
    scene.use_nodes = True
    nt = scene.node_tree

    rlayers = None
    for n in nt.nodes:
        if n.type == "R_LAYERS":
            rlayers = n
            break
    if rlayers is None:
        rlayers = nt.nodes.new("CompositorNodeRLayers")

    if orig_use_nodes:
        report["compositor"] = {
            "authored_use_nodes": True,
            "action": "respected user compositor as-is (beauty = user "
                      "composited result; e.g. GLARE kept)",
        }
        return nt, rlayers

    # User had the compositor OFF -> guarantee a CLEAN beauty plate. Re-feed
    # Composite directly from Render Layers' Image, bypassing (NOT deleting)
    # any saved GLARE chain. beauty == the use_nodes=False raw render.
    comp = None
    for n in nt.nodes:
        if n.type == "COMPOSITE":
            comp = n
            break
    if comp is None:
        comp = nt.nodes.new("CompositorNodeComposite")
    img_out = rlayers.outputs.get("Image")
    bypassed = False
    if img_out is not None:
        try:
            # New link to a single-input socket replaces the prior (glare) link
            nt.links.new(img_out, comp.inputs["Image"])
            bypassed = True
        except Exception as exc:  # noqa: BLE001 - surface, never silent
            report["compositor"] = {
                "authored_use_nodes": False, "clean_plate_preserved": False,
                "error": f"clean rewire failed: {exc!r}", "confidence": "L1"}
            return nt, rlayers
    report["compositor"] = {
        "authored_use_nodes": False,
        "clean_plate_preserved": bypassed,
        "action": "scene had use_nodes=False -> Composite re-fed directly "
                  "from Render Layers (saved GLARE bypassed, kept in tree); "
                  "beauty = clean scene-linear plate",
    }
    return nt, rlayers


def _setup_depth_pass(scene, params, report):
    """D1 (fusion prerequisite): emit the Z/Depth pass as a SEPARATE single-
    layer EXR sequence (NEVER multilayer File Output - that breaks AE; one
    CompositorNodeOutputFile fed from Render Layers' Depth socket). Beauty-
    path handling is delegated to _compositor_for_passes (respects
    scene.use_nodes: untouched if authored ON, clean Composite passthrough if
    authored OFF). This function only ADDS the depth OutputFile + one link;
    honest reporting - never silently claims a depth file.
    D1（融合前提）：Z/Depth 输出独立单层 EXR（绝不 multilayer）。beauty 链交
    _compositor_for_passes 处理（尊重 use_nodes）；本函数只加 depth 输出节点。
    """
    if not params.get("depth_pass"):
        report["depth"] = {"requested": False}
        return

    vl = scene.view_layers[scene.view_layers.keys()[0]]
    try:
        vl.use_pass_z = True
    except Exception as exc:  # noqa: BLE001
        report["depth"] = {"requested": True, "produced": False,
                           "error": f"use_pass_z failed: {exc!r}",
                           "confidence": "L1"}
        return

    nt, rlayers = _compositor_for_passes(scene, report)

    # Render Layers depth output socket: 'Depth' (Blender 4.x) with 'Z'
    # legacy fallback. If neither exists, report honestly - do NOT fabricate.
    # 深度输出 socket：'Depth'（4.x）/'Z'（旧）；都没有则诚实报错不臆造。
    depth_sock = rlayers.outputs.get("Depth") or rlayers.outputs.get("Z")
    if depth_sock is None:
        report["depth"] = {
            "requested": True, "produced": False,
            "error": "Render Layers node exposes no Depth/Z socket even "
                     "after use_pass_z=True (socket update timing?)",
            "confidence": "L1"}
        return

    out_dir_win = convert_path(params["output_dir"]).rstrip("/")
    fout = nt.nodes.new("CompositorNodeOutputFile")
    fout.base_path = out_dir_win + "/depth/"
    fout.format.file_format = "OPEN_EXR"   # single-layer, NOT multilayer (D1)
    fout.format.color_depth = "32"         # raw linear Z, AE remaps in-comp
    if fout.file_slots:
        fout.file_slots[0].path = "depth_"
    try:
        nt.links.new(depth_sock, fout.inputs[0])
    except Exception as exc:  # noqa: BLE001
        report["depth"] = {"requested": True, "produced": False,
                           "error": f"node link failed: {exc!r}",
                           "confidence": "L1"}
        return

    report["depth"] = {
        "requested": True, "produced": True,
        "depth_dir": out_dir_win + "/depth/",
        "socket": depth_sock.name,
        "confidence": "L1-untested-this-session",
    }
    # NOTE: the optional 0-1 normalized depth_preview pass (DG2 "可选额外不替代
    # raw") was REMOVED 2026-05-17 (plan v0.12.2 / handoff §3-B option (b)).
    # It existed solely to feed the AE-side luma-matte slab; the user's P2
    # decision renders depth-occlusion content IN Blender via this very Axis C
    # pipeline (renderer does the per-pixel Z-test), so the slab — and thus
    # this preview pass — has zero consumers. The raw scene-linear depth/ EXR
    # above (the Axis B precise-fusion asset, DG2) is the only depth output
    # and is unchanged.  v0.12.2：P2 决策（深度遮挡内容在 Blender 渲染）使
    # AE-side slab 弃用，此 0-1 preview pass 无任何消费者 → 彻底移除；raw
    # 深度 EXR（Axis B 融合资产）保留不动。


def _setup_cryptomatte_prepass(scene, params, report):
    """D3 Cryptomatte PRE-EXTRACT scaffold. Cycles-only: EEVEE Next crypto is
    incomplete (L3 research). When not Cycles we SKIP and flag honestly - we do
    NOT silently claim a crypto matte was produced.
    D3 Cryptomatte 预抽取脚手架。仅 Cycles：EEVEE Next crypto 不完整，故非
    Cycles 时跳过并诚实标记，绝不静默谎称已产出 crypto matte。
    """
    if not params.get("cryptomatte"):
        report["cryptomatte"] = {"requested": False}
        return
    if scene.render.engine != "CYCLES":
        report["cryptomatte"] = {
            "requested": True, "produced": False,
            "skipped_reason": "engine != CYCLES (EEVEE Next Cryptomatte "
                              "support incomplete, L3) - scaffold not run",
            "confidence": "L1-scaffold",
        }
        print("WARN render_for_ae: cryptomatte requested but engine is "
              f"{scene.render.engine}; D3 prepass SKIPPED (scaffold, L1)")
        return

    # Cycles path: enable object Cryptomatte pass on the active view layer +
    # build a Compositor Cryptomatte node -> separate single-layer matte EXR
    # (CryptoObject naming convention required for downstream tools, L3).
    # Cycles 路径：启用对象 Cryptomatte pass + Compositor Cryptomatte 节点
    # -> 独立单层 matte EXR（CryptoObject 命名约定，L3）。
    vl = scene.view_layers[scene.view_layers.keys()[0]]
    try:
        vl.use_pass_cryptomatte_object = True
        vl.pass_cryptomatte_depth = int(params.get("crypto_depth") or 6)
    except Exception as exc:  # noqa: BLE001
        report["cryptomatte"] = {"requested": True, "produced": False,
                                 "error": repr(exc), "confidence": "L1"}
        return

    nt, rlayers = _compositor_for_passes(scene, report)

    crypto = nt.nodes.new("CompositorNodeCryptomatteV2")
    crypto.matte_id = params.get("crypto_matte_id") or ""
    out_dir_win = convert_path(params["output_dir"]).rstrip("/")
    fout = nt.nodes.new("CompositorNodeOutputFile")
    fout.base_path = out_dir_win + "/crypto/"
    fout.format.file_format = "OPEN_EXR"  # single-layer, NOT multilayer (D1)
    fout.format.color_depth = "32"
    if fout.file_slots:
        fout.file_slots[0].path = "CryptoObject_"
    try:
        nt.links.new(rlayers.outputs["Image"], crypto.inputs["Image"])
        nt.links.new(crypto.outputs["Matte"], fout.inputs[0])
    except Exception as exc:  # noqa: BLE001
        report["cryptomatte"] = {"requested": True, "produced": False,
                                 "error": f"node link failed: {exc!r}",
                                 "confidence": "L1"}
        return

    report["cryptomatte"] = {
        "requested": True, "produced": True,
        "matte_dir": out_dir_win + "/crypto/",
        "confidence": "L1-untested-this-session",
    }


def _count_written(out_dir_win, base):
    """Count actually-written frames (objective artifact evidence, not a
    success flag). All passes (beauty / raw depth) are EXR.
    统计实际写出帧（客观产物证据，非 success）。
    """
    pattern = out_dir_win.rstrip("/") + "/" + base + "*.exr"
    # glob runs inside the native Windows blender.exe -> normalize the
    # backslash join so the report path is consistent forward-slash.
    # glob 在原生 Windows blender.exe 内运行 -> 归一反斜杠为正斜杠。
    files = sorted(f.replace("\\", "/") for f in glob.glob(pattern))
    return files


def _bake_preview_sequence(cfg, params, report):
    """Option 1 dual-output (user decision 2026-05-17). From the ALREADY-
    rendered scene-linear EXRs, bake a display-referred PNG preview sequence
    using the scene's AUTHORED view transform + look (snapshot taken pre-Raw
    in _setup_render, e.g. AgX + 'AgX - Very High Contrast').

    This is NOT a re-render (no extra Cycles cost): each EXR is loaded and
    re-saved through scene colour management via Image.save_render. The PNG is
    display-referred 8-bit -> import into AE and it looks correct with ZERO AE
    colour config (AE OCIO project/footage interpret proven un-scriptable on
    26.2.1). The scene-linear EXR is left untouched for Axis B linear-
    compositing fusion. NEVER multilayer, NEVER mutates the beauty EXR
    contract (D1 preserved) - the image_settings/view_settings mutated here run
    AFTER the EXRs are on disk, in the process-isolated headless render.
    双输出：从已渲 scene-linear EXR 烘焙带场景作者 view/look 的 display-
    referred PNG 预览（非重渲，save_render 走色彩管理）。PNG 导入 AE 零配置即
    对；EXR 不动留给 Axis B 线性合成融合。不 multilayer、不碰 beauty 契约。
    """
    if not params.get("preview", True):
        report["preview"] = {"requested": False}
        return
    beauty = _count_written(cfg["out_dir_win"], cfg["base"])
    if not beauty:
        report["preview"] = {"requested": True, "produced": False,
                             "error": "no beauty EXR frames to bake from",
                             "confidence": "L1"}
        return

    scene = bpy.context.scene
    prev_dir = cfg["out_dir_win"].rstrip("/") + "/preview/"
    try:
        os.makedirs(prev_dir, exist_ok=True)
    except Exception as exc:  # noqa: BLE001 - surface, never silently pass
        report["preview"] = {"requested": True, "produced": False,
                             "error": f"makedirs failed: {exc!r}",
                             "confidence": "L1"}
        return

    # Re-apply the AUTHORED look for the bake. Safe + isolated: EXRs already on
    # disk, process exits after this. 应用作者设定外观；EXR 已落盘，安全隔离。
    ovt = cfg.get("orig_view_transform") or "AgX"
    olook = cfg.get("orig_look") or ""
    applied = {}
    try:
        scene.view_settings.view_transform = ovt
        applied["view_transform"] = scene.view_settings.view_transform
    except Exception as exc:  # noqa: BLE001
        applied["view_transform_err"] = repr(exc)
    try:
        scene.view_settings.look = olook
        applied["look"] = scene.view_settings.look
    except Exception as exc:  # noqa: BLE001
        applied["look_err"] = repr(exc)
    img_s = scene.render.image_settings
    img_s.file_format = "PNG"
    img_s.color_mode = "RGBA"
    img_s.color_depth = "8"

    written = []
    errors = []
    for src in beauty:
        try:
            tail = src.rsplit("/", 1)[-1]
            num = "".join(ch for ch in tail if ch.isdigit())
            dst = prev_dir + "preview_" + num + ".png"
            im = bpy.data.images.load(src)
            # EXR was rendered with view_transform=Raw (true scene-linear) ->
            # declare it so save_render's view transform is applied correctly.
            # EXR 以 Raw 渲（真场景线性）-> 显式声明，save_render 才正确套变换。
            try:
                im.colorspace_settings.name = "Linear Rec.709"
            except Exception:  # noqa: BLE001 - some configs name it 'Linear'
                im.colorspace_settings.name = "Linear"
            im.save_render(dst, scene=scene)
            bpy.data.images.remove(im)
            written.append(dst.replace("\\", "/"))
        except Exception as exc:  # noqa: BLE001 - per-frame, keep going
            errors.append({"src": src, "error": repr(exc)})

    report["preview"] = {
        "requested": True,
        "produced": len(written) > 0,
        "preview_dir": prev_dir,
        "view_transform": applied.get("view_transform"),
        "look": applied.get("look"),
        "frames_written": len(written),
        "first_frame": written[0] if written else None,
        "errors": errors,
        "confidence": "L3-display-referred-bake (user must eyeball colour)",
    }


def main():
    """Read render.json -> configure -> render animation -> print
    RENDER_RESULT=<json> with objective artifact facts.
    读 render.json -> 配置 -> 渲染动画 -> 打印含客观产物事实的 RENDER_RESULT。
    """
    try:
        params = _read_render_json()
    except Exception as exc:  # noqa: BLE001 - surface, don't swallow
        out = {"success": False, "stage": "read_render_json",
               "error": repr(exc)}
        print("RENDER_RESULT=" + json.dumps(out))
        return out

    scene = bpy.context.scene
    try:
        cfg = _setup_render(scene, params)
    except Exception as exc:  # noqa: BLE001
        out = {"success": False, "stage": "setup_render",
               "error": repr(exc)}
        print("RENDER_RESULT=" + json.dumps(out))
        return out

    report = {"render": cfg}
    try:
        _setup_cryptomatte_prepass(scene, params, report)
    except Exception as exc:  # noqa: BLE001
        report["cryptomatte"] = {"requested": True, "produced": False,
                                 "error": repr(exc), "confidence": "L1"}
    try:
        _setup_depth_pass(scene, params, report)
    except Exception as exc:  # noqa: BLE001
        report["depth"] = {"requested": True, "produced": False,
                           "error": repr(exc), "confidence": "L1"}

    try:
        bpy.ops.render.render(animation=True, write_still=True)
    except Exception as exc:  # noqa: BLE001
        out = {"success": False, "stage": "render",
               "error": repr(exc), "report": report}
        print("RENDER_RESULT=" + json.dumps(out))
        return out

    written = _count_written(cfg["out_dir_win"], cfg["base"])
    # Depth pass: count its actually-written EXRs separately (objective
    # artifact, not the node's self-report). depth pass：独立数实际写出的
    # depth EXR（客观产物，非节点自报告）。
    depth_written = []
    dp = report.get("depth", {})
    if dp.get("produced"):
        depth_written = _count_written(dp["depth_dir"], "depth_")
        dp["frames_written"] = len(depth_written)
        dp["first_frame"] = depth_written[0] if depth_written else None
    # Option 1 dual-output: bake the display-referred preview AFTER the EXRs
    # exist (no re-render). Wrapped so a preview failure never fails the render.
    # 双输出：EXR 写出后烘焙 display-referred 预览（不重渲）；预览失败不致渲染失败。
    try:
        _bake_preview_sequence(cfg, params, report)
    except Exception as exc:  # noqa: BLE001 - surface, never fail the render
        report["preview"] = {"requested": True, "produced": False,
                             "error": repr(exc), "confidence": "L1"}

    pv = report.get("preview", {})
    out = {
        "success": True,
        "report": report,
        "frames_written": len(written),
        "first_frame": written[0] if written else None,
        "last_frame": written[-1] if written else None,
        "depth_frames_written": len(depth_written),
        "preview_frames_written": pv.get("frames_written", 0),
        "expected_frames": (cfg["frame_end"] - cfg["frame_start"] + 1),
    }
    # Honest gap: success here = "render ran + N EXR files exist". Colour
    # correctness / AE interpretability is NOT asserted here (L2, needs the
    # one-time AE interpret-footage verification).
    # 诚实边界：此处 success = 渲染跑完 + N 个 EXR 存在；色彩正确性/AE 可解释
    # 性不在此断言（L2，需一次性 AE interpret-footage 核验）。
    print("RENDER_RESULT=" + json.dumps(out))
    return out


if __name__ == "__main__":
    main()
