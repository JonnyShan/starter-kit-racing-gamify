# Day Atmosphere Flip — Design

**Date:** 2026-05-19
**Scope:** Convert grey night scene to bright sunny anime-mountain-pass day scene. Atmosphere only — no new GLB models, no decorations, no new track pieces, no bollards.
**Reference:** User-supplied screenshots — stylized AE86 anime drift game w/ cherry blossoms, vivid grass, blue sky w/ soft clouds, warm sunlight. Forza Horizon × Studio Ghibli × Initial-D feel.

## Problem

Current scene is night/overcast: `scene.background = 0xadb2ba` (grey), matching grey fog, cool white DirLight, no sky geometry, no ground geometry (track GLBs sit on void hidden by close fog). Mood is dark/serious. Reference style is bright/cheerful sunny mountain pass.

Goal: ship a foundation atmosphere change so the game feels day, sunny, anime, without committing to new asset pipelines (trees / bollards / road decals all deferred).

## Non-goals

Per brainstorm pick:
- No new GLB models (cherry blossom variant, bollards, guardrails)
- No road line decals
- No skybox HDRI
- No grass instances / 3D foliage
- No mountain geometry — distant hills implied via fog fade only
- No headlight on/off toggle — current emissive will read OK against bright sky

## Design

### 1. Sky — gradient skydome (`js/Sky.js`)

New module `js/Sky.js` exporting `Sky` class. Encapsulates skydome + clouds.

**Skydome:** `IcosahedronGeometry(500, 4)`, BackSide ShaderMaterial. Vertex shader passes world-space Y to fragment. Fragment lerps between two colors based on normalized Y.

- `topColor = 0x4a7fc1` (deep sky blue)
- `bottomColor = 0xc8e2ff` (pale horizon blue, matches fog)
- Lerp curve: `t = clamp(y / 500 + 0.3, 0, 1)` then `smoothstep(0, 1, t)` so horizon band is wider than a linear gradient.

Skydome added directly to scene at world origin. Radius 500 is large enough that the player is always inside it; no need to parent to camera. Avoids the "camera must be in scene" pitfall. `frustumCulled = false`, `renderOrder = -10`, `material.depthWrite = false`, `material.fog = false`.

### 2. Clouds — sprite billboards (`js/Sky.js`)

8 PlaneGeometry quads, each ~80x40 units, scattered in upper hemisphere at radius ~300 from origin. Y between 80-180. Random rotation around camera-Y.

**Cloud texture:** generated once at startup via `OffscreenCanvas` (or document.createElement('canvas')). Draw 12-15 white-ish radial gradients with random radii at random offsets to build a fluffy alpha shape. Convert to `CanvasTexture`. ~40 lines of canvas code; no external image asset.

Material: `MeshBasicMaterial({ map, transparent: true, depthWrite: false })`, color tinted slightly warm `0xfffaf0`.

Drift: each frame, `cloud.position.x += dt * 0.5`. Wrap when exceeds bound (subtract 600 to wrap to other side).

Clouds parented to scene (not camera) so they pass by realistically as player moves.

### 3. Ground plane (`js/main.js`)

Add a flat `PlaneGeometry(groundSize * 4, groundSize * 4)` rotated to lie on XZ plane, positioned at y = -0.15 (just below the existing physics ground at y = -0.125). Material: `MeshLambertMaterial({ color: 0x6fa84a })` — vivid grass green. `receiveShadow = true`.

Placed in `loadTrack` after bounds compute but before probe baking, so probes pick up the green bounce.

### 4. Lighting (`js/main.js`)

Replace existing values:

```javascript
// DirLight: warmer + stronger sun
const dirLight = new THREE.DirectionalLight( 0xfff2d6, 4 );

// HemiLight: brighter sky blue, vivid green ground bounce
const hemiLight = new THREE.HemisphereLight( 0xa3d4ff, 0x6fa84a, 1.8 );
```

DirLight position unchanged. Shadow params unchanged.

### 5. Fog (`js/main.js`)

```javascript
scene.fog = new THREE.Fog( 0xc8e2ff, 30, 55 );
// Then in loadTrack:
scene.fog.near = groundSize * 0.6;
scene.fog.far = groundSize * 1.5;
```

Far pushed out (was `* 0.8`) so distant green ground/sky are visible — implies far hills via atmospheric fade.

### 6. Background

```javascript
scene.background = new THREE.Color( 0xc8e2ff );  // pale horizon (visible behind transparent skydome bottom edge / if skydome fails to render)
```

Actual sky comes from skydome; this is fallback.

