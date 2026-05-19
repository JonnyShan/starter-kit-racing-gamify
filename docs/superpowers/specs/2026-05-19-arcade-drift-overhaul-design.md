# Arcade Drift Overhaul — Design

**Date:** 2026-05-19
**Scope:** Replace scalar drift heuristic with slip-angle physics + handbrake input. Arcade Initial-D feel.
**Files touched:** `js/Vehicle.js`, `js/Controls.js`, `js/main.js`. No new files.

## Problem

Current vehicle model uses a single scalar `linearSpeed` along car-forward, with angular yaw lerped toward steering input. "Drift" is detected as the delta between `linearSpeed` and an accumulator `acceleration`, plus body roll. There is no sideways velocity, no slip angle, no input to break rear grip. Result: car cannot slide; the DRIFT badge fires off body lean from steering, not from actual sliding.

Goal: car can slide sideways through corners, holding handbrake (Space) breaks rear grip and initiates the slide, releasing restores grip. Existing skid audio, drift marks, smoke, and DRIFT badge all auto-upgrade because they already key off `vehicle.driftIntensity`.

## Non-goals

Per brainstorm: no counter-steer assist, no drift score / chain UI, no boost from drift, no full tire-curve sim, no new track, no ghost car. Strictly the drift feel.

## Design

### State on Vehicle

Add three fields:

- `lateralSpeed` (Number) — sideways velocity in car-local space. Positive = car-right.
- `handbrake` (Boolean, transient input) — set from controls each frame.
- `prevHandbrake` (Boolean) — previous frame's handbrake, for rising-edge detection of chuck-in.

Keep existing `linearSpeed`, `angularSpeed`, `acceleration`, `driftIntensity`. Their semantics stay; `driftIntensity` formula changes.

### Physics step (replaces lines ~175-202 of `Vehicle.js`)

Each frame (keyboard/gamepad branch):

1. **Throttle / brake** — same as today on `linearSpeed`.
2. **Compute grips:**
   - `rearGrip = handbrake ? 0.6 : 5.0`
   - `slipMag = Math.abs(lateralSpeed) / (Math.abs(linearSpeed) + 0.1)` — normalised slip (0..~1+)
   - `frontGrip = THREE.MathUtils.lerp(4.0, 1.5, THREE.MathUtils.clamp(slipMag, 0, 1))` — steering authority drops when sliding hard.
3. **Steering yaw** — same shape as today, but multiplier uses `frontGrip` instead of fixed 4:
   `targetAngular = -inputX * steeringGrip * frontGrip * direction`.
4. **Chuck-in kick (one-shot on handbrake press):**
   When `handbrake && !prevHandbrake && |linearSpeed| > 0.2`:
   `lateralSpeed += inputX * linearSpeed * CHUCK_IN_KICK` — instantly throws rear out in steering direction.
   Set `prevHandbrake = handbrake` at end of frame.
5. **Lateral decay:**
   `lateralSpeed *= Math.max(0, 1 - rearGrip * dt)` — high grip kills slide fast, low grip preserves it.
6. **Lateral coupling to yaw:**
   Drag car heading toward velocity direction so it doesn't spin freely. Explicit formula:
   ```
   const slipDir = Math.atan2(lateralSpeed, linearSpeed);   // signed slip angle
   const couplingRate = YAW_COUPLING * rearGrip * Math.min(slipMag, 1);
   container.rotateY(slipDir * couplingRate * dt);
   ```
   Effect: when sliding right (positive slipDir), heading yaws right toward travel direction. High grip = snaps back fast. Low grip (handbrake) = stays drifted.

### Physics push to rigid body (replaces drive impulse, lines ~215-232)

Today: angular velocity on the sphere is set from `_right * drive` (forward push only). Change to push both forward and lateral:

```
const fwdDrive = linearSpeed * 100 * dt;
const latDrive = lateralSpeed * 100 * dt;
angvel[0] += _right.x * fwdDrive  - _forward.x * latDrive;
angvel[2] += _right.z * fwdDrive  - _forward.z * latDrive;
```

