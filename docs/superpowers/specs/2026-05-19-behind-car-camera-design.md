# Behind-Car Camera Rewrite — Design

**Date:** 2026-05-19
**Scope:** Replace existing isometric 45° chase camera with a true 3rd-person trailing camera. Sits behind + above the car, rotates with car heading, looks forward down the road. Matches reference (Initial-D / Mini Cooper coastal road).

## Problem

Current `Camera.js` keeps a fixed-world isometric offset (45° azimuth, 35° elevation, distance 16) and lerps the focal point inside a deadzone disk to add velocity lead. It does not rotate with the car. The visual effect is a top-down-ish arcade view, not the cinematic-following style the reference shows.

Reference shows the camera trailing the car in world space — when the car turns, the camera trails through the turn. Player sees the road ahead.

## Non-goals

- First-person / cockpit view
- Free-orbit camera (mouse drag)
- Cinematic crash/replay cam variations
- Photo mode
- Variable FOV based on speed (could add later — keep base FOV for now)
- Day/night-aware camera height
- Per-track camera presets

## Design

### Class shape stays the same

```javascript
new Camera()
cam.update( dt, vehicle )
cam.shake( magnitude, duration )
cam.camera  // THREE.PerspectiveCamera
```

`cam.update` signature changes from `(dt, target, velocity)` to `(dt, vehicle)`. Internally we pull what we need: heading quaternion + position + velocity.

main.js updates the call site to pass `vehicle`.

### Geometry

Each frame:

1. `carPos = vehicle.container.position` (Vector3).
2. `forward = (0, 0, 1).applyQuaternion(vehicle.container.quaternion)` — car-local forward in world space. Y-flatten and renormalize (we don't want vertical drift).
3. Desired camera position: `carPos - forward * TRAIL_DISTANCE + UP * TRAIL_HEIGHT`.
4. Desired lookAt point: `carPos + forward * LOOK_AHEAD + UP * LOOK_HEIGHT`.

Then:
- Smooth `camera.position` toward desired with exponential lerp (rate `POSITION_LERP`).
- Smooth a stored `smoothedLook` Vector3 toward desired lookAt (rate `LOOK_LERP`).
- `camera.lookAt(smoothedLook)`.

Two lerp rates because the lookAt should snap faster than the position (camera leans into turns slightly ahead of where the car body is).

On first frame, skip lerp — set both directly to desired.

### Shake (preserved)

Existing `shake()` API + per-frame jitter after `lookAt`. Unchanged behaviour.

### Velocity-based lookahead bonus (optional, simple version)

To make the camera "lean forward" when going fast, add a small offset to the lookAt point:

```javascript
const speed = vehicle.modelVelocity.length();
const speedFactor = Math.min( speed / SPEED_REF, 1 );
desiredLook.add( forward.clone().multiplyScalar( speedFactor * LOOK_SPEED_BONUS ) );
```

This pushes lookAt further ahead as you accelerate.

`SPEED_REF = 15` (m/s ≈ ~MAX_SPEED * SPEED_SCALE proportional), `LOOK_SPEED_BONUS = 4` m.

### Constants

```javascript
const TRAIL_DISTANCE = 7.0;
const TRAIL_HEIGHT = 3.0;
const LOOK_AHEAD = 5.0;
const LOOK_HEIGHT = 1.0;
const POSITION_LERP = 4.0;
const LOOK_LERP = 6.0;
const SPEED_REF = 15;
const LOOK_SPEED_BONUS = 4;
```

### Removed bits

- `offset` Vector3, `camRightXZ`, `camForwardXZ` — were used for iso math, not needed.
- `deadzoneRadius`, `screenShiftUp`, `leadFactor`, `cameraSmoothing` constants — replaced by new ones.
- `debug` ring helper (the magenta deadzone visualizer) — no longer applicable.

### Preserved

- `shake()` API
- Window resize handler
- FOV 40, near 0.1, far 60 — keep until we see if behind-cam needs more
- `THREE.PerspectiveCamera` instance + the `.camera` property

### Edge cases

- **Stopped car w/ no input**: `forward` derived from `container.quaternion`, not velocity. So camera stays behind even when stationary. Good.
- **Car spinning during drift**: camera trails through the spin. May feel disorienting at high yaw rates. If so, swap to slerping a stored `smoothedForward` so the camera lags behind the actual rotation. Optional polish.
- **Respawn**: `_initialized = false` reset on respawn so the camera snaps to the new position instead of lerping through the whole map. Hook: detect when `carPos` jumps by > 5 m in one frame, reset to initial state.
- **Car flips upside-down**: forward could end up below horizon. Y-flatten + renormalize prevents weird vertical drift, but pitch could still feel weird. Acceptable for now.

## Files touched

- Modify: `js/Camera.js` — full rewrite of constructor + update().
- Modify: `js/main.js:280` — change `cam.update(dt, vehicle.spherePos, _camLead)` to `cam.update(dt, vehicle)`. Also delete the `_camLead` temp vector + heading-derived lead logic (~10 lines).

## Acceptance criteria

1. ☐ Game loads. Camera sits behind the car at ~7 m back, ~3 m up, looking down the road past the car.
2. ☐ Drive forward → camera trails behind smoothly.
3. ☐ Steer left → camera swings through the turn, you see the road ahead in the new direction.
4. ☐ Drift/spin → camera tracks the heading rotation (may feel intense at full spin — acceptable).
5. ☐ Crash w/ shake → existing shake still works.
6. ☐ Respawn off-map → camera snaps to new position, no flying-through-scene tween.
7. ☐ Speed lines, drift score, day/night, headlights, all other features unchanged.
8. ☐ FPS still 60.

## Tuning

- Too far behind → `TRAIL_DISTANCE` 7→5.
- Too high / low → `TRAIL_HEIGHT` 3→ 2 (lower) or 5 (higher).
- LookAt too high → `LOOK_HEIGHT` 1→0.5.
- LookAt too short → `LOOK_AHEAD` 5→8.
- Cam too snappy → drop `POSITION_LERP` 4→2.
- Cam too floaty / draggy → bump `POSITION_LERP` 4→6.

## Out of scope (future)

- FOV punch when accelerating
- Hood-cam / cockpit option
- Photo mode free orbit
- Cinematic replay cam
- Per-track presets
