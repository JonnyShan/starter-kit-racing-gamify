# Ghost Car Replay — Design

**Date:** 2026-05-19
**Scope:** Record the player's best lap as a quaternion+position trajectory; play back as a translucent blue car next lap so the player races their previous best.
**Reference:** Original user ask ("ghost blue car"), driftclub.gg style.

## Problem

Currently `LapTimer` saves only a scalar best-lap time to `localStorage` per track. There is no visual record of the trajectory that produced it. The player races a clock, not a memory. Reference inspiration shows a translucent blue car following the previous-best line — concrete pacing feedback.

## Non-goals

Per brainstorm:
- No multi-ghost (top-3 race)
- No ahead/behind color tinting
- No network leaderboard / shared ghosts
- No smoke trail on the ghost
- No mid-lap respawn handling beyond a buffer cap
- No editor-track support yet (works for built-in tracks; user-created tracks via editor will also work as long as they have a trackId)

## Design

### Module: `js/Ghost.js`

New class `Ghost`. Single responsibility: own ghost buffer + ghost mesh + record/playback lifecycle.

```javascript
new Ghost( scene, trackId, vehicleModel, lapTimer )
ghost.update( dt, vehicle, lapTime )
ghost.dispose()
```

Constructor:
- Stores `scene`, `trackId`, builds ghost mesh from `vehicleModel`, adds to scene hidden by default.
- Calls `_load()` to read `racing.ghost.{trackId}` from localStorage → `this.ghostBuffer` (Float32Array) or null.
- Attaches to `lapTimer`: sets `lapTimer.onLapComplete = ( time, isBest ) => this._onLapComplete( time, isBest )`.

### Recording buffer

- Sample rate: 30 Hz fixed.
- Sample size: 7 floats — `[x, y, z, qx, qy, qz, qw]`.
- Time implicit: `sampleIndex = floor( elapsed * 30 )`.
- Active recording stored as `this.recordBuffer` — a `Float32Array` sized `GHOST_MAX_SAMPLES * 7`. `this.recordCount` tracks how many samples written.
- `this._recordAccum` accumulates `dt` while recording. Each time it exceeds `1 / 30`, write a sample and subtract.
- Cap at `GHOST_MAX_SAMPLES = 30 * 300 = 9000` (5 min). Beyond cap, stop appending (drift recording silently truncates).
- Recording starts when `lapTimer.running === true` and `lapTimer.currentLapTime` is below the cap. Stops on `_onLapComplete`.

### Best-lap save

`_onLapComplete(time, isBest)`:
- If `isBest === true`:
  - Copy `this.recordBuffer.slice(0, recordCount * 7)` → `this.ghostBuffer`.
  - `_save()` writes base64 of `ghostBuffer` to `localStorage['racing.ghost.' + trackId]`.
- Always: reset `recordCount = 0`, `_recordAccum = 0`.

### Ghost mesh

`_buildGhostMesh(vehicleModel)`:
- `mesh = vehicleModel.clone(true)`.
- Traverse cloned tree; for every `Mesh`, replace material with a shared `MeshBasicMaterial({ color: GHOST_COLOR, transparent: true, opacity: GHOST_OPACITY, depthWrite: false })`. Disable `castShadow` and `receiveShadow`.
- Initially `mesh.visible = false`. Added to `scene` once at construction.

### Playback

`update(dt, vehicle, lapTime)`:
1. Recording branch: if `lapTimer.running`, accumulate samples (see Recording buffer).
2. Playback branch: if `this.ghostBuffer && lapTimer.running`:
   - `idx = lapTime * 30`.
   - Clamp to last sample if past end.
   - Linearly interp position, sphericlly interp quaternion between `floor(idx)` and `ceil(idx)` using fractional part `idx - floor(idx)`.
   - Set ghost mesh position + quaternion.
   - `mesh.visible = true`.
3. Else: `mesh.visible = false`.

### LapTimer modification

Add to `LapTimer` class:
- Constructor field: `this.onLapComplete = null`.
- At end of `completeLap()` method (after existing animate call), append:
  ```javascript
  if ( this.onLapComplete ) this.onLapComplete( this.lastLap, isBest );
  ```
  Where `isBest` is the same boolean already computed at top of `completeLap`.

Only that change. No other LapTimer logic disrupted.

### main.js wiring

Add to `loadTrack` after `lapTimer` and `vehicle.init` complete:
```javascript
const ghost = new Ghost( scene, mapParam, models[ 'vehicle-truck-yellow' ], lapTimer );
```

