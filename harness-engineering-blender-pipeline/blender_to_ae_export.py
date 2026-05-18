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

"""
Blender → After Effects glTF/GLB 导出契约模板 / Blender → AE glTF Export Contract

Axis A（glTF/GLB 活 3D 桥）的 Blender 侧可复用导出器，与 AE 侧
`adobe/ae/scripts/common/blender3d_utils.jsx` 对称，由 `/bl-model-to-ae`
命令委托。固化 docs/guides/blender-ae-integration-plan.md v0.9 的
BQ2 + 4.3 D8 导出契约（含 v0.9 用户质疑驱动的 shared-NLA 多对象动画契约）。
Reusable Blender-side exporter for Axis A (glTF/GLB live-3D bridge),
symmetric to the AE-side blender3d_utils.jsx, delegated by /bl-model-to-ae.
Encodes the BQ2 + §4.3 D8 export contract from the integration plan v0.9
(incl. the v0.9 user-challenge-driven shared-NLA multi-object animation
contract).

整合自 Phase 0 一次性脚本（已删）：phase0_bl_ae_test.py（导出契约部分）
+ phase0_reexport_scene_anim.py（SCENE/NLA 实验，open_mainfile 坑教训）。
Consolidated from the now-deleted Phase 0 throwaway scripts.

核心契约 (Core Contract) — 见 plan v0.9 §4.3 D8 / BQ2 / BQ18:
------------------------------------------------------------
- **A2 模式**：仅几何 GLB（无相机/灯），`use_visible=True`（Visible
  Objects Only，隐藏对象排除）、`export_yup=True`（+Y up，glTF 原生）、
  单文件 GLB。AE 侧用 Environment-Light/HDRI 打光（绕开 Blender Area/
  World 灯 glTF 不支持天花板）。
- **A1 模式**：+ 相机 + punctual 灯（Sun/Point/Spot）供 AE 原生抽取
  `cam_main`（Area+World 仍不导出）。
- **对象动画（v0.9，关键）**：多对象动画**必须**走 shared-NLA 契约
  —— 每动画对象 action push 到**同名 NLA track** + `NLA_TRACKS`
  模式 → **单个合并 glTF 动画**。默认 `ACTIONS`/`SCENE` 模式 = 每
  对象独立 clip → AE `Animation Options` 单选无法共播 + 实测错绑
  （cubeAction→sphere 动 / cube 旋转丢失，用户 3 次目视实证）。
- **作者期前提（BQ1，代码不可强制，仅文档化）**：base color 用
  image-texture 烘焙 PBR（仅 JPEG/PNG 贴图能过 Advanced 3D）。
- **AE 侧天花板（路由 Axis C，非本模板可解）**：transmission/玻璃、
  SSS/体积/程序化 shader、morph-target/shape-key/vertex/cloth/fluid/
  particle 仿真、material·shader 动画、geo-node 拓扑动画。

⚠️ Bridge context 坑（phase0_reexport_scene_anim.py 教训）:
本模块**不** open_mainfile —— 在 Socket 桥接的受限 context 下
`wm.open_mainfile` 后 glTF 导出器访问 `bpy.context.active_object`
抛 AttributeError。本模块操作**当前活动场景**（调用方/用户已 author）。
This module does NOT open_mainfile; it operates on the CURRENT scene
(the bridge's restricted post-open context breaks the glTF exporter).

⚠️ shared-NLA stash 是破坏性操作（改 animation_data）：把它作为导出
**最后一步**，或在可丢弃的会话里做（与 phase0 "done LAST so clean
.blend unaffected" 同纪律）。
stash_animations_to_shared_nla() mutates animation_data — run it LAST.

用法示例 (Usage Example):
------------------------
```python
from bl.scripts.common.blender_to_ae_export import export_for_ae

# A2（仅几何，无动画）
export_for_ae("/mnt/d/VideoCreation/proj/models/en/widget.glb", mode="A2")

# A1（含相机/灯供 AE 抽取）
export_for_ae(".../scene.glb", mode="A1")

# 多对象动画 → shared-NLA 单合并 glTF 动画（导出后 AE 侧仍需 1 次
# 手动 Animation Options clip-select，不可脚本，见 plan v0.9 §7.1）
export_for_ae(".../anim.glb", mode="A1", with_animation=True)
```
"""

