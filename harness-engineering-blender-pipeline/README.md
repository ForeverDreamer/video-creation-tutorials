# harness-engineering-blender-pipeline (GPL component)

> ⚠️ **Not legal advice.** This directory is a **local staging copy**, prepared
> 2026-05-18, **not yet pushed** to any public repository. Pushing to a public
> repo is a separate, user-confirmed, irreversible step.

## What this is

Three self-contained Blender Python scripts of the Blender→AE committed
pipeline:

| File | Role |
|------|------|
| `render_for_ae.py` | Axis C — headless per-AOV linear-EXR render for `/bl-render-to-ae` |
| `camera_for_ae.py` | Axis B — per-frame camera/object data extract for `/bl-camera-to-ae` |
| `blender_to_ae_export.py` | Axis A — glTF/GLB export contract for `/bl-model-to-ae` |

Each was copied verbatim from the proprietary `video_creation_x` project
(original code bytes preserved exactly; only the GPL header was prepended) and
carries an `SPDX-License-Identifier: GPL-3.0-or-later` header.

## Why GPL-3.0-or-later (not MIT, not GPL-2.0-or-later)

These scripts `import bpy` (the Blender Python API). Per Blender's GPL policy
(Blender is GPL-2.0-or-later), redistributed code that uses `bpy` must be
GPL-compatible — so they are **not** part of, and **not** covered by, the
MIT-licensed `harness-engineering` resource pack.

`GPL-3.0-or-later` was selected (2026-05-18) over `GPL-2.0-or-later` because:

1. The Blender Extensions Platform officially **requires** GPL-3.0-or-later for
   add-ons (Blender 5.1 Manual, *Extension Licenses*) — the canonical bpy
   distribution venue; this choice keeps that door open at zero cost.
2. blender.org states GPLv3-or-later is the license for distributing Blender
   binaries; Blender developer forum: for add-ons "'GPLv3 or later' seems the
   best choice."
3. FSF actively recommends upgrading GPLv2→GPLv3 (explicit patent grant +
   termination cure period — pure upside for a solo author publishing public
   teaching code).
4. The only real reason to prefer GPLv2 (avoiding GPLv3's anti-tivoization /
   Installation-Information burden) is embedded/IoT-specific and inapplicable
   to pure Python scripts.
5. Blender is GPL-2.0-**or-later**, so a GPL-3.0-or-later choice is fully
   Blender-compatible (only GPLv2-**only** would be incompatible).

Confidence on the version choice: **L3** (anchored to official Blender docs +
FSF, multi-source). The upstream premise that bpy-linked redistributed code
must be GPL at all is **L2/L3** (anchored to the vcx integration-plan R5b +
Blender's published policy) — a legal eyeball is advised before any public
push. This is not legal advice.

## Relationship to the proprietary vcx repo

The `video_creation_x` repository root is **Proprietary**. These three scripts
`import bpy`, which created an existing latent tension inside that proprietary
repo. Re-publishing them here under GPL — by the copyright holder's election,
solely due to the bpy-API linkage — resolves that tension; it is not a new
constraint introduced by this split.

Provenance (see vcx integration-plan R5b): the coordinate/FOV math is the
Bartek Skorupa official lineage (a mathematical fact). **No** third-party GPL
`blender2ae` / `io_export_after_effects` source is imported or copied — these
are independent implementations. GPL applies here only because of the
`import bpy` linkage, not because of any copied GPL source.

## How it is distributed (license isolation)

The MIT `harness-engineering` resource pack's installer **fetches this
directory separately** and preserves `LICENSE` + `NOTICE` intact. The GPL
component lands in its own directory, never mixed into the MIT pack tree —
MIT and GPL artifacts stay license-isolated (dual-track, not a single mixed
license). See the vcx
`resource_packs/harness_engineering/LEGAL_GPL_PIPELINE.md` spec
(§3 directory orchestration, §4 installer dry-run, §3.2.1 version rationale).

## Files

- `LICENSE` — GNU GPL v3.0, FSF canonical verbatim (fetched from gnu.org)
- `NOTICE` — GPL provenance + license-isolation statement
- `*.py` — the three pipeline scripts (original bytes + prepended GPL header)