In render loop, after `lapTimer.update`:
```javascript
ghost.update( dt, vehicle, lapTimer.currentLapTime );
```

### localStorage encoding

`Float32Array` → bytes → base64:
```javascript
function bufferToBase64( float32 ) {
    const bytes = new Uint8Array( float32.buffer, 0, float32.byteLength );
    let bin = '';
    for ( let i = 0; i < bytes.length; i ++ ) bin += String.fromCharCode( bytes[ i ] );
    return btoa( bin );
}
function base64ToBuffer( str ) {
    const bin = atob( str );
    const bytes = new Uint8Array( bin.length );
    for ( let i = 0; i < bin.length; i ++ ) bytes[ i ] = bin.charCodeAt( i );
    return new Float32Array( bytes.buffer );
}
```

~75 KB per track on average (60 s × 30 Hz × 7 floats × 4 B = 50 KB raw; base64 inflates ~33% → 67 KB).

### Constants (top of Ghost.js)

```javascript
const GHOST_SAMPLE_RATE = 30;
const GHOST_SAMPLE_INTERVAL = 1 / GHOST_SAMPLE_RATE;
const GHOST_FLOATS_PER_SAMPLE = 7;
const GHOST_MAX_SECONDS = 300;
const GHOST_MAX_SAMPLES = GHOST_SAMPLE_RATE * GHOST_MAX_SECONDS;
const GHOST_COLOR = 0x4a9eff;
const GHOST_OPACITY = 0.55;
const STORAGE_PREFIX = 'racing.ghost.';
```

## Edge cases

- **First lap, no ghost yet:** `ghostBuffer === null`, playback branch skipped, ghost invisible. Recording still happens so first lap can become next lap's ghost.
- **Player crosses finish after ghost has finished:** ghost frozen at last sample, visible at end of track. Player sees head start.
- **Player faster than ghost:** ghost still plays back from its own t=0. Player overtakes ghost mid-track. Ghost continues, finishes after player. Visible feedback: "I beat my previous best."
- **trackId is null/undefined:** fall back to `'default'`, matches existing LapTimer behaviour.
- **localStorage full or fails:** wrap save in try/catch like existing LapTimer code, swallow error.
- **localStorage entry corrupted:** `base64ToBuffer` may throw or produce odd Float32Array length. Validate `buf.length % 7 === 0`; if not, discard and act as if no ghost.
- **Vehicle model not yet loaded when Ghost constructed:** `loadTrack` already awaits all model loads before invoking — guaranteed not null. Ghost constructor asserts `vehicleModel` truthy.
- **Respawn mid-lap (player falls off world):** LapTimer doesn't reset on respawn currently, so recording keeps appending until either lap completes (won't, since visitedCells reset on cross) or cap reached. On next valid lap-completion, an over-long recording could replace a good ghost. **Mitigation:** in `_onLapComplete`, only persist if `time <= GHOST_MAX_SECONDS` (matches buffer cap). Otherwise discard recording. Player won't know; result will simply be "best time didn't update" — same as today.

## Acceptance criteria

Verified by user in browser:

1. First lap on a track with no prior best → no ghost visible. Drive to completion. Cross finish line successfully.
2. Second lap → translucent blue car appears at start line, follows previous trajectory.
3. Beat previous best → on third lap, ghost follows new (faster) line.
4. Run slower lap → ghost still plays the previous best; ghost reaches finish line before player; ghost freezes parked past the line.
5. Refresh page → ghost persists (localStorage round-trip).
6. Open DevTools, type `localStorage['racing.ghost.default']` → returns long base64 string.
7. Ghost is visibly translucent blue, no shadow under it, no collision with player car.
8. FPS still 60. Playback interp does not stutter.
9. Drift physics, lap timer, drift marks, day atmosphere, audio all unchanged in behaviour.

## Tuning candidates

If anything reads wrong, single-line knobs at top of Ghost.js:
- Ghost too transparent → `GHOST_OPACITY` 0.55 → 0.75
- Ghost color too saturated → `GHOST_COLOR` 0x4a9eff → 0x6fb2ff
- Stuttery playback → bump `GHOST_SAMPLE_RATE` to 60 (re-record needed)
- localStorage too big → drop sample rate to 20

## Out of scope

- Multi-ghost (race vs your top-3)
- Ghost color shift based on whether you're ahead or behind
- Network ghosts / global leaderboard
- Smoke trail on ghost during drift sections
- Ghost transparency fade by distance
- "Reset ghost" button in UI
- Day/night material variant
