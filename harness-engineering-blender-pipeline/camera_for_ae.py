#!/usr/bin/env python3
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

"""Axis B committed Blender camera/object extract script (headless).
Axis B committed Blender 相机/对象提取脚本（无头）。

Run by blender.exe -b <scene> -P camera_for_ae.py -- camera_run.json
(spawned by scripts/cli/blender_to_ae_camera.py, plan SS4.5 D2 / SS7
Phase 2, changelog v0.11). Reads camera_run.json -> per-frame extracts the
selected camera (+ optional nulls/lights/empties) -> writes camera.json for
the committed AE jsx (bl_camera_to_ae.jsx) to setValueAtTime-bake -> prints
CAMERA_RESULT=<json> with OBJECTIVE artifact facts (NOTHING here asserts
success on its own; memory feedback_bridge_exec_success_not_verification).
由 blender_to_ae_camera.py spawn；读 camera_run.json -> 逐帧提取相机(+可选
null/light/empty) -> 写 camera.json 供 committed AE jsx setValueAtTime bake
-> 打印含客观产物事实的 CAMERA_RESULT；本脚本不自证成功。

R5b LICENCE BOUNDARY / 许可证边界 (plan R5b, bridge-validator B-rule 4):
  The coordinate / FOV->zoom / continuous-euler math below is INDEPENDENTLY
  implemented from the Bartek Skorupa official Blender "Export: Adobe After
  Effects (.jsx)" lineage (io_export_after_effects.py) + Adobe helpx AE
  coordinate-system definition. Those are MATHEMATICAL FACTS / an official
  upstream lineage, not copyrightable expression (merger doctrine). This
  script does NOT import or copy the GPL addons/blender2ae source - it is a
  clean independent implementation so the committed Axis B pipeline is
  licence-clean.
  下方坐标/FOV/连续欧拉数学是从 Bartek Skorupa 官方插件谱系 + helpx 坐标系
  定义**独立实现**（数学事实/官方谱系非版权表达）；**不 import/copy** GPL
  addons/blender2ae 源码 -> committed Axis B 管线许可证干净。

CONFIDENCE / 置信度 (memory feedback_confidence_rubric_default +
feedback_no_fabricated_numbers):
  Position + FOV->zoom formula  L3->L4 (Bartek upstream verbatim lineage +
                                helpx coord def; matches project blender2ae)
  Camera rotation convention    L2 NOT ASSERTED. The blender2ae
                                data_conversion.py:77 comment promises a
                                rot_conv_camera() that does NOT exist
                                anywhere; cameras there fall through to the
                                OBJECT -90X path. We reproduce that exact
                                project behaviour AND flag it
                                _rotation_convention L2 + leave the camera
                                One-Node/Orientation correctness to the
                                Phase 2 empirical round-trip test. We do NOT
                                fabricate a "corrected" camera rotation here.
"""

import json
import math
import os
import sys

import bpy


def convert_path(p):
    """WSL path -> Windows path (self-contained copy of the project
    convention, mirrors render_for_ae.convert_path).
    WSL 路径 -> Windows 路径（项目惯例自包含副本）。
    """
    if p and p.startswith("/mnt/"):
        parts = p.split("/")
        if len(parts) >= 3:
            return f"{parts[2].upper()}:/" + "/".join(parts[3:])
    return p.replace("\\", "/") if p else p


def _argv_after_double_dash():
    """Blender passes script args after `--`. Blender 在 `--` 后传脚本参数。"""
    if "--" in sys.argv:
        return sys.argv[sys.argv.index("--") + 1:]
    return []


def _read_run_json():
    """Read the per-run camera_run.json (path may be WSL -> convert to Win
    since blender.exe is native). 读 camera_run.json（WSL 路径 -> 转 Win）。
    """
    args = _argv_after_double_dash()
    if not args:
        raise RuntimeError("camera_for_ae.py: no camera_run.json path after '--'")
    win = convert_path(args[0])
    with open(win, "r", encoding="utf-8") as fh:
        return json.load(fh)


# ---- Bartek/helpx coordinate + lens math (INDEPENDENT impl, R5b) ----------

