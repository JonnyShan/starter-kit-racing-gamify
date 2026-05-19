# Day / Night Toggle — Design

**Date:** 2026-05-19
**Scope:** Press `N` to crossfade scene between day (current) and night atmosphere. 1.5 s animated transition. No persistence — always starts on day.

## Problem

Day atmosphere shipped but night mood is gone. Reference shows both. User wants to flip between them. No headlight cones in code so night is moody-dark — acceptable.

## Non-goals

- Persistent day/night across reloads
- Auto cycle based on time
- Day/night-aware blossom or petal recolor
- Headlight beam geometry for night driving
- Star sprites in night sky
- Audio change

## Design

### Module `js/DayNight.js`

```javascript
new DayNight( { scene, renderer, dirLight, hemiLight, sky } )
update( dt )
dispose()
```

Owns:
- `dayMode` (boolean, true initially)
- `t` (transition progress 0..1; 1 = currently at `dayMode` target)
- Listens on `keydown` for `KeyN` → flip `dayMode`, reset `t` to 0.

Each frame in `update(dt)`:
- If `t < 1`: `t += dt / TRANSITION_SECONDS`, clamp 1.
- Compute eased progress: `e = t` (linear; ease later if jarring).
- Lerp each color/intensity between `current target` and `previous target` based on `e` if transitioning. Simpler: lerp `from` and `to` colors stored at transition start.

Concretely each transition stores:
- `fromBg`, `toBg` (Color)
- `fromFog`, `toFog`
- `fromDirColor`, `toDirColor` + intensities
- `fromHemiSky`, `toHemiSky`, `fromHemiGround`, `toHemiGround` + intensities
- `fromExposure`, `toExposure`
- `fromSkyTop`, `toSkyTop`, `fromSkyBottom`, `toSkyBottom`

On `update(dt)` while `t < 1`:
- `scene.background.lerpColors(fromBg, toBg, e)`
- `scene.fog.color.lerpColors(fromFog, toFog, e)`
- `dirLight.color.lerpColors(fromDirColor, toDirColor, e); dirLight.intensity = lerp(fromDirI, toDirI, e)`
- `hemiLight.color.lerpColors(fromHemiSky, toHemiSky, e); hemiLight.groundColor.lerpColors(fromHemiGround, toHemiGround, e); hemiLight.intensity = lerp(fromHemiI, toHemiI, e)`
- `renderer.toneMappingExposure = lerp(fromExposure, toExposure, e)`
- `sky.skydome.material.uniforms.topColor.value.lerpColors(fromSkyTop, toSkyTop, e); ... bottomColor`

When `t === 1`: transitioning false; values stay at target.

### Two presets

Constants (top of DayNight.js):

```javascript
const TRANSITION_SECONDS = 1.5;

const DAY = {
	bg: 0xc8e2ff,
	fog: 0xc8e2ff,
	dirColor: 0xfff2d6,
	dirIntensity: 4,
	hemiSky: 0xa3d4ff,
	hemiGround: 0x6fa84a,
	hemiIntensity: 1.8,
	exposure: 1.05,
	skyTop: 0x4a7fc1,
	skyBottom: 0xc8e2ff,
};

const NIGHT = {
	bg: 0x0d1426,
	fog: 0x0d1426,
	dirColor: 0x5c7eb8,
	dirIntensity: 0.5,
	hemiSky: 0x1a2540,
	hemiGround: 0x0a1518,
	hemiIntensity: 0.3,
	exposure: 0.85,
	skyTop: 0x0a1428,
	skyBottom: 0x1f2d4a,
};
```

`DAY` values mirror the current scene exactly so first-load behaviour is unchanged. `NIGHT` is moody blue.

### main.js wiring

`Sky` constructor currently doesn't expose `skydome` publicly. Verify it's accessible as `sky.skydome` — yes, the implementation stored it on `this.skydome` in Sky.js.

Add to `main.js`:
```javascript
const dayNight = new DayNight( { scene, renderer, dirLight, hemiLight, sky } );
```

In render loop:
```javascript
dayNight.update( dt );
```

`KeyN` doesn't conflict with existing Controls input.

### Reset hygiene

On dispose, remove keydown listener. Not strictly needed since lifecycle is page-bound, but cheap.

## Files touched

**Created:**
- `js/DayNight.js` (~140 LOC)

**Modified:**
- `js/main.js` — import + instantiate + drive update. ~3 LOC.

## Acceptance criteria

1. ☐ Page loads in day mode (unchanged from before).
2. ☐ Press N → scene crossfades to night over 1.5s: bg darkens, fog darkens, sunlight dims and shifts cool, sky gradient swaps to dark blue, exposure drops.
3. ☐ Press N again → crossfades back to day.
4. ☐ Multiple rapid N presses don't break (transition starts fresh from current state, not from last preset).
5. ☐ Petals + blossoms + bollards visible in both modes.
6. ☐ FPS still 60.
7. ☐ Drift / lap timer / ghost / drift score unchanged.
8. ☐ Refresh page → always returns to day.

## Tuning

- Transition too slow → drop `TRANSITION_SECONDS` 1.5→0.8.
- Night too dark → bump `NIGHT.dirIntensity` 0.5→0.9 or `hemiIntensity` 0.3→0.6.
- Night sky too washed → drop `NIGHT.skyBottom` to deeper blue 0x152340.

## Out of scope

- Persistence across reloads
- Auto-cycle
- Stars / moon
- Headlight cones
- Day/night-specific decoration colors