(Sphere is rolled forward by torque around the right axis; lateral motion rolls around the forward axis — sign chosen so positive `lateralSpeed` pushes car to its right.)

### driftIntensity formula change (line ~284)

Old:
```
driftIntensity = |linearSpeed - acceleration| + 2 * |bodyNode.rotation.z|
```

New:
```
const speedAbs = Math.abs(linearSpeed);
const slipAngleAbs = speedAbs > 0.05
    ? Math.abs(Math.atan2(lateralSpeed, linearSpeed))
    : 0;
driftIntensity = slipAngleAbs * speedAbs * 2.5;
```

Scale `2.5` chosen so a 30° slide at MAX_SPEED hits ~2.0 — matches existing `INTENSITY_MAX = 2.0` in `DriftMarks.js` and skid audio thresholds. No changes needed downstream.

### Visual: rear-wheel spin-up

In `updateWheels`, when `handbrake` is true, add extra to `wheelBL/BR.rotation.x`:
```
const extra = handbrake ? 0.6 : 0;
wheelBL.rotation.x += extra;
wheelBR.rotation.x += extra;
```
Adds visible burnout. ~6 lines.

### Body lean

`updateBody` already rolls Z from `inputX * linearSpeed`. Augment with slip:
```
this.bodyNode.rotation.z = lerpAngle(
    this.bodyNode.rotation.z,
    -(inputX / 5) * linearSpeed - lateralSpeed * 0.3,
    dt * 5
);
```
Car visibly leans into the slide.

### Controls

`Controls.js`:
- Add `this.handbrake = false`.
- Keyboard: `Space` → handbrake.
- Gamepad: button index 0 (A on Xbox / cross on PS) → handbrake.
- Touch: out of scope (touch is auto-gas joystick; skip handbrake for now — flag as future work).

`update()` return object becomes `{ x, z, handbrake, touchActive }`.

### main.js

Already passes the full input object to `vehicle.update`. No change beyond the new field flowing through.

### Reset on respawn

When `spherePos.y < -10` reset block fires, also zero `lateralSpeed`.

## Edge cases

- **Touch joystick branch** uses world-space targeting; lateral physics from keyboard branch would conflict. Decision: touch branch keeps current behaviour (no handbrake, no lateral) — `lateralSpeed` is only updated in the keyboard/gamepad branch. Touch users get the existing arcade feel.
- **Reverse drift:** when `linearSpeed < 0`, chuck-in kick direction inverts naturally because `inputX * linearSpeed` flips sign. Tested-in-design only; will verify in browser.
- **Stuck sideways:** if `linearSpeed → 0` while `lateralSpeed` is nonzero, the coupling step rotates heading toward velocity, dragging lateral into linear over a few frames. No deadlock.

## Tuning constants (single source of truth at top of Vehicle.js)

```
const REAR_GRIP_NORMAL = 5.0;
const REAR_GRIP_HANDBRAKE = 0.6;
const FRONT_GRIP_GRIP = 4.0;
const FRONT_GRIP_SLIDE = 1.5;
const CHUCK_IN_KICK = 0.8;
const YAW_COUPLING = 3.0;
```

All in one block so feel is tunable without hunting through code. Karpathy guideline: every magic number named.

## Acceptance criteria

Verified by driving in browser (per `verification-before-completion`):

1. Without handbrake, car corners like before — no surprise sideways slip on normal driving.
2. Holding W + Space + A/D at speed → car slides into corner, DRIFT badge appears, smoke fires, marks paint.
3. Releasing Space mid-slide → car recovers to grip within ~1 second of straight-line.
4. Skid audio loop volume tracks slide intensity (already wired — verifies driftIntensity scale is right).
5. Touch controls still work, unchanged behaviour.
6. No regressions in lap timer / drift marks persistence / minimap.
7. FPS unchanged at 60 (no new allocations in hot path — reuse `_forward`, `_right` temps).

## Out of scope (future)

- Ghost car replay (separate spec).
- Drift score UI.
- Touch handbrake button.
- Countryside track / graphics pass.
- AI rivals.