import os

import bpy

# glTF 导出器 animation_mode 取值 / valid export_animation_mode values
_ANIM_MODE_SHARED_NLA = "NLA_TRACKS"  # v0.9 多对象共播正解 / multi-object co-play


def convert_path(p):
    """WSL 路径 → Blender 可写的 Windows 路径（镜像项目惯例）。
    WSL path → Windows path Blender can write (mirrors project convention).

    `/mnt/d/foo` → `D:/foo`；非 /mnt/ 前缀原样返回（已是 Win 或相对路径）。
    """
    if p.startswith("/mnt/"):
        parts = p.split("/")
        if len(parts) >= 3:
            return f"{parts[2].upper()}:/" + "/".join(parts[3:])
    return p.replace("\\", "/")


def _log(logger, msg):
    """可选日志回调（仿 common/audio_baking_utils 约定）；缺省 print。
    Optional logging callback (per common/ convention); falls back to print.
    """
    if logger is not None:
        logger(msg)
    else:
        print(f"[BL2AE] {msg}")


def stash_animations_to_shared_nla(scene=None, track_name="SceneAnim",
                                   logger=None):
    """v0.9 shared-NLA 多对象动画契约（**幂等**-破坏性，v0.9.4 修）。
    v0.9 shared-NLA multi-object animation contract (IDEMPOTENT-destructive).

    把场景内每个有动画的对象规整为**恰好一条同名** NLA track（含其
    action strip）+ 清空 active action。配合 export_animation_mode=
    'NLA_TRACKS' → 同名 track 合并为**单个** glTF 动画，AE 单选
    Animation Options 全对象同播（Blender 5.1 glTF 手册 + 用户本机实测）。

    **v0.9.4 幂等修复（用户实测崩溃驱动）**：旧版无条件 `nla_tracks.new()`
    → live 场景重复跑（不重启 Blender）叠加多条同名 `track_name` 轨道
    → `NLA_TRACKS` glTF 导出在桥接 context 硬崩 Blender（L3：clean-
    launch 成功 vs 脏 live 崩溃 决定性差分实证）。本版对**任意先前状态**
    （未 stash / 已 stash / 重复轨道脏态）收敛到**恰好一条干净 track**：
    先定位 source action（优先 active action，否则现存同名 track 的
    strip action）→ 删除**全部**同名旧 track（去重/清残）→ 新建唯一一条
    → 清 active action。重复跑结果稳定 → 不崩 → 可安全 default-on。
    Old code unconditionally added a new same-name track, so repeated runs
    on a live scene (no Blender restart) stacked duplicate `track_name`
    tracks -> NLA_TRACKS glTF export hard-crashed Blender via the bridge.
    This version converges ANY prior state to EXACTLY ONE clean track,
    making repeated runs stable (safe for default-on).

    仍是破坏性（mutate live 场景 animation_data）但**幂等**（N 次 == 1 次）。
    Still destructive (mutates live animation_data) but IDEMPOTENT.

    Param scene      - bpy Scene；None=当前 bpy.context.scene
    Param track_name - 共享 NLA track 名（AE 下拉显示此名）
    Param logger     - 可选日志回调
    Returns list[str] - 有动画并被规整的对象名（幂等 normalized）
    """
    scn = scene or bpy.context.scene
    processed = []
    for ob in scn.objects:
        ad = ob.animation_data
        if not ad:
            continue

        # 1. Locate the source action - active action takes priority;
        #    otherwise recover it from an existing same-name track's strip
        #    (object already stashed by a prior run). Hold a Python ref so
        #    the Action datablock survives the track removal below.
        #    定位 source action（优先 active；否则从现存同名 track 的
        #    strip 恢复——已被前次 stash）。先持 Python 引用防删轨后丢失。
        src = ad.action
        if src is None:
            for trk in ad.nla_tracks:
                if trk.name != track_name:
                    continue
                for st in trk.strips:
                    if st.action is not None:
                        src = st.action
                        break
                if src is not None:
                    break
        if src is None:
            continue  # this object has no animation - nothing to stash

        # 2. Remove ALL existing same-name tracks (dedupe duplicates +
        #    clear stale partial state from prior crashed/repeat runs).
        #    删除全部同名旧 track（去重 + 清前次崩溃/重复跑的残留脏态）。
        stale = [t for t in ad.nla_tracks if t.name == track_name]
        for t in stale:
            ad.nla_tracks.remove(t)

        # 3. Recreate exactly ONE clean same-name track + the strip, then
        #    clear active action (only the NLA strip should export).
        #    重建唯一一条干净同名 track + strip，再清 active action。
        trk = ad.nla_tracks.new()
        trk.name = track_name
        trk.strips.new(src.name, int(src.frame_range[0]), src)
        ad.action = None
        processed.append(ob.name)

    _log(logger, f"NLA-normalized {len(processed)} obj(s) to shared track "
                 f"'{track_name}' (idempotent): {processed}")
    return processed


