# Sakura Petals Falling — Design

**Date:** 2026-05-19
**Scope:** Pink petal particle system that continuously drifts down across the scene around the camera. Pure ambient atmosphere.

## Problem

Day atmosphere + pink forest exist, but the air between trees is empty. Reference shows scattered falling petals as an ambient detail that ties the sakura biome together. Pure visual polish.

## Non-goals

- Petals settling on ground / sticking to surfaces
- Petals colliding with the car or being kicked up by its motion
- Per-petal rotation animation
- Wind-gust events / variable density
- Day/night auto-toggle (petals always on)

## Design

### Module `js/Petals.js`

Exports `Petals` class. Single responsibility: petal particle field.

```javascript
new Petals( scene )
petals.update( dt, cameraPosition )
petals.dispose()
```

Constructor:
- Allocates Float32Arrays for position (3 × COUNT) and phase (1 × COUNT).
- Builds petal texture (canvas-generated alpha oval).
- Creates `THREE.BufferGeometry` + `THREE.PointsMaterial` + `THREE.Points`.
- Adds points object to scene.
- Initializes all petal positions randomly within a column above the camera origin (camera position is `(0,0,0)` at start; first `update()` will re-anchor).

### Petal motion

Each frame in `update(dt, cameraPosition)`:

For each petal `i`:
1. `y -= dt * PETAL_FALL_SPEED`
2. `x += Math.sin( time + phase[i] ) * dt * PETAL_SWAY_AMPLITUDE`
3. If `y < PETAL_BOTTOM_Y` → respawn at top: `y = PETAL_TOP_Y`, new random `(x, z)` within `PETAL_FIELD_RADIUS` of camera.
4. If `|x - cameraX| > PETAL_FIELD_RADIUS` or `|z - cameraZ| > PETAL_FIELD_RADIUS` → respawn (random fresh position in column above camera).

After loop, set `posAttr.needsUpdate = true`.

`time` is a class-internal accumulator: `this._time += dt`.

### Petal texture (canvas-generated, one-time)

```
const size = 64;
canvas = 64×64
ctx.fillStyle = transparent
draw ellipse: center (32, 32), radius x 18, radius y 12
gradient: rgba(255,255,255,1) → rgba(255,255,255,0)
```

The texture is alpha + white. Pink color comes from `PointsMaterial.color = 0xffb7c5`.

### PointsMaterial

```javascript
new THREE.PointsMaterial( {
	map: petalTexture,
	color: 0xffb7c5,
	size: 0.4,
	sizeAttenuation: true,
	transparent: true,
	depthWrite: false,
} )
```

No custom shader injection needed (unlike SmokeTrails) — all petals same size, same opacity. Simpler than the existing smoke module.

### Initial respawn within camera radius

Helper `_respawn(i, cameraX, cameraZ)`:
```javascript
positions[i*3 + 0] = cameraX + ( Math.random() - 0.5 ) * 2 * PETAL_FIELD_RADIUS;
positions[i*3 + 1] = PETAL_TOP_Y + Math.random() * 5;
positions[i*3 + 2] = cameraZ + ( Math.random() - 0.5 ) * 2 * PETAL_FIELD_RADIUS;
```

For the very first call before the player has moved, cameraX/Z are 0 → field centered on origin. After first frame everything re-centers around the camera as expected.

### dispose

Remove Points from scene, dispose geometry + material + texture.

## Constants (top of Petals.js)

```javascript
const PETAL_COUNT = 200;
const PETAL_FALL_SPEED = 1.5;
const PETAL_SWAY_AMPLITUDE = 0.3;
const PETAL_SIZE = 0.4;
const PETAL_FIELD_RADIUS = 30;
const PETAL_TOP_Y = 25;
const PETAL_BOTTOM_Y = 0;
const PETAL_COLOR = 0xffb7c5;
```

## Files touched

**Created:**
- `js/Petals.js` (~90 LOC)

**Modified:**
- `js/main.js` — import, instantiate in `init()` after scene exists, drive `petals.update(dt, cam.camera.position)` in render loop. ~3 LOC.

## Acceptance criteria

Verified in browser:

1. ☐ On load, pink petals visible drifting down across the scene.
2. ☐ ~200 petals at once, well-distributed in air column around camera.
3. ☐ Petals descend slowly with gentle sideways sway.
4. ☐ Drive far in any direction → petals follow the camera (no "out of petals" zone).
5. ☐ Petals that hit ground respawn at top (no piling up below).
6. ☐ Petals visible against road, grass, sky, trees — pink reads everywhere.
7. ☐ FPS still 60.
8. ☐ Drift, lap timer, ghost, atmosphere, blossoms, bollards, drift score unchanged.

## Tuning

- Too sparse → bump `PETAL_COUNT` 200→400.
- Too dense → drop 200→100.
- Falling too fast → drop `PETAL_FALL_SPEED` 1.5→0.7.
- Sway too jittery → drop `PETAL_SWAY_AMPLITUDE` 0.3→0.15.
- Petals too small → bump `PETAL_SIZE` 0.4→0.6.
- Field too small (visible despawn at edges) → bump `PETAL_FIELD_RADIUS` 30→50.

## Out of scope

- Settling petals on ground
- Per-petal rotation
- Wind gust system
- Petals affected by car wake
- Day/night auto-off
- Multi-color petal variants
- Petal interaction with weather toggle
