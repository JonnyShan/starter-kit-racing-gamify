# S-Curve Drift Bonus — Design

**Date:** 2026-05-19
**Scope:** Detect rapid direction reversal during a single drift event (chuck-in left → chuck-in right → ... etc). Award a chain-multiplier bonus and a "S-CURVE!" toast once a drift contains ≥ 2 sign flips.

## Problem

Donut bonus rewards 360° spins. S-curve sweeps through alternating corners are also hard but currently score the same as plain drifts. Reward the technique.

## Non-goals

- Multi-curve detection per drift (one fire per drift)
- Cumulative S-curve multiplier scaling
- Particle burst
- Sound effect

## Design

### State additions to `DriftScore`

```javascript
this.prevSlipSign = 0;     // -1 / 0 / +1
this.flipCount = 0;        // reset per drift
this.sCurveFired = false;  // gate so we fire once per drift
```

### Detection logic (inside DRIFTING branch, right after `liveScore` accumulation)

```javascript
const sign = vehicle.lateralSpeed > LATERAL_REVERSE_THRESHOLD
	? 1
	: vehicle.lateralSpeed < - LATERAL_REVERSE_THRESHOLD
		? -1
		: 0;

if ( sign !== 0 && this.prevSlipSign !== 0 && sign !== this.prevSlipSign ) {

	this.flipCount += 1;

	if ( this.flipCount >= SCURVE_MIN_FLIPS && ! this.sCurveFired ) {

		this.chainMult += 1;
		this._showSCurveToast();
		this.sCurveFired = true;

	}

}

if ( sign !== 0 ) this.prevSlipSign = sign;
```

`LATERAL_REVERSE_THRESHOLD = 0.2` prevents jitter near zero from generating phantom flips.

`SCURVE_MIN_FLIPS = 2` (so a true S = at least 2 sign changes — left-right-left).

### Reset

When state leaves DRIFTING (to GRACE on grip recovery, to IDLE on crash, or chain finalize):

```javascript
this.prevSlipSign = 0;
this.flipCount = 0;
this.sCurveFired = false;
```

### DOM + CSS

Add another small toast row alongside the existing DONUT toast:

DOM (append to `panel.innerHTML` in `_buildUI`):
```javascript
'<div class="scurve">S-CURVE!</div>'
```

CSS:
```css
#drift-score .scurve {
	font: 800 14px/1 -apple-system, BlinkMacSystemFont, sans-serif;
	color: #67e0ff;
	text-shadow: 0 0 8px rgba(103, 224, 255, 0.7);
	letter-spacing: 0.12em;
	margin-top: 2px;
	opacity: 0;
	transition: opacity 0.3s;
}
#drift-score .scurve.show { opacity: 1; }
```

### Methods

```javascript
_showSCurveToast() {
	this.sCurveEl.classList.add( 'show' );
	this.sCurveToastTimer = SCURVE_TOAST_SECONDS;
}
```

Tick in `_render(dt)`:
```javascript
if ( this.sCurveToastTimer > 0 ) {
	this.sCurveToastTimer -= dt;
	if ( this.sCurveToastTimer <= 0 ) this.sCurveEl.classList.remove( 'show' );
}
```

### Constants

```javascript
const LATERAL_REVERSE_THRESHOLD = 0.2;
const SCURVE_MIN_FLIPS = 2;
const SCURVE_TOAST_SECONDS = 1.2;
```

## Files touched

- Modify: `js/DriftScore.js` only.

## Acceptance criteria

1. ☐ Single-direction drift → no S-CURVE toast.
2. ☐ Chuck-in left, recover slightly, chuck-in right within same drift event → S-CURVE! fires once.
3. ☐ Repeating direction flips after the first fire → no additional fires within the same drift.
4. ☐ Crash → state resets, next drift starts fresh.
5. ☐ Donut + S-curve can both fire in the same drift if conditions met (no interaction needed).
6. ☐ FPS still 60.
7. ☐ Everything else unchanged.

## Tuning

- Too lenient → bump `SCURVE_MIN_FLIPS` to 3.
- Phantom flips at low slip → bump `LATERAL_REVERSE_THRESHOLD` 0.2→0.4.
- Toast brief → `SCURVE_TOAST_SECONDS` 1.2→2.0.

## Out of scope

- Multi-fire per drift
- Cumulative S-curve multiplier
- Particle / sound effect
