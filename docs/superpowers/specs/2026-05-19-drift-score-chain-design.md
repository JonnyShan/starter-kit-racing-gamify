# Drift Score + Chain UI — Design

**Date:** 2026-05-19
**Scope:** Live drift score HUD. Chain multiplier persists across nearby corners; breaks after 1.5s of grip or on crash. Per-track best score persisted to localStorage.

## Problem

Drift physics + visual smoke + skid marks exist, but no gameplay loop rewards good drifts. Player has no incentive to chain corners or to pick the perfect line. Initial-D / arcade racing convention: persistent score = play-and-improve loop.

## Non-goals

- Drift-style bonuses (donut, S-curve, sweep) — flat angle × speed only
- Network leaderboards
- Score-to-nitro reward
- Per-corner letter grades (S/A/B)
- Replay of best-score run
- Touch-input handling beyond existing

## Design

### State machine (in new `js/DriftScore.js`)

States: `IDLE`, `DRIFTING`, `GRACE`. `chainMult` is `1` while in `IDLE`. `chainScore` and `liveScore` both `0` in `IDLE`.

Transitions:
- `IDLE → DRIFTING` when `vehicle.driftIntensity > DRIFT_THRESHOLD`. `chainMult` stays `1` for first drift of a chain.
- `DRIFTING → GRACE` when `vehicle.driftIntensity <= DRIFT_THRESHOLD`. Accumulate `liveScore * chainMult` into `chainScore`; `chainMult++` (so the next drift in the chain is worth more); reset `liveScore`. Start `graceTimer`.
- `GRACE → DRIFTING` if drift resumes before `graceTimer > CHAIN_GRACE_SECONDS`. `chainMult` is already incremented from the prior transition.
- `GRACE → IDLE` if `graceTimer > CHAIN_GRACE_SECONDS`. Finalize chain: if `chainScore > bestScore && chainScore >= MIN_CHAIN_SCORE_TO_SAVE`, save. Show banner. Reset `chainScore`, `liveScore`, `chainMult = 1`.
- Any state → `IDLE` immediately if crash detected (large speed drop). All counters reset; no save.

### Scoring formula

While in `DRIFTING`:
```
const speed = Math.abs( vehicle.linearSpeed );
const slipAbs = Math.abs( Math.atan2( vehicle.lateralSpeed, vehicle.linearSpeed ) );
liveScore += slipAbs * speed * dt * SCORE_SCALE;
```
`SCORE_SCALE = 100` chosen so a sustained 30° drift at MAX_SPEED for 1s yields ~80 points. Scales tuned to hit ~1000-3000 per chain, ~10000+ per great lap.

Total displayed live = `liveScore + chainScore`.

### Crash detection

Speed history: `prevSpeed` updated each frame. If `prevSpeed > 0.3 && speed < prevSpeed * CRASH_SPEED_DROP_RATIO`, treat as crash. Reset state to `IDLE`, clear `liveScore` + `chainScore` + `chainMult`. No score saved.

`CRASH_SPEED_DROP_RATIO = 0.3` means losing >70% of speed in one frame = crash.

### HUD DOM

New element `#drift-score`. Positioned top-center, below minimap (the minimap is centered top in the screenshots). Layout:

```
       CHAIN x3
        1247
      best 4892
```

Three text rows. `CHAIN x{N}` hidden when `chainMult === 1` (first drift of chain). Score number large + yellow when actively drifting or in grace. Greys + smaller when idle.

CSS sketch:
```css
#drift-score {
	position: absolute;
	top: 80px;
	left: 50%;
	transform: translateX(-50%);
	color: #fff;
	font: 600 12px -apple-system, BlinkMacSystemFont, sans-serif;
	text-align: center;
	background: rgba(0,0,0,0.4);
	padding: 6px 14px;
	border-radius: 8px;
	pointer-events: none;
	z-index: 10;
}
#drift-score .score {
	font: 700 22px/1.1 -apple-system, BlinkMacSystemFont, sans-serif;
	font-variant-numeric: tabular-nums;
	color: #ffd84a;
	text-shadow: 0 0 6px rgba(255,216,74,0.5);
	margin: 2px 0;
}
#drift-score.idle .score { color: #888; text-shadow: none; }
#drift-score .chain { opacity: 0; letter-spacing: 0.1em; }
#drift-score.chaining .chain { opacity: 1; }
#drift-score .best { opacity: 0.6; font-size: 10px; }
```