def _snapshot_active_actions(scene):
    """v0.9.5 非破坏性还原：stash 前快照各对象 active action 引用。
    v0.9.5 non-destructive restore: snapshot each object's active action
    BEFORE stash so the live scene can be put back afterwards.

    Holds bpy object + Action datablock refs (valid throughout the single
    bridge call). ad.action may be None (scene already in stashed state -
    its converged single-track IS the canonical persistent state, nothing
    to restore). 持 bpy 对象 + Action 数据块引用（单次桥接调用内有效）。

    Returns list[(object, original_action_or_None)]
    """
    snap = []
    for ob in scene.objects:
        ad = ob.animation_data
        if not ad:
            continue
        snap.append((ob, ad.action))
    return snap


def _restore_active_actions(snapshot, track_name, logger=None):
    """v0.9.5 还原：把 stash 改动的 live 场景复原到导出前工作态。
    v0.9.5 restore the live scene to its pre-export working state.

    对**导出前有 active action** 的对象（= 用户/Claude 正在迭代编辑的
    工作场景）：删除本次产生的同名临时 track + 把 active action 放回 →
    回 Blender Dope Sheet/Timeline 可继续改关键帧·表达式（迭代环不断）。
    对**导出前无 active action** 的对象（场景本就 stashed，如磁盘
    phase0_scene.blend）：幂等 stash 收敛的单轨道**就是**其规范持久态
    → 不动（best-effort 作用域，见 export_for_ae docstring）。
    Objects that HAD an active action -> remove our temp same-name track +
    put the action back (iterative edit loop stays intact). Objects that
    had NONE (already-stashed canonical state) -> leave the converged
    single track as-is.

    Returns list[str] - 被还原 active action 的对象名
    """
    restored = []
    for ob, original_action in snapshot:
        ad = ob.animation_data
        if ad is None or original_action is None:
            continue  # already-stashed canonical state - leave converged
        for t in [t for t in ad.nla_tracks if t.name == track_name]:
            ad.nla_tracks.remove(t)
        ad.action = original_action
        restored.append(ob.name)
    _log(logger, f"restored {len(restored)} obj(s) active action "
                 f"(non-destructive, scene back to working state): {restored}")
    return restored


