# Anime Speed Lines — Design

**Date:** 2026-05-19
**Scope:** SVG overlay of radial white "speed lines" emanating from screen center, fading in proportional to `vehicle.driftIntensity × speed`. Manga / Initial-D style.

## Problem

Drift physics + visual feedback (smoke, marks, audio, score) exist but the screen itself doesn't react to fast drifting. Anime racing convention: radial speed lines that punch in during dramatic moments. Easy ambient win.

## Non-goals

- Animated line shimmer (per-line opacity oscillation)
- Curvature toward steering direction
- Aesthetic per-day vs per-night variant
- Lines as a postprocess (full GPU pass) — DOM SVG is enough
- Color theming
- Mobile-specific layout

## Design

### Module `js/SpeedLines.js`

```javascript
new SpeedLines( vehicle )
update( dt )
dispose()
```

Constructor:
- Builds a fixed-position SVG element covering the viewport.
- Inserts 24 `<line>` children, each from center to a point on a larger circle at angle `i * 360/24`.
- Inserts SVG into `document.body`. `pointer-events: none`, `z-index: 5` (above canvas but below HUD).
- Saves reference to SVG element.

`update(dt)`:
- Reads `vehicle.driftIntensity` and `vehicle.linearSpeed`.
- Computes opacity:
  ```
  const speedFrac = Math.min( Math.abs( vehicle.linearSpeed ) / MAX_SPEED_REF, 1 );
  const driftFrac = Math.min( vehicle.driftIntensity / DRIFT_MAX_REF, 1 );
  const active = speedFrac > SPEED_THRESHOLD && driftFrac > DRIFT_THRESHOLD;
  let opacity = 0;
  if ( active ) opacity = driftFrac * speedFrac * MAX_OPACITY;
  ```
- Lerp current → target opacity: `current += (target - current) * dt * 8` for smooth in/out (avoid flicker on brief slips).
- Assigns `svg.style.opacity = current`.

### SVG geometry

```javascript
const svg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
svg.setAttribute( 'width', '100%' );
svg.setAttribute( 'height', '100%' );
svg.setAttribute( 'viewBox', '0 0 100 100' );
svg.setAttribute( 'preserveAspectRatio', 'none' );
// style:
svg.style.position = 'fixed';
svg.style.inset = '0';
svg.style.pointerEvents = 'none';
svg.style.zIndex = '5';
svg.style.opacity = '0';
svg.style.mixBlendMode = 'screen';
```

`viewBox=0 0 100 100` makes the center `(50, 50)`. Each line:

```javascript
for ( let i = 0; i < SPEED_LINE_COUNT; i ++ ) {
	const angle = ( i / SPEED_LINE_COUNT ) * Math.PI * 2;
	const inner = SPEED_LINE_INNER;
	const outer = SPEED_LINE_OUTER;
	const x1 = 50 + Math.cos( angle ) * inner;
	const y1 = 50 + Math.sin( angle ) * inner;
	const x2 = 50 + Math.cos( angle ) * outer;
	const y2 = 50 + Math.sin( angle ) * outer;
	const line = document.createElementNS( 'http://www.w3.org/2000/svg', 'line' );
	line.setAttribute( 'x1', x1 );
	line.setAttribute( 'y1', y1 );
	line.setAttribute( 'x2', x2 );
	line.setAttribute( 'y2', y2 );
	line.setAttribute( 'stroke', SPEED_LINE_COLOR );
	line.setAttribute( 'stroke-width', SPEED_LINE_WIDTH );
	line.setAttribute( 'stroke-linecap', 'round' );
	svg.appendChild( line );
}
```

`preserveAspectRatio='none'` stretches viewBox to viewport so lines reach corners on wide screens.

`mixBlendMode = 'screen'` makes white lines additive against scene colors (night + day both readable).

### Constants

```javascript
const SPEED_LINE_COUNT = 24;
const SPEED_LINE_INNER = 25;
const SPEED_LINE_OUTER = 110;
const SPEED_LINE_WIDTH = 0.7;
const SPEED_LINE_COLOR = '#ffffff';
const SPEED_THRESHOLD = 0.5;
const DRIFT_THRESHOLD = 0.4;
const MAX_OPACITY = 0.6;
const MAX_SPEED_REF = 1.5;
const DRIFT_MAX_REF = 2.0;
const LERP_RATE = 8;
```

`MAX_SPEED_REF` matches `Vehicle.MAX_SPEED`. Hard-coded here to avoid an import cycle and to keep tuning local.

### Wiring

In main.js, after `headlights`:

```javascript
const speedLines = new SpeedLines( vehicle );
```

In render loop, after `headlights.update( dt );`:

```javascript
speedLines.update( dt );
```

## Files touched

**Created:**
- `js/SpeedLines.js` (~90 LOC)

**Modified:**
- `js/main.js` — import + instantiate + update. ~3 LOC.

## Acceptance criteria

1. ☐ Cruising slow w/o drifting → no speed lines visible.
2. ☐ Drift at speed → radial white lines fade in from screen edges toward center, smoothly.
3. ☐ Release drift → lines fade out smoothly (lerp, not snap).
4. ☐ Lines visible at both day and night (mixBlendMode screen).
5. ☐ Lines don't block mouse / clicks.
6. ☐ Lines reach corners on wide aspect screens.
7. ☐ FPS still 60.
8. ☐ Drift / lap timer / ghost / drift score / all other features unchanged.

## Tuning

- Too dramatic / overwhelming → drop `MAX_OPACITY` 0.6→0.35.
- Lines appear during minor drifts → bump `DRIFT_THRESHOLD` 0.4→0.6.
- Lines too dense → drop `SPEED_LINE_COUNT` 24→16.
- Lines too thin / thick → adjust `SPEED_LINE_WIDTH` 0.7±0.3.
- Fade lerp too slow / fast → adjust `LERP_RATE` 8±4.

## Out of scope

- Per-line shimmer
- Curvature toward steering
- Color theming
- WebGL postprocess version
- Mobile responsive layout tweaks
