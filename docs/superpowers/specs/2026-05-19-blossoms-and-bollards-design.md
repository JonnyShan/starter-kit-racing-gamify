# Cherry Blossoms + Corner Bollards — Design

**Date:** 2026-05-19
**Scope:** Recolor all forest trees pink (sakura) and add procedural red/white striped bollards along the outer arc of each track-corner cell. Pure visual additions.

## Problem

The day-atmosphere flip turned the scene sunny and green but the trees still render in the original green forest colormap. Reference images show pink cherry blossom trees and red/white safety bollards lining mountain-pass corners. These are the two highest-visibility gaps versus the reference.

## Non-goals

Per brainstorm picks:
- Mixed pink/green forest variants (going all-pink for simplicity)
- Bollards on straights / all track piece edges (corners only)
- Single-apex bollard (going with 5 per corner)
- Physics on bollards (they remain visual; outer wall colliders already handle crashes)
- Day/night swap for blossom color
- Bloom configuration per blossom

## Design

### Part A — Pink colormap shift for the forest

`decoration-forest.glb` is a single mesh that samples colors from the shared 512×512 `models/Textures/colormap.png`. Foliage is a green-dominant region of the texture; trunks are brown. Mesh-level recolor is impossible (one merged mesh, one material). The fix is at the texture level: build a pink-shifted variant and assign it to the forest material only.

**Sakura texture construction (one-time at startup):**
1. Load `models/Textures/colormap.png` into an `HTMLImageElement`, wait for `onload`.
2. Draw to a 512×512 `OffscreenCanvas` (or regular canvas).
3. Read `ImageData.data`.
4. For each pixel `(r, g, b, a)`, detect green-dominant:
   ```
   isGreen = g > GREEN_MIN && g > r + GREEN_DELTA && g > b + GREEN_DELTA
   ```
5. If green, replace using the original `g` as a brightness factor:
   ```
   factor = g / 255
   r' = SAKURA_R * factor
   g' = SAKURA_G * factor
   b' = SAKURA_B * factor
   ```
   Preserves shading variation.
6. Build `THREE.CanvasTexture` from the canvas, `colorSpace = SRGBColorSpace`, `flipY = false` (matching `sharedColormap`).
7. Return the texture.

**Material patch on forest model:**
After `decoration-forest` GLB loads, traverse meshes; for each `Mesh`, clone its material, set `material.map = sakuraTexture`, assign back. Other models (`decoration-tents`, vehicles) unaffected.

Constants (top of new `js/SakuraTexture.js`):
```javascript
const SAKURA_R = 255;
const SAKURA_G = 183;
const SAKURA_B = 197;
const GREEN_MIN = 80;
const GREEN_DELTA = 15;
```

### Part B — Procedural corner bollards

Per `CLAUDE.md`: corner-cell wall colliders are arcs with center at local `(-CELL_HALF, +CELL_HALF)` and outer wall radius `2 * CELL_HALF - 0.25`. Cell size is `CELL_RAW * GRID_SCALE = 9.99 * 0.75 = 7.4925` world units. `CELL_HALF` here refers to the raw half (4.995); after the `GRID_SCALE = 0.75` track-group scaling, all positions are scaled.

Bollard placement is **inside** the outer wall by `BOLLARD_OFFSET` so it sits at the visible track edge.

**Cylinder geometry:** `CylinderGeometry(0.12, 0.12, 1.0, 12)` — single geometry instance, reused for all bollards.

**Striped texture (canvas-generated, one-time):**
- 32×128 canvas. Fill red `#c43a2c`. Paint three horizontal white bands at y = 18, 60, 100 (each 12px tall).
- `CanvasTexture`, `colorSpace = SRGBColorSpace`. Wrap repeat OK (no wrap needed since single application).
- Material: `MeshLambertMaterial({ map })`. Picks up scene lighting → reads as sunlit.

**Placement algorithm (per corner cell):**
1. Compute cell origin in world space (matches existing track-piece placement: `(gx + 0.5) * CELL_RAW * GRID_SCALE`, world y = track-group offset).
2. Determine cell-local arc center based on orientation `orient ∈ {0, 10, 16, 22}` → degrees `{0, 180, 90, 270}`.
   - Local arc center default (orient 0): `(-CELL_HALF, 0, +CELL_HALF)` in cell-local XZ.
   - Rotate this by `ORIENT_DEG[orient]` around cell center.