def detect_world_hdri(scene=None, logger=None):
    """v0.9.7 探测场景 World 的环境纹理 HDRI 磁盘文件路径。
    v0.9.7 Detect the scene World's Environment-Texture HDRI file on disk.

    用途：让 AE Env Light **自动镜像 Blender World**（用户决策默认开，
    supersede v0.9.1 env-light-opt-in framing）。**关键**：glTF/GLB
    **不携带** World（Axis A 天花板②，plan §4.1/BQ4/BQ7）——本函数只
    传**文件路径**给 AE 侧（经 run.json），**不是**让 GLB 自带 World。
    Lets the AE Env Light auto-mirror the Blender World. glTF does NOT
    carry the World (Axis A ceiling 2); this passes the file PATH only.

    **只读 introspection**（不 mutate 场景 → 不影响 v0.9.5 非破坏契约）。
    Read-only (no scene mutation; safe wrt the v0.9.5 restore contract).

    诚实 fallback（不臆造路径，per feedback_no_fabricated_numbers /
    no_fabricated_external_ids）：无 World / 纯色 World / 程序化(无
    env-tex) / 无 image / packed-only / filepath 不在盘 → 返回
    (None, reason)，调用方退回 v0.9.1 composite-ready（无打光）。
    Honest fallbacks return (None, reason) so the caller degrades to the
    v0.9.1 composite-ready (no lighting) - never a fabricated path.

    Param scene  - bpy Scene；None=当前 bpy.context.scene
    Param logger - 可选日志回调
    Returns (abs_path_or_None, reason_str) - abs_path 是 Blender 视角的
            绝对路径（Blender 跑在 Windows 时即 Windows 路径）；调用方用
            convert_path 归一化给 AE。abs_path is absolute as Blender sees
            it; caller normalizes for AE via convert_path.
    """
    scn = scene or bpy.context.scene
    w = getattr(scn, "world", None)
    if w is None:
        return (None, "scene has no World")
    if not w.use_nodes or w.node_tree is None:
        return (None, "World is not node-based (flat color) - no HDRI")
    env_nodes = [n for n in w.node_tree.nodes
                 if n.bl_idname == "ShaderNodeTexEnvironment"]
    if not env_nodes:
        return (None, "World has no Environment Texture node "
                      "(procedural/flat) - no HDRI")
    # First env-tex node carrying an image (BlenderKit standard World
    # setup has exactly one). 取首个带 image 的环境纹理节点。
    img = None
    for n in env_nodes:
        if n.image is not None:
            img = n.image
            break
    if img is None:
        return (None, "Environment Texture node has no image")
    raw = img.filepath
    if img.packed_file and not raw:
        # Packed-only (no external file). Auto-unpack is unverified -
        # don't fabricate; give an actionable fallback (verify-before-
        # enshrine). packed-only：不做未验证的自动 unpack，给可操作回退。
        return (None, "World HDRI is packed into the .blend (no external "
                      "file); unpack in Blender or pass an explicit path")
    if not raw:
        return (None, "World HDRI image has no filepath")
    abs_path = bpy.path.abspath(raw)
    if not os.path.exists(abs_path):
        return (None, "World HDRI filepath not on disk: " + str(abs_path))
    _log(logger, f"World HDRI detected: {img.name} -> {abs_path}")
    return (abs_path, "ok: " + img.name)