def loc_conv(bx, by, bz, width, height, aspect, scale):
    """Blender world loc (X=right, Y=forward, Z=up) -> AE (X=right, Y=down,
    Z=forward), origin upper-left, Blender origin -> comp centre. Bartek/
    helpx lineage. Blender 世界坐标 -> AE 坐标（Bartek/helpx 谱系）。
    """
    x = (bx * scale) / aspect + (width / 2.0)
    y = (-bz * scale) + (height / 2.0)   # Blender Z(up) -> AE Y(down) negated
    z = by * scale                        # Blender Y(forward) -> AE Z(depth)
    return [x, y, z]


def rot_conv_object(euler):
    """Blender euler (radians, ZYX) -> AE rotation (degrees) for OBJECTS
    (null/empty/light): X-90 correction (Blender objects lie flat, AE
    upright), Y/Z negated. Verbatim project blender2ae lineage.
    物体旋转转换（null/empty/light），项目 blender2ae 谱系。
    """
    return [math.degrees(euler[0]) - 90.0,
            -math.degrees(euler[1]),
            -math.degrees(euler[2])]


def rot_conv_camera(euler):
    """Camera rotation -> AE Orientation (degrees).

    L2 NOT ASSERTED (memory feedback_no_fabricated_numbers). The project's
    blender2ae data_conversion.py:77 comment promises a camera-specific
    rot_conv_camera() but NO such function exists anywhere in the repo;
    blender2ae extract_camera_data() actually falls through to the OBJECT
    -90X path. We reproduce that EXACT existing project behaviour (so this
    is not a fabricated "fix") and flag the convention L2 in camera.json
    (_rotation_convention) for the Phase 2 empirical round-trip test
    (Blender known-orientation camera -> bake -> AE readback quaternion
    equivalence) to confirm or correct One-Node/Orientation handling.
    相机旋转 -> AE Orientation。L2 不臆断：复现现有项目行为（物体 -90X 路径，
    blender2ae 实际即如此），camera.json 标 _rotation_convention L2，
    One-Node/Orientation 正确性留 Phase 2 往返实测确认/修正。
    """
    return rot_conv_object(euler)


def convert_lens(cam_data, width, height, aspect):
    """Blender lens(mm) -> AE Zoom(px). Bartek io_export_after_effects.py
    verbatim lineage: zoom = lens * dimension / sensor * aspect, with
    sensor_fit VERTICAL -> (sensor_height,height) else (sensor_width,width).
    Blender 焦距 -> AE Zoom，Bartek 谱系逐字。
    """
    if cam_data.sensor_fit == "VERTICAL":
        sensor = cam_data.sensor_height
        dimension = height
    elif cam_data.sensor_fit == "HORIZONTAL":
        sensor = cam_data.sensor_width
        dimension = width
    else:  # AUTO: Bartek uses sensor_width + the larger dimension
        sensor = cam_data.sensor_width
        dimension = width if width >= height else height
    return cam_data.lens * dimension / sensor * aspect


# ---- per-frame extraction --------------------------------------------------

def _classify(scene, run):
    """Resolve the target camera + optional null/light/empty objects from the
    run params. 解析目标相机 + 可选 null/light/empty。
    """
    want = set(run.get("objects", []))   # e.g. {"null","light","empty"}
    cam_name = run.get("scene_camera") or ""
    cam_obj = None
    if cam_name:
        cam_obj = bpy.data.objects.get(cam_name)
        if cam_obj is None or cam_obj.type != "CAMERA":
            raise RuntimeError(f"camera '{cam_name}' not found / not a CAMERA")
    elif scene.camera is not None:
        cam_obj = scene.camera
    if cam_obj is None:
        raise RuntimeError("no --scene-camera and scene has no active camera")

    nulls, lights = [], []
    for ob in scene.objects:
        if ob is cam_obj:
            continue
        if ob.type == "LIGHT" and "light" in want:
            lights.append(ob)
        elif ob.type in ("EMPTY", "MESH") and (
                "null" in want or "empty" in want):
            # Mesh exported as a null (position/rotation only), like blender2ae
            nulls.append(ob)
    return cam_obj, nulls, lights


