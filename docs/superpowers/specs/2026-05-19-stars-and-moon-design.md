# Stars + Moon for Night Mode — Design

**Date:** 2026-05-19
**Scope:** Star field + moon billboard that auto-fades in when the scene gets dark. Driven by `hemiLight.intensity` so it works with the just-shipped day/night toggle without explicit coupling.

## Problem

Day/night toggle ships a moody-dark night scene. Sky is empty deep blue. Night needs stars + moon to read as "night" instead of "overcast dusk".

## Non-goals

- Astronomical accuracy
- Moon phases / waxing-waning
- Day-time stars (e.g. eclipse)
- Moonlight casting on car / shadow
- Constellation patterns
- Twinkle / sparkle on individual stars
- Multi-moon variants

## Design

### Module `js/Stars.js`

```javascript
new Stars( scene, hemiLight )
update( dt )
dispose()
```

Constructor builds two things:
1. **Star field** — 400 white-ish `THREE.Points` on the inside of a dome above the horizon. Random positions on a hemisphere of radius 480 (just inside the 500-radius skydome).
2. **Moon** — single `THREE.Sprite` with a procedural canvas texture (soft white-yellow disc with subtle outer glow). Positioned at a fixed offset above one horizon.

Both added to `scene` at construction. Initial opacity 0.

### Auto-fade

Each frame:
```
const opacity = THREE.MathUtils.clamp(
    1 - ( hemiLight.intensity - 0.3 ) / ( 1.8 - 0.3 ),
    0, 1
);
```

When `hemiLight.intensity === 0.3` (NIGHT preset) → opacity 1.
When `hemiLight.intensity === 1.8` (DAY preset) → opacity 0.

Assigned to both:
- `stars.material.opacity = opacity`
- `moon.material.opacity = opacity`

Both materials are `transparent: true`, `depthWrite: false`.

### Star field details

- Geometry: BufferGeometry, 400 vertices.
- Each star position: random unit vector with `y > 0.15` (above horizon), scaled by `STAR_RADIUS = 480`.
- Material: `PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false })`.
- `frustumCulled = false`.

Adding `fog: false` so fog doesn't tint stars at the horizon distance.

### Moon details

- Position: world-space vector `(MOON_OFFSET_X, MOON_HEIGHT, MOON_OFFSET_Z) = (-300, 200, -200)`. Opposite-ish to the existing sun (`dirLight.position` is roughly `(11.4, 15, -5.3)` — moon is far the other side).
- Texture: 128×128 canvas. Radial gradient: center `rgba(255, 250, 220, 1)`, midpoint `rgba(255, 245, 200, 0.7)`, edge `rgba(255, 240, 180, 0)`. Adds a subtle glow halo.
- `THREE.Sprite` w/ `SpriteMaterial({ map, transparent: true, opacity: 0, depthWrite: false, fog: false })`.
- Sprite scale: `(MOON_SIZE, MOON_SIZE, 1) = (40, 40, 1)`.

### main.js wiring

Add to main.js (module-level, after `sky` + `petals` + `dayNight`):

```javascript
const stars = new Stars( scene, hemiLight );
```

In render loop:

```javascript
stars.update( dt );
```

`dt` parameter unused right now but kept in the signature for future twinkle / drift extensions.

### Constants (top of Stars.js)

```javascript
const STAR_COUNT = 400;
const STAR_RADIUS = 480;
const STAR_MIN_Y_FRACTION = 0.15;
const STAR_SIZE = 1.2;
const MOON_HEIGHT = 200;
const MOON_OFFSET_X = -300;
const MOON_OFFSET_Z = -200;
const MOON_SIZE = 40;
const HEMI_DAY = 1.8;
const HEMI_NIGHT = 0.3;
```

## Files touched

**Created:**
- `js/Stars.js` (~110 LOC)

**Modified:**
- `js/main.js` — import + instantiate + drive update. ~3 LOC.

## Acceptance criteria

1. ☐ Day mode: no stars, no moon visible.
2. ☐ Press N → night fades in over 1.5s; stars and moon fade in simultaneously.
3. ☐ Moon visibly large + soft glow against dark sky.
4. ☐ Stars scattered across upper hemisphere, not below horizon.
5. ☐ Fog doesn't tint stars or moon.
6. ☐ Press N back to day → stars + moon fade out.
7. ☐ FPS 60.
8. ☐ Everything else unchanged.

## Tuning

- Stars too few → `STAR_COUNT` 400→800.
- Stars too small/big → `STAR_SIZE` 1.2 ± 0.5.
- Moon too small → `MOON_SIZE` 40→60.
- Moon position wrong → adjust `MOON_OFFSET_X/Z`.
- Fade window mis-matched (visible during transition) → adjust formula divisor.

## Out of scope

- Twinkle
- Constellations
- Moon shadow lighting
- Stars during car eclipse moments
- Multi-moon
- Aurora / nebula