Chain banner: separate element `#drift-banner`, hidden by default. On `GRACE → IDLE`, populate with `{chainScore} POINTS!`, add `.show` class, animate fade out over 1.5s.

### Persistence

Per-track best:
- Key: `racing.driftScore.{trackId}`
- Stored as integer string.
- On chain finalize, if score > current best, write.
- Loaded in constructor; rendered in `best` row.

### main.js wiring

In `loadTrack` after `lapTimer` + `ghost` setup:
```javascript
const driftScore = new DriftScore( mapParam );
```

In render loop after `vehicle.update`:
```javascript
driftScore.update( dt, vehicle );
```

### Reset on respawn

Vehicle's respawn-when-falling block (in `Vehicle.update`) is already there. `DriftScore` doesn't listen to it directly. Crash-detection (speed drop) covers the visible part. Acceptable: respawn forces a large speed drop, which triggers crash reset. No explicit hook needed.

## Constants (top of DriftScore.js)

```javascript
const DRIFT_THRESHOLD = 0.3;
const SCORE_SCALE = 100;
const CHAIN_GRACE_SECONDS = 1.5;
const CRASH_SPEED_DROP_RATIO = 0.3;
const BANNER_DURATION_SECONDS = 1.5;
const MIN_CHAIN_SCORE_TO_SAVE = 50;
const STORAGE_PREFIX = 'racing.driftScore.';
```

`MIN_CHAIN_SCORE_TO_SAVE = 50` avoids saving trivial near-zero "drifts" as new bests on a fresh track.

## Files touched

**Created:**
- `js/DriftScore.js` — state machine, HUD DOM, scoring, persistence. ~150 LOC.

**Modified:**
- `js/main.js` — import + instantiate + drive update. ~3 LOC.

## Acceptance criteria

Verified by user in browser:

1. ☐ HUD panel appears below minimap on game load, showing greyed-out "0" and "BEST 0" when no prior best.
2. ☐ Initiate handbrake drift → score number lights yellow and counts up live.
3. ☐ Recover grip → enters grace; score pauses but doesn't reset.
4. ☐ Initiate second drift within 1.5s → `CHAIN x2` appears; new drift score counts up; `chainMult` multiplies past chain into total.
5. ☐ Wait >1.5s in grip → banner `{N} POINTS!` flashes, HUD resets to 0, `BEST` updates if score > previous.
6. ☐ Crash into wall → all score reset to 0 immediately, no save.
7. ☐ Refresh page → best score persists.
8. ☐ Drive without drifting → score stays 0, HUD greyed.
9. ☐ FPS still 60.
10. ☐ Drift physics, lap timer, ghost, atmosphere, blossoms, bollards all unchanged.

## Tuning candidates

- Scores feel too small → bump `SCORE_SCALE` 100→200.
- Chain breaks too easily → bump `CHAIN_GRACE_SECONDS` 1.5→2.5.
- "Drifting" trigger too loose (registers on minor steering) → bump `DRIFT_THRESHOLD` 0.3→0.5.
- Crash detection false-positives on jumps → lower `CRASH_SPEED_DROP_RATIO` 0.3→0.2.
- Banner too long → drop `BANNER_DURATION_SECONDS` 1.5→1.0.

## Out of scope (future)

- Drift style bonuses (donut, S-curve)
- Letter grades (S/A/B)
- Score-fed nitro / boost
- Network leaderboards
- Per-corner scoring breakdown
- Banner sounds
- Day/night HUD theme variants
