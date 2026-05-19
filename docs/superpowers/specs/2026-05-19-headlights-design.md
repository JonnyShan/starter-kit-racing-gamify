# Headlight Cones for Night Driving — Design

**Date:** 2026-05-19
**Scope:** Two SpotLights attached to the player vehicle pointing forward + slightly down. Intensity auto-fades with hemiLight (same pattern as Stars) so they're invisible by day and dramatic at night.

## Problem

Night mode shipped but the world goes near-black past 5 meters. Driving feels blind. Headlights complete the night feel and let the player race in the dark.

Vehicle GLB already has emissive headlight discs on the front — that's purely visual. Real SpotLights add the road-lighting cone.

## Non-goals

- Per-car custom light placement (Kenney trucks vary slightly; one fixed offset works for all)
- Tail lights / brake light glow at night
- Beam-on / beam-off toggle (always on at night, off by day)
- Volumetric light scattering (no fog interaction beyond hemi falloff)
- High beams variant
- Other vehicles (NPC trucks) getting headlights

## Design

### Module `js/Headlights.js`

```javascript
new Headlights( scene, vehicle, hemiLight )
update( dt )
dispose()
```

Constructor creates 2 `THREE.SpotLight` + 2 `THREE.Object3D` targets, parents them to `vehicle.container` so they ride with the car. Adds nothing to scene root (children of vehicle container are already in scene transitively).

### Light positions

Left light:
- Position: `(-HEADLIGHT_OFFSET_X, HEADLIGHT_OFFSET_Y, HEADLIGHT_OFFSET_Z)` in container-local
- Target: `(-HEADLIGHT_OFFSET_X, HEADLIGHT_TARGET_Y, HEADLIGHT_TARGET_Z)`

Right light:
- Position: `(+HEADLIGHT_OFFSET_X, HEADLIGHT_OFFSET_Y, HEADLIGHT_OFFSET_Z)`
- Target: `(+HEADLIGHT_OFFSET_X, HEADLIGHT_TARGET_Y, HEADLIGHT_TARGET_Z)`

Target Y below 0 + Z forward ≈ cone aims forward-down at road.

### Light parameters

```javascript
new THREE.SpotLight(
    HEADLIGHT_COLOR,
    0, // intensity set in update()
    HEADLIGHT_DISTANCE,
    HEADLIGHT_ANGLE,
    HEADLIGHT_PENUMBRA,
    HEADLIGHT_DECAY,
);
spotLight.castShadow = false;
```

- Color: warm white `0xfffae0`
- Max intensity: 8 (at full night)
- Distance: 25 (range over which light falls off)
- Angle: `Math.PI / 8` (≈22.5° cone half-angle → 45° full)
- Penumbra: 0.3 (soft edge)
- Decay: 1 (linear fall-off, cheaper than physically correct 2)

`castShadow = false` — two shadowed spotlights would tank perf and reading-clarity in a 3rd-person racer doesn't need them.

### Auto-fade by hemiLight

Each frame:
```
const nightT = THREE.MathUtils.clamp(
    1 - ( hemiLight.intensity - HEMI_NIGHT ) / ( HEMI_DAY - HEMI_NIGHT ),
    0, 1
);
leftLight.intensity = nightT * HEADLIGHT_MAX_INTENSITY;
rightLight.intensity = nightT * HEADLIGHT_MAX_INTENSITY;
```

`nightT === 0` at day (intensity 0, light effectively off).
`nightT === 1` at night (intensity 8, full beam).

### Constants

```javascript
const HEADLIGHT_OFFSET_X = 0.4;
const HEADLIGHT_OFFSET_Y = 0.3;
const HEADLIGHT_OFFSET_Z = 0.4;
const HEADLIGHT_TARGET_Y = -1.0;
const HEADLIGHT_TARGET_Z = 8.0;
const HEADLIGHT_COLOR = 0xfffae0;
const HEADLIGHT_MAX_INTENSITY = 8;
const HEADLIGHT_DISTANCE = 25;
const HEADLIGHT_ANGLE = Math.PI / 8;
const HEADLIGHT_PENUMBRA = 0.3;
const HEADLIGHT_DECAY = 1;
const HEMI_DAY = 1.8;
const HEMI_NIGHT = 0.3;
```

### Wiring

In main.js, after `vehicle` is initialized and added to scene (inside `init`, where `vehicle.init( models[ ... ] )` is called):

```javascript
const headlights = new Headlights( scene, vehicle, hemiLight );
```

In render loop:

```javascript
headlights.update( dt );
```

### Edge cases

- **Headlights stay perfectly forward as car rotates** — they're children of `container`, which rotates as a whole on Y for steering. No per-wheel articulation needed.
- **Body roll** — `bodyNode` is what tilts during drift; lights on container don't tilt with the body. That's correct: headlights stay road-relative, not body-relative.
- **Falling-off-world** — container resets to `(3.5, 0, 5)`. Lights teleport with it. No issue.

## Files touched

**Created:**
- `js/Headlights.js` (~90 LOC)

**Modified:**
- `js/main.js` — import + instantiate + drive update. ~3 LOC.

## Acceptance criteria

1. ☐ Day mode: no visible cone (intensity 0).
2. ☐ Toggle to night → two cones appear lighting the road forward of the car.
3. ☐ Cones turn with the car as you steer.
4. ☐ Cones illuminate road, bollards, trees, ground within ~25 m.
5. ☐ FPS still 60.
6. ☐ No shadow popping (no shadow maps from spotlights).
7. ☐ Drift / lap / ghost / drift score / petals / stars / moon all unchanged.
8. ☐ Toggling N back to day → cones fade out.

## Tuning

- Too dim → bump `HEADLIGHT_MAX_INTENSITY` 8→12.
- Cone too narrow → bump `HEADLIGHT_ANGLE` `PI/8` → `PI/6`.
- Cone reaches too far / not far enough → adjust `HEADLIGHT_DISTANCE` 25 ± 10.
- Cones aim wrong → adjust `HEADLIGHT_TARGET_Y` (negative = aim down) and `HEADLIGHT_TARGET_Z` (forward distance to look at).
- Too warm/cool → tweak `HEADLIGHT_COLOR`.

## Out of scope

- Tail lights at night
- Beam toggle key
- High beam mode
- Volumetric haze cone
- NPC truck headlights
- Per-car headlight position offset