def export_for_ae(out_path, *, mode="A2", with_animation=False,
                  shared_track_name="SceneAnim", restore_scene=True,
                  logger=None):
    """按 plan v0.9 BQ2/§4.3 D8 契约导出当前场景为 AE 用 GLB。
    Export the CURRENT Blender scene to an AE-ready GLB per the v0.9
    BQ2 / §4.3 D8 contract.

    Param out_path        - 目标 GLB 路径（绝对 / WSL；内部转 Win 路径）
    Param mode            - "A2"（仅几何，无相机/灯，AE 侧 art-direct）
                            | "A1"（+相机+punctual 灯，供 AE 原生抽取）
    Param with_animation  - True → 先跑 shared-NLA stash + NLA_TRACKS
                            模式（多对象共播正解）；False → 无动画/默认
    Param shared_track_name - with_animation 时的共享 NLA track 名
    Param restore_scene   - v0.9.5，默认 True：导出后**非破坏性还原**
                            live 场景到导出前工作态（active action 放回、
                            临时同名 track 删除）→ 用户/Claude 可回 Blender
                            继续迭代改关键帧·表达式后重导出，scene 不被
                            stash 污染。False = 落地 stash 态（少数"就要
                            持久 NLA"场景）。**作用域**：对有 active
                            action 的工作场景精确还原；对本就 stashed 的
                            场景（无 active action）不动其规范态；复杂预存
                            NLA 逐属性不保证（best-effort，见 §设计取向）。
                            with_animation=False 时本参数无效（无 stash）。
    Param logger          - 可选日志回调
    Returns dict - {success, out, mode, with_animation, stashed, restored,
                    world_hdri, world_hdri_reason} - v0.9.7: world_hdri =
                    AE-normalized World Environment-Texture HDRI path (or
                    None + reason); runner auto-applies to run.json
                    envLightHdri unless an explicit path/none was given.

    Raises ValueError - mode 非 A1/A2
    """
    if mode not in ("A1", "A2"):
        raise ValueError(f"mode must be 'A1' or 'A2', got {mode!r}")

    win_out = convert_path(out_path)
    os.makedirs(os.path.dirname(win_out) or ".", exist_ok=True)

    # BQ2 公共契约 / shared BQ2 contract
    opts = dict(
        export_format="GLB",
        use_visible=True,          # Visible Objects Only - 仅可见对象
        export_yup=True,           # +Y up (glTF native) - glTF 原生 +Y up
        export_apply=True,         # apply modifiers - 应用修改器
        export_materials="EXPORT",
        export_image_format="AUTO",
        # v0.9.2 fix: STATIC by default - 默认静态，不导出任何动画。
        # 仅 with_animation 经 shared-NLA 路径才置 True（见下方）。
        # 旧版无条件 True → A2 静态导出仍泄漏逐对象 glTF clip
        # (mesh_*Action)，AE 单选无法共播 + 错绑（v0.9 明令禁止的
        # broken 中间态；用户 AE 截图实证）。
        # Old code unconditionally True, leaking per-object clips even
        # for static A2 export — the exact v0.9-forbidden broken state.
        export_animations=False,
    )
    # A2 = 仅几何（无相机/灯）；A1 = +相机+punctual 灯（供 AE 抽取）
    with_cam_lights = (mode == "A1")
    opts["export_cameras"] = with_cam_lights
    opts["export_lights"] = with_cam_lights

    scn = bpy.context.scene
    stashed = []
    snapshot = None
    if with_animation:
        # v0.9.5: snapshot active actions BEFORE the destructive stash so
        # the live scene can be restored after export (iterative edit loop).
        # v0.9.5：stash 前快照，导出后非破坏性还原（迭代编辑环不断）。
        if restore_scene:
            snapshot = _snapshot_active_actions(scn)
        # v0.9 关键：多对象动画必须 shared-NLA + NLA_TRACKS，否则 AE
        # 单选无法共播 + 错绑。v0.9.2: only HERE is animation export
        # enabled, and only via the shared-NLA single-merged path -
        # 仅此路径开动画导出，强制走 shared-NLA 单合并（杜绝逐对象泄漏）。
        stashed = stash_animations_to_shared_nla(
            track_name=shared_track_name, logger=logger)
        opts["export_animations"] = True
        opts["export_animation_mode"] = _ANIM_MODE_SHARED_NLA

    bpy.ops.export_scene.gltf(filepath=win_out, **opts)
    _log(logger, f"{mode} GLB exported -> {win_out}"
                 f"{' (shared-NLA merged anim)' if with_animation else ''}")

    # v0.9.5: restore the live scene to its pre-export working state AFTER
    # the export op returns (the only mutation window is during export).
    # v0.9.5：导出 op 返回后还原 live 场景（mutation 窗口仅在导出期间）。
    restored = []
    if with_animation and restore_scene and snapshot is not None:
        restored = _restore_active_actions(
            snapshot, shared_track_name, logger=logger)

    if with_animation:
        _log(logger, "Reminder: AE side still needs 1 MANUAL clip-select "
                     "(Animation Options → Name dropdown; NOT scriptable, "
                     "ADBE ModelAnimName2 = NO_VALUE — plan v0.9 §7.1).")

    # v0.9.7: read-only World-HDRI detection (the runner decides whether to
    # auto-apply it to run.json envLightHdri; here we only report).
    # v0.9.7：只读探测 World HDRI（runner 决定是否 auto 写入 run.json）。
    wh_path, wh_reason = detect_world_hdri(scene=scn, logger=logger)

    return {
        "success": True,
        "out": win_out,
        "mode": mode,
        "with_animation": with_animation,
        "stashed": stashed,
        "restored": restored,
        # v0.9.7 World HDRI auto-detect: AE-normalized path or None +
        # honest reason. convert_path: C:\..\x.exr -> C:/../x.exr (AE ok).
        "world_hdri": convert_path(wh_path) if wh_path else None,
        "world_hdri_reason": wh_reason,
    }


def main():
    """安全入口：仅打印契约摘要，不导出（库模块，导出须显式调
    export_for_ae）。统一 main() 命名符合 bl/CLAUDE.md 规范。
    Safe entry point: prints the contract summary only, does NOT export
    (this is a library; call export_for_ae explicitly).
    """
    print(__doc__.split("用法示例")[0].strip())
    return {"success": True, "note": "library module — call export_for_ae()"}


if __name__ == "__main__":
    main()