### 7. Tonemap + bloom

```javascript
renderer.toneMappingExposure = 1.05;  // was 1.0
bloomPass.strength = 0.05;  // was 0.02 — slightly more sun bloom
// radius, threshold unchanged
```

### 8. Skydome lifecycle

`Sky` constructor takes `scene` only. Adds both skydome and cloud group to scene. Stores them on `this`. Method `update(dt, cameraPosition)` drifts clouds and translates the cloud group's parent so clouds stay relative to camera horizontally (only x/z follow camera, y stays absolute) — keeps clouds visible regardless of how far player drives. Method `dispose()` removes everything if scene swapped (not needed yet but cheap to write).

Initialized in main.js after scene + camera exist, before render loop.

In render loop, call `sky.update(dt)` alongside existing updates.

## Files touched

- **Create:** `js/Sky.js` (~120 lines: skydome shader, cloud canvas gen, cloud field, update)
- **Modify:** `js/main.js` — lighting colors/intensities (lines 22-49), scene.background + fog (lines 34-36), ground plane added in loadTrack, sky import + instantiation + update call (5 sites)

No edits to: `Vehicle.js`, `Controls.js`, `Track.js`, `Physics.js`, `Particles.js`, `DriftMarks.js`, `Audio.js`, `LapTimer.js`, `Loader.js`.

## Tuning constants (top of Sky.js + grouped block in main.js)

In `Sky.js`:

```javascript
const SKY_TOP_COLOR = 0x4a7fc1;
const SKY_BOTTOM_COLOR = 0xc8e2ff;
const SKY_HORIZON_OFFSET = 0.3;
const SKY_RADIUS = 500;
const CLOUD_COUNT = 8;
const CLOUD_SIZE_MIN = 60;
const CLOUD_SIZE_MAX = 110;
const CLOUD_RING_RADIUS = 300;
const CLOUD_HEIGHT_MIN = 80;
const CLOUD_HEIGHT_MAX = 180;
const CLOUD_DRIFT_SPEED = 0.5;
const CLOUD_TINT = 0xfffaf0;
```

In `main.js` (group near other constants if any, else top of file):

```javascript
const SUN_COLOR = 0xfff2d6;
const SUN_INTENSITY = 4;
const SKY_AMBIENT = 0xa3d4ff;
const GROUND_AMBIENT = 0x6fa84a;
const AMBIENT_INTENSITY = 1.8;
const FOG_COLOR = 0xc8e2ff;
const GROUND_COLOR = 0x6fa84a;
```

All tunable without hunting through logic. Karpathy guideline.

## Acceptance criteria

Verified in browser by user:

1. Loading game shows bright blue sky w/ gradient (deep top, pale horizon), not grey.
2. 6-8 soft fluffy clouds visible, drifting slowly from one horizon to the other.
3. Ground beyond track edges is vivid green grass color, not void/grey.
4. Sunlight feels warm — car body and road have warm cast, not cool.
5. Distance fades to pale blue (atmospheric perspective), not grey fog wall.
6. No FPS regression — should still hit 60 on the test machine.
7. Drift, lap timer, drift marks, minimap, audio unchanged in behaviour.
8. No flicker / z-fighting between ground plane and existing track GLBs (ground at y=-0.15, track at y=-0.5 group offset).

## Risks

- **LightProbeGrid baking** captures scene state at bake time. After atmosphere flip, probes will store bright blue/green bounce. If baking order matters and ground/sky aren't added before bake, indirect lighting will be wrong. Mitigation: add ground plane + sky BEFORE `probes.bake()` call in loadTrack.
- **Cloud sprite billboard direction** if not facing camera correctly will look like flat panes. Mitigation: use `sprite.lookAt(camera.position)` each frame, OR use `THREE.Sprite` instead of PlaneGeometry. **Decision:** use `THREE.Sprite` — automatic camera-facing, simpler code.
- **Skydome z-fighting w/ fog** if skydome is inside fog far distance. Fix: `material.fog = false` on skydome material so fog doesn't tint sky.
- **Cloud passes through trees / decorations** when player drives near edges. Clouds at y >= 80, decorations at y ~0–5. No clipping risk.

## Out of scope (next visual passes)

- Cherry blossom tree variant (recolor decoration-forest, ~30 min)
- Red/white corner bollards (procedural cylinders w/ stripe material)
- Yellow center + white side road lines (track GLB texture swap or decal overlay)
- Distance mountain silhouettes (low-poly skirt geometry)
- Grass blade instances (InstancedMesh near road edges)
- Day/night cycle toggle
- Sun lens flare
