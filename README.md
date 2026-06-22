# Video Creation — Tutorial Resources

Free companion resources for the **Video Creation** tutorial videos.

Each folder corresponds to one tutorial video. Download the ZIP from
[Releases](https://github.com/ForeverDreamer/video-creation-tutorials/releases),
or browse the source code directly.

## Repository layout

Resources are grouped by series:

```text
deployment/   # Environment & deployment setup (WSL2, Adobe automation, …)
2d/           # 2D After Effects animation demos
3d/           # 3D animation demos
```

> `harness-engineering-blender-pipeline/` is a separate, **license-isolated
> GPL-3.0-or-later** component (not a per-video pack) — see its own folder and the
> [License](#license) note below.

Each pack lives at `<series>/<slug>/` with:

- `code/` — the standalone demo script(s). No external dependencies — download, run, and edit the config to verify.
- `docs/` — `README.md` (setup + walkthrough) and `prompts.md` (the prompts used in the video).

Release ZIPs are named `<series>-<slug>-scripts.zip` and attached to a tag
`<series>-<slug>-vX.Y` on the [Releases](https://github.com/ForeverDreamer/video-creation-tutorials/releases) page.

---

## Deployment & Setup

### WSL2 Environment Setup

**Video**: *How to Set Up WSL2 for AI Development | Complete Guide*

Scripts to check system requirements and generate an optimal WSL2 configuration.
See [`deployment/wsl2-setup/`](deployment/wsl2-setup/).

| File | What it does |
| ---- | ------------ |
| `Run-WSL2-Check.bat` | Launcher — double-click to check WSL2 requirements |
| `Check-WSL2-Requirements.ps1` | Checks OS version, virtualization, disk space |
| `Run-WSL-Config-Recommend.bat` | Launcher — double-click to get .wslconfig recommendation |
| `Recommend-WSL-Config.ps1` | Auto-detects RAM/CPU and generates optimal .wslconfig |

Download `wsl2-setup-scripts.zip` from the
[wsl2-setup-v1.0 release](https://github.com/ForeverDreamer/video-creation-tutorials/releases/tag/wsl2-setup-v1.0).

### PR Export Clips

**Video**: *Premiere Pro Batch Export Clips — Zero Install, Double-Click to Run*

Files to batch export audio clips from a Premiere Pro sequence via Adobe Media Encoder.
See [`deployment/pr/`](deployment/pr/).

| File | What it does |
| ---- | ------------ |
| `run_pr_scripts.bat` | Launcher — double-click to auto-detect PR and execute the script |
| `run_pr_scripts.ps1` | Detects PR installation, checks prerequisites, launches script |
| `config.jsx` | Standalone configuration — edit project path, AME preset, output dir |
| `export_clips.jsx` | Exports all clips from a sequence as individual WAV files + generates clip_mapping.json |

Download `pr-export-clips-scripts.zip` from the
[pr-export-clips-v1.0 release](https://github.com/ForeverDreamer/video-creation-tutorials/releases/tag/pr-export-clips-v1.0).

> Scripts support English and Chinese (auto-detected from system locale).

---

## 2D After Effects Demos

_Coming soon — packs land under [`2d/`](2d/) as the videos publish._

## 3D Animation Demos

_Coming soon — packs land under `3d/` as the videos publish._

---

## Blender→AE Pipeline (GPL component)

[`harness-engineering-blender-pipeline/`](harness-engineering-blender-pipeline/) holds
three self-contained Blender Python scripts of the Blender→AE committed pipeline
(Axis A glTF export / Axis B camera-data extract / Axis C EXR render). Because they
`import bpy`, they are distributed under **GPL-3.0-or-later**, license-isolated in
their own directory from the repository-root MIT license. See that folder's
`README.md` / `LICENSE` / `NOTICE`.

## License

[MIT](LICENSE) for the repository root and all tutorial packs, **except**
[`harness-engineering-blender-pipeline/`](harness-engineering-blender-pipeline/),
which is GPL-3.0-or-later (license-isolated in its own directory).