def _continuous_euler(obj, cache):
    """matrix_world -> euler 'ZYX' with continuity vs the previous frame
    (avoids 360 flips). Uses matrix_world = EVALUATED world transform so
    constraints / parenting / NLA-driven camera animation is naturally baked
    (plan RB1). matrix_world(=evaluated) -> 连续 ZYX 欧拉防跳（约束/父子/NLA
    天然 bake，RB1）。
    """
    if obj.name not in cache:
        cache[obj.name] = obj.matrix_world.to_euler("ZYX")
    e = obj.matrix_world.to_euler("ZYX", cache[obj.name])
    cache[obj.name] = e.copy()
    return e


def _extract(scene, run):
    """Per-frame loop -> accumulate per-property arrays. 逐帧累积属性数组。"""
    rs = scene.render
    width = rs.resolution_x
    height = rs.resolution_y
    aspect = (rs.pixel_aspect_x / rs.pixel_aspect_y
              if rs.pixel_aspect_y else 1.0)
    fps = math.floor(rs.fps / rs.fps_base * 1000.0) / 1000.0
    scale = float(run.get("scale_factor", 100.0))

    fs = run.get("frame_start")
    fe = run.get("frame_end")
    first = int(fs) if fs is not None else scene.frame_start
    last = int(fe) if fe is not None else scene.frame_end
    if last < first:
        raise RuntimeError(f"bad frame range {first}-{last}")

    cam_obj, nulls, lights = _classify(scene, run)

    data = {
        "fps": fps, "first_frame": first, "last_frame": last,
        "width": width, "height": height, "aspect": aspect,
        "scale_factor": scale,
        # AE-side params echoed through (single handoff file for the jsx).
        "comp": run.get("comp", "BL3D_Camera"),
        "target_plate": run.get("target_plate", ""),
        "no_keyframe": bool(run.get("no_keyframe", False)),
        "locale": run.get("locale", "en"),
        # L2 honesty flag (feedback_no_fabricated_numbers): camera rotation
        # convention is the rot_conv_camera promised-but-absent trap.
        "_rotation_convention": (
            "camera uses OBJECT -90X path (reproduces existing project "
            "blender2ae behaviour; rot_conv_camera promised-but-absent). "
            "L2 NOT ASSERTED - Phase 2 round-trip test pending One-Node/"
            "Orientation correctness."),
        "cameras": {cam_obj.name: {"position": [], "orientation": [],
                                   "zoom": [], "shift": []}},
        "nulls": {o.name: {"position": [], "orientation": []} for o in nulls},
        "lights": {o.name: {"position": [], "orientation": [], "type": [],
                            "energy": [], "color": []} for o in lights},
    }

    cur = scene.frame_current
    rot_cache = {}
    for frame in range(first, last + 1):
        scene.frame_set(frame)

        # --- camera (One-Node + Orientation, Bartek convention) ---
        m = cam_obj.matrix_world
        t = m.to_translation()
        cd = data["cameras"][cam_obj.name]
        cd["position"].append(loc_conv(t.x, t.y, t.z, width, height,
                                       aspect, scale))
        cd["orientation"].append(
            rot_conv_camera(_continuous_euler(cam_obj, rot_cache)))
        bcam = cam_obj.data
        if bcam.type == "PERSP":
            cd["zoom"].append(convert_lens(bcam, width, height, aspect))
        else:
            # ORTHO/PANO zoom mapping is a Phase 2 item; record None + flag.
            # 正交/全景 zoom 映射是 Phase 2 项；记 None + 标记。
            cd["zoom"].append(None)
        # Lens shift (px): captured raw; AE-side mapping is a Phase 2 item.
        cd["shift"].append([bcam.shift_x * max(width, height),
                            bcam.shift_y * max(width, height)])

        for o in nulls:
            nd = data["nulls"][o.name]
            wt = o.matrix_world.to_translation()
            nd["position"].append(loc_conv(wt.x, wt.y, wt.z, width, height,
                                           aspect, scale))
            nd["orientation"].append(
                rot_conv_object(_continuous_euler(o, rot_cache)))

        for o in lights:
            ld = data["lights"][o.name]
            wt = o.matrix_world.to_translation()
            ld["position"].append(loc_conv(wt.x, wt.y, wt.z, width, height,
                                           aspect, scale))
            ld["orientation"].append(
                rot_conv_object(_continuous_euler(o, rot_cache)))
            ldata = o.data
            ld["type"].append(ldata.type)
            energy = (ldata.energy * 100.0 if ldata.type == "SUN"
                      else ldata.energy)
            ld["energy"].append(energy)
            ld["color"].append([ldata.color[0], ldata.color[1],
                                ldata.color[2]])

    scene.frame_set(cur)   # restore (non-destructive, mirrors blender2ae)
    _collapse_static(data)
    return data


