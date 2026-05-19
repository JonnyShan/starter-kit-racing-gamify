# Camera Shake on Crash — Design

**Date:** 2026-05-19
**Scope:** When the player crashes (detected by the existing 70% speed-drop rule in DriftScore), the camera jitters briefly. Adds impact feel.

## Non-goals

- Continuous shake (e.g., rumble) — only one-shot per crash event
- Procedural-noise shake (using sin waves) — random per-frame jitter is enough
- Shake on bumps / hops (track-bump pieces) — only large drops trigger
- Force feedback / gamepad rumble
- Configurable shake patterns (twist, kick, etc.)

## Design

### Camera.shake( magnitude, duration )

New public method on `Camera`:

```javascript
shake( magnitude, duration ) {
	this._shakeMagnitude = magnitude;
	this._shakeRemaining = duration;
	this._shakeDuration = duration;
}
```

Constructor adds `this._shakeMagnitude = 0; this._shakeRemaining = 0; this._shakeDuration = 0;`.

End of `Camera.update(dt, ...)`, after the existing `camera.lookAt(...)`:

```javascript
if ( this._shakeRemaining > 0 ) {

	const tNorm = this._shakeRemaining / this._shakeDuration;
	const amp = this._shakeMagnitude * tNorm * tNorm;
	this.camera.position.x += ( Math.random() - 0.5 ) * 2 * amp;
	this.camera.position.y += ( Math.random() - 0.5 ) * 2 * amp;
	this.camera.position.z += ( Math.random() - 0.5 ) * 2 * amp;
	this._shakeRemaining = Math.max( 0, this._shakeRemaining - dt );

}
```

Quadratic falloff makes shake punchy at impact, soft by end.

### DriftScore triggers shake

`DriftScore` already detects crashes (70% speed drop). Extend its constructor to accept the cam, store it, and call `cam.shake(...)` inside the crash branch.

```javascript
new DriftScore( trackId, cam )
```

Inside `update(...)`:
```javascript
if ( speedDropped && this.state !== STATE_IDLE ) {

	this.cam?.shake( SHAKE_MAGNITUDE, SHAKE_DURATION );
	// ... existing reset code ...

}
```

Constants in DriftScore:
```javascript
const SHAKE_MAGNITUDE = 0.6;  // world units
const SHAKE_DURATION = 0.4;   // seconds
```

### main.js wiring

```javascript
const driftScore = new DriftScore( mapParam, cam );
```

## Files touched

- Modify: `js/Camera.js` — shake API + per-frame application.
- Modify: `js/DriftScore.js` — accept cam, trigger shake on crash.
- Modify: `js/main.js` — pass cam to DriftScore constructor.

## Acceptance criteria

1. ☐ Crash into wall while drifting → camera visibly jitters for ~0.4s.
2. ☐ Crash trigger and DriftScore reset stay in sync (they were already triggered by the same condition).
3. ☐ No shake during normal driving, drifting w/o crash, or chain finalize.
4. ☐ Track-bump pieces (small dips) don't fire shake — speed drop should be too small to cross the 70% threshold.
5. ☐ FPS still 60.
6. ☐ All other features unchanged.

## Tuning

- Shake too violent → drop `SHAKE_MAGNITUDE` 0.6 → 0.3.
- Shake too short → bump `SHAKE_DURATION` 0.4 → 0.7.
- Shake too soft on impact → switch falloff from `tNorm * tNorm` to `tNorm` (linear) or `Math.sqrt(tNorm)` (more punch).

## Out of scope

- Vehicle-body shake (separate from camera)
- Audio "thud" on crash
- HUD red-pulse on crash
- Gamepad vibration
- Configurable shake key for testing