3. For each of `BOLLARDS_PER_CORNER` angles spread along the outer 90° arc:
   - Angles: `[ 5°, 25°, 45°, 65°, 85° ]` from the start edge of the arc (avoiding extreme ends near adjacent walls).
   - Compute world position: arc center + `(outer_radius - BOLLARD_OFFSET) * (cos θ, sin θ)` in cell-local XZ, then transform to world.
   - Y position: `BOLLARD_HEIGHT / 2 + 0.05` so cylinder base sits just above ground plane.

**Render via InstancedMesh:**
- Count = number of corners × BOLLARDS_PER_CORNER.
- One InstancedMesh per track build. `castShadow = true`, `receiveShadow = false`.

**Module: `js/Bollards.js`**
```javascript
export function buildBollards( scene, cells ) { ... }
```
Returns the InstancedMesh (added to scene internally). Caller doesn't store unless dispose needed.

Constants:
```javascript
const BOLLARD_RADIUS = 0.12;
const BOLLARD_HEIGHT = 1.0;
const BOLLARDS_PER_CORNER = 5;
const BOLLARD_OFFSET = 0.5;
const BOLLARD_BASE_LIFT = 0.05;
const STRIPE_RED = '#c43a2c';
const STRIPE_WHITE = '#ffffff';
```

## Files touched

**Created:**
- `js/SakuraTexture.js` — async builder for the pink-shifted colormap.
- `js/Bollards.js` — cylinder/InstancedMesh builder for corner bollards.

**Modified:**
- `js/main.js` — in `loadModels`, after all GLBs load, await sakura texture build, then patch `decoration-forest` material. In `loadTrack`, after `buildTrack`, call `buildBollards(scene, customCells || TRACK_CELLS)`.

No edits to: `Track.js`, `Physics.js`, `Vehicle.js`, `Controls.js`, `Sky.js`, `Ghost.js`, `LapTimer.js`, `DriftMarks.js`, `Particles.js`, `Audio.js`, `Loader.js`.

## Acceptance criteria

Verified by user in browser:

1. ☐ All forest trees render in pink/sakura instead of green. Trunks remain brown.
2. ☐ Tents and other decorations (if any) unaffected.
3. ☐ Each track-corner cell has ~5 red bollards with horizontal white stripes lining the outer arc.
4. ☐ Bollards stand upright, base on ground, top approx 1m high.
5. ☐ Bollards do not block player car (no collision — wall colliders still take the hit).
6. ☐ Vehicle GLBs unchanged in color.
7. ☐ FPS still 60. Instanced bollards + one extra texture should not move the needle.
8. ☐ Drift, lap timer, ghost car, day atmosphere unchanged in behaviour.

## Risks

- **Green threshold mis-detection.** If `colormap.png` has greens used for non-foliage (e.g., a green vehicle body color region), those will become pink too. Mitigation: visually verify; if leakage seen, tighten `GREEN_MIN` to 120 or `GREEN_DELTA` to 30. Quick to tune.
- **Arc orientation math sign.** `ORIENT_DEG` maps Godot indices to world degrees; the arc center default direction must rotate consistently. Mitigation: verify visually on first corner; if bollards appear inside the track or on wrong side, flip the sign or rotate by 180°.
- **Texture load timing.** Sakura builder needs the colormap PNG fully decoded. `HTMLImageElement.onload` is the explicit gate. Tied into `loadModels`' overall Promise chain so race-free.
- **InstancedMesh.setMatrixAt** must be followed by `inst.instanceMatrix.needsUpdate = true` once after all matrices set. Standard three.js, easy to forget.

## Tuning candidates

- Sakura too bright/saturated → drop `SAKURA_R` 255→240, `SAKURA_G` 183→160.
- Too few bollards per corner → bump `BOLLARDS_PER_CORNER` 5→7.
- Bollards too thin → bump `BOLLARD_RADIUS` 0.12→0.18.
- Bollards sit inside the wall → drop `BOLLARD_OFFSET` 0.5→0.2.
- Greens leaking onto non-foliage → tighten `GREEN_MIN` to 120 or `GREEN_DELTA` to 30.

## Out of scope (future)

- Mix of pink + green trees (50/50 split)
- Per-tree scale jitter / wind sway
- Animated bollard reflectors (specular highlights)
- Different bollard variants (cones, K-rails)
- Day/night blossom color (e.g., glowing white at night)
- Falling petal particles