def _collapse_static(data):
    """If a property is identical across all frames (eps 1e-6) keep only the
    first sample (len 1). The AE jsx contract: len==1 -> setValue static,
    len>1 -> setValueAtTime per frame. Mirrors blender2ae
    simplify_static_properties (independent impl).
    全帧相同则只留首样本；jsx 契约：len==1 静态 setValue / len>1 逐帧
    setValueAtTime（独立实现，镜像 blender2ae simplify_static_properties）。
    """
    def same(a, b):
        if isinstance(a, (list, tuple)):
            if a is None or b is None or len(a) != len(b):
                return False
            return all(
                (x is None and y is None) or
                (x is not None and y is not None and abs(x - y) < 1e-6)
                for x, y in zip(a, b))
        if a is None or b is None:
            return a is b
        return abs(a - b) < 1e-6

    for group in ("cameras", "nulls", "lights"):
        for _name, props in data[group].items():
            for pk, vals in list(props.items()):
                if isinstance(vals, list) and len(vals) > 1:
                    if all(same(v, vals[0]) for v in vals):
                        props[pk] = [vals[0]]


def main():
    """Read camera_run.json -> extract -> write camera.json -> print
    CAMERA_RESULT=<json>. 读 camera_run.json -> 提取 -> 写 camera.json。
    """
    try:
        run = _read_run_json()
    except Exception as exc:  # noqa: BLE001 - surface, don't swallow
        print("CAMERA_RESULT=" + json.dumps(
            {"success": False, "stage": "read_run_json", "error": repr(exc)}))
        return

    try:
        scene = bpy.context.scene
        data = _extract(scene, run)
    except Exception as exc:  # noqa: BLE001
        print("CAMERA_RESULT=" + json.dumps(
            {"success": False, "stage": "extract", "error": repr(exc)}))
        return

    # camera.json is written next to camera_run.json (the stage dir, D:/
    # reachable). camera.json 写在 camera_run.json 同目录（D:/ 可达暂存）。
    run_arg = _argv_after_double_dash()[0]
    stage_dir = os.path.dirname(convert_path(run_arg))
    out_path = os.path.join(stage_dir, "camera.json")
    try:
        with open(out_path, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2)
    except Exception as exc:  # noqa: BLE001
        print("CAMERA_RESULT=" + json.dumps(
            {"success": False, "stage": "write_camera_json",
             "error": repr(exc)}))
        return

    cams = data["cameras"]
    cam_name = next(iter(cams)) if cams else None
    n_pos = len(cams[cam_name]["position"]) if cam_name else 0
    out = {
        "success": True,
        "camera_json": out_path,
        "cameras": list(cams.keys()),
        "nulls": list(data["nulls"].keys()),
        "lights": list(data["lights"].keys()),
        "fps": data["fps"],
        "first_frame": data["first_frame"],
        "last_frame": data["last_frame"],
        "expected_frames": data["last_frame"] - data["first_frame"] + 1,
        "cam_position_samples": n_pos,   # 1 = static-collapsed, >1 = animated
    }
    # Honest gap: success here = "extract ran + camera.json written + N
    # samples". Coordinate/rotation CORRECTNESS vs AE is the Phase 2
    # round-trip test, NOT asserted here (feedback_bridge_exec_success_not_
    # verification). 诚实边界：此处 success = 提取跑完+写出+N 样本；坐标/旋转
    # 对 AE 正确性是 Phase 2 往返实测，不在此断言。
    print("CAMERA_RESULT=" + json.dumps(out))


if __name__ == "__main__":
    main()
