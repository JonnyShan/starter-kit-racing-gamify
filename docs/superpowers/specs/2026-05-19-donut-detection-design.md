# Donut Detection Bonus — Design

**Date:** 2026-05-19
**Scope:** Track total yaw rotation accumulated during the current drift. When the magnitude exceeds 2π (a full 360° spin), trigger a "DONUT!" toast and bump `chainMult` by an extra +1.

## Problem

Drift scoring rewards angle × speed × duration but not specific tricks. A clean 360° donut is harder than a long sweep but currently scores the same. Reward it explicitly.

## Non-goals

- Multi-donut detection per drift (one bump per 360°, then accumulator resets)
- S-curve / figure-8 specific detection
- Reverse-direction donut differentiation
- Visual particle burst on donut
- Donut-specific sound effect

## Design

### Add state to `DriftScore`

```javascript
this.driftYawAccum = 0;  // signed radians, integrated while DRIFTING
this.donutToastTimer = 0; // seconds remaining on the DONUT! toast
```

### Detection logic (inside DRIFTING branch of `update`)

After existing live-score accumulation:
```javascript
this.driftYawAccum += vehicle.angularSpeed * dt;

if ( Math.abs( this.driftYawAccum ) >= DONUT_ANGLE ) {

	this.chainMult += 1;
	this._showDonutToast();
	this.driftYawAccum = 0;

}
```

`DONUT_ANGLE = Math.PI * 2`.

### Reset

When state leaves `DRIFTING` (either to GRACE on grip recovery or to IDLE on crash), zero `driftYawAccum`. Easiest: clear in `_finalizeChain` AND in the crash-reset block AND on `DRIFTING → GRACE` transition.

### DONUT toast UI

Small label appearing next to the score for ~1.2 s, then fades out.

DOM (in `_buildUI`):
```javascript
const donut = document.createElement( 'div' );
donut.className = 'donut';
donut.textContent = 'DONUT!';
panel.appendChild( donut );
this.donutEl = donut;
```

CSS:
```css
#drift-score .donut {
	font: 800 14px/1 -apple-system, BlinkMacSystemFont, sans-serif;
	color: #ff6ec7;
	text-shadow: 0 0 8px rgba(255, 110, 199, 0.7);
	letter-spacing: 0.12em;
	margin-top: 2px;
	opacity: 0;
	transition: opacity 0.3s;
}
#drift-score .donut.show { opacity: 1; }
```

`_showDonutToast()`:
```javascript
_showDonutToast() {
	this.donutEl.classList.add( 'show' );
	this.donutToastTimer = DONUT_TOAST_SECONDS;
}
```

Inside `_render(dt)`:
```javascript
if ( this.donutToastTimer > 0 ) {
	this.donutToastTimer -= dt;
	if ( this.donutToastTimer <= 0 ) this.donutEl.classList.remove( 'show' );
}
```

### Constants

```javascript
const DONUT_ANGLE = Math.PI * 2;
const DONUT_TOAST_SECONDS = 1.2;
```

## Files touched

- Modify: `js/DriftScore.js` only — add `driftYawAccum` + `donutToastTimer` fields, `donutEl` DOM, yaw integration in DRIFTING branch, `_showDonutToast` method, toast tick in `_render`.

## Acceptance criteria

1. ☐ Hand-brake drift through normal sweep corner → no DONUT toast.
2. ☐ Spin the car a full 360° while drifting (e.g., handbrake + full steering on a wide spot) → "DONUT!" appears, `CHAIN x{N+1}` increments, fades after ~1.2 s.
3. ☐ Continue spinning a second 360° → fires again.
4. ☐ Recover grip / crash → accumulator resets; new drift starts at 0°.
5. ☐ FPS still 60.
6. ☐ All other features unchanged.

## Tuning

- Easier donut: drop `DONUT_ANGLE` to `Math.PI * 1.5` (270°).
- Bigger reward per donut: bump `this.chainMult += 1` to `+= 2` inline.
- Toast too brief → `DONUT_TOAST_SECONDS` 1.2→2.0.

## Out of scope

- Counted multi-donuts in toast ("DONUT x3!")
- Reverse vs forward donut differentiation
- Particle burst
- Sound effect
- Score multiplier curve based on number of donuts in a chain
