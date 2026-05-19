# Drift Score + Chain UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Live drift score HUD with chain multiplier, banner on chain finalize, per-track best persisted to localStorage.

**Architecture:** New `js/DriftScore.js` owns a 3-state machine (IDLE/DRIFTING/GRACE), HUD DOM (panel + banner), scoring math, persistence. `main.js` instantiates after lapTimer/ghost and drives `driftScore.update(dt, vehicle)` in the render loop.

**Tech Stack:** Vanilla DOM, three.js (read-only access to vehicle state), localStorage. No test runner.

**Spec:** [docs/superpowers/specs/2026-05-19-drift-score-chain-design.md](../specs/2026-05-19-drift-score-chain-design.md)

---

## File Structure

**Created:**
- `js/DriftScore.js` — state machine, HUD, scoring, persistence. Single responsibility: drift score loop. ~150 LOC.

**Modified:**
- `js/main.js` — import + instantiate + drive update. ~3 LOC.

---

## Task 1: DriftScore module skeleton

**Files:**
- Create: `js/DriftScore.js`

- [ ] **Step 1: Write skeleton**

```javascript
const DRIFT_THRESHOLD = 0.3;
const SCORE_SCALE = 100;
const CHAIN_GRACE_SECONDS = 1.5;
const CRASH_SPEED_DROP_RATIO = 0.3;
const BANNER_DURATION_SECONDS = 1.5;
const MIN_CHAIN_SCORE_TO_SAVE = 50;
const STORAGE_PREFIX = 'racing.driftScore.';

const STATE_IDLE = 0;
const STATE_DRIFTING = 1;
const STATE_GRACE = 2;

export class DriftScore {

	constructor( trackId ) {

		this.storageKey = STORAGE_PREFIX + ( trackId || 'default' );

		this.state = STATE_IDLE;
		this.liveScore = 0;
		this.chainScore = 0;
		this.chainMult = 1;
		this.graceTimer = 0;
		this.bannerTimer = 0;
		this.prevSpeed = 0;
		this.bestScore = this._loadBest();

	}

	_loadBest() {

		try {
			const v = localStorage.getItem( this.storageKey );
			const n = v !== null ? Number( v ) : 0;
			return Number.isFinite( n ) ? n : 0;
		} catch {
			return 0;
		}

	}

	_saveBest() {

		try {
			localStorage.setItem( this.storageKey, String( Math.floor( this.bestScore ) ) );
		} catch {}

	}

	update( dt, vehicle ) {
		// filled in later tasks
	}

	dispose() {
		// filled in later tasks
	}

}
```

- [ ] **Step 2: Sanity import in main.js (temp)**

In `js/main.js`, after `import { buildBollards } from './Bollards.js';` add:

```javascript
import { DriftScore } from './DriftScore.js';
```

Reload page. Expected: no console error, no visual change.

- [ ] **Step 3: Commit**

```bash
git add js/DriftScore.js js/main.js
git commit -m "Add DriftScore module skeleton with constants and load/save"
```

---

## Task 2: HUD DOM + CSS

**Files:**
- Modify: `js/DriftScore.js`

- [ ] **Step 1: Add buildUI() and call from constructor**

In `js/DriftScore.js`, add method below `_saveBest`:

```javascript
	_buildUI() {

		const style = document.createElement( 'style' );
		style.textContent = `
			#drift-score {
				position: absolute;
				top: 80px;
				left: 50%;
				transform: translateX(-50%);
				color: #fff;
				font: 600 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
				text-align: center;
				background: rgba(0,0,0,0.4);
				padding: 6px 14px;
				border-radius: 8px;
				pointer-events: none;
				z-index: 10;
				letter-spacing: 0.04em;
				backdrop-filter: blur(8px);
				-webkit-backdrop-filter: blur(8px);
				user-select: none;
			}
			#drift-score .chain { opacity: 0; letter-spacing: 0.1em; height: 14px; transition: opacity 0.2s; }
			#drift-score.chaining .chain { opacity: 1; }
			#drift-score .score {
				font: 700 22px/1.1 -apple-system, BlinkMacSystemFont, sans-serif;
				font-variant-numeric: tabular-nums;
				color: #ffd84a;
				text-shadow: 0 0 6px rgba(255,216,74,0.5);
				margin: 2px 0;
			}
			#drift-score.idle .score { color: #888; text-shadow: none; }
			#drift-score .best { opacity: 0.6; font-size: 10px; letter-spacing: 0.08em; }
			#drift-banner {
				position: absolute;
				top: 50%;
				left: 50%;
				transform: translate(-50%, -50%);
				color: #ffd84a;
				font: 800 56px/1 -apple-system, BlinkMacSystemFont, sans-serif;
				font-variant-numeric: tabular-nums;
				text-shadow: 0 0 16px rgba(255,216,74,0.7), 0 4px 12px rgba(0,0,0,0.7);
				pointer-events: none;
				z-index: 11;
				opacity: 0;
				transition: opacity 0.3s, transform 0.3s;
				user-select: none;
			}
			#drift-banner.show { opacity: 1; transform: translate(-50%, -60%); }
		`;
		document.head.appendChild( style );

		const panel = document.createElement( 'div' );
		panel.id = 'drift-score';
		panel.classList.add( 'idle' );
		panel.innerHTML =
			'<div class="chain">CHAIN x1</div>' +
			'<div class="score">0</div>' +
			`<div class="best">BEST ${ Math.floor( this.bestScore ) }</div>`;
		document.body.appendChild( panel );

		const banner = document.createElement( 'div' );
		banner.id = 'drift-banner';
		document.body.appendChild( banner );

		this.panelEl = panel;
		this.chainEl = panel.querySelector( '.chain' );
		this.scoreEl = panel.querySelector( '.score' );
		this.bestEl = panel.querySelector( '.best' );
		this.bannerEl = banner;

	}
```

Then in the constructor, after `this.bestScore = this._loadBest();`, add:

```javascript
		this._buildUI();
```

- [ ] **Step 2: Verify in browser**

Reload page. Expected: a small panel below the minimap showing `0` in grey and `BEST 0` underneath. CHAIN row hidden (opacity 0).

- [ ] **Step 3: Commit**

```bash
git add js/DriftScore.js
git commit -m "Build DriftScore HUD panel and banner DOM"
```

---

## Task 3: State machine — drift detect + live score

**Files:**
- Modify: `js/DriftScore.js`

- [ ] **Step 1: Implement DRIFTING + GRACE accumulation in update()**

Replace `update()`:

```javascript
	update( dt, vehicle ) {

		const speed = Math.abs( vehicle.linearSpeed );
		const intensity = vehicle.driftIntensity;
		const isDrifting = intensity > DRIFT_THRESHOLD;

		// Crash detection (placeholder until Task 4):
		// nothing yet.

		if ( this.state === STATE_IDLE ) {

			if ( isDrifting ) this.state = STATE_DRIFTING;

		} else if ( this.state === STATE_DRIFTING ) {

			const slipAbs = Math.abs( Math.atan2( vehicle.lateralSpeed, vehicle.linearSpeed ) );
			this.liveScore += slipAbs * speed * dt * SCORE_SCALE;

			if ( ! isDrifting ) {

				this.chainScore += this.liveScore * this.chainMult;
				this.chainMult += 1;
				this.liveScore = 0;
				this.graceTimer = 0;
				this.state = STATE_GRACE;

			}

		} else if ( this.state === STATE_GRACE ) {

			this.graceTimer += dt;

			if ( isDrifting ) {

				this.state = STATE_DRIFTING;

			} else if ( this.graceTimer >= CHAIN_GRACE_SECONDS ) {

				this._finalizeChain();
				this.state = STATE_IDLE;

			}

		}

		this._render();
		this.prevSpeed = speed;

	}

	_finalizeChain() {

		const final = this.chainScore;
		if ( final >= MIN_CHAIN_SCORE_TO_SAVE && final > this.bestScore ) {

			this.bestScore = final;
			this._saveBest();

		}
		if ( final >= MIN_CHAIN_SCORE_TO_SAVE ) {

			this._showBanner( final );

		}
		this.chainScore = 0;
		this.liveScore = 0;
		this.chainMult = 1;

	}

	_showBanner( score ) {

		this.bannerEl.textContent = `${ Math.floor( score ) } POINTS!`;
		this.bannerEl.classList.add( 'show' );
		this.bannerTimer = BANNER_DURATION_SECONDS;

	}

	_render() {

		const total = Math.floor( this.liveScore + this.chainScore );
		this.scoreEl.textContent = total;

		if ( this.state === STATE_IDLE ) {

			this.panelEl.classList.add( 'idle' );
			this.panelEl.classList.remove( 'chaining' );

		} else {

			this.panelEl.classList.remove( 'idle' );
			if ( this.chainMult > 1 ) {

				this.chainEl.textContent = `CHAIN x${ this.chainMult }`;
				this.panelEl.classList.add( 'chaining' );

			} else {

				this.panelEl.classList.remove( 'chaining' );

			}

		}

		this.bestEl.textContent = `BEST ${ Math.floor( this.bestScore ) }`;

		if ( this.bannerTimer > 0 ) {

			this.bannerTimer -= 1 / 60; // approximate; refined when called from render loop
			if ( this.bannerTimer <= 0 ) this.bannerEl.classList.remove( 'show' );

		}

	}
```

Note: the banner timer subtracts `1/60` per call as a rough placeholder; the real `dt` flow is wired in Task 5 where `_render` is folded back to use the actual `dt`. For now this gives a usable banner.

- [ ] **Step 2: Wire into main.js render loop**

In `js/main.js`, find inside `loadTrack` after `const lapTimer = new LapTimer( ... );` and `const ghost = new Ghost( ... );`. Add:

```javascript
	const driftScore = new DriftScore( mapParam );
```

Then in the render loop, after `audio.update( ... );` and `sky.update( ... );` add:

```javascript
		driftScore.update( dt, vehicle );
```

- [ ] **Step 3: Verify in browser**

Reload. Initiate handbrake drift at speed. Expected: HUD score number lights yellow and counts up. Recover grip → chain row appears ("CHAIN x2") and score persists. Wait >1.5s in grip → banner flashes the total, HUD resets to 0 grey, BEST updates if exceeded.

Don't worry about crash reset yet (Task 4). If you wall-crash the score won't reset until Task 4 lands.

- [ ] **Step 4: Commit**

```bash
git add js/DriftScore.js js/main.js
git commit -m "Implement DRIFTING / GRACE state transitions and live score"
```

---

## Task 4: Crash detection

**Files:**
- Modify: `js/DriftScore.js`

- [ ] **Step 1: Add crash check at top of update**

In `js/DriftScore.js`, modify `update()` to detect crash and reset before state transitions. Find:

```javascript
		const speed = Math.abs( vehicle.linearSpeed );
		const intensity = vehicle.driftIntensity;
		const isDrifting = intensity > DRIFT_THRESHOLD;

		// Crash detection (placeholder until Task 4):
		// nothing yet.

		if ( this.state === STATE_IDLE ) {
```

Replace with:

```javascript
		const speed = Math.abs( vehicle.linearSpeed );
		const intensity = vehicle.driftIntensity;
		const isDrifting = intensity > DRIFT_THRESHOLD;

		const speedDropped = this.prevSpeed > 0.3 && speed < this.prevSpeed * CRASH_SPEED_DROP_RATIO;
		if ( speedDropped && this.state !== STATE_IDLE ) {

			this.liveScore = 0;
			this.chainScore = 0;
			this.chainMult = 1;
			this.state = STATE_IDLE;

		}

		if ( this.state === STATE_IDLE ) {
```

- [ ] **Step 2: Verify in browser**

Reload. Drift into a wall. Expected: HUD score resets to 0 immediately and `BEST` does NOT update. Test with a long chain — drift, recover, drift, then crash → all lost.

If chain doesn't reset on crash: confirm `prevSpeed` is being updated at the END of `update()` (it should be, from Task 3 — `this.prevSpeed = speed;` at the bottom).

If false positives on jumps (track-bump piece): track-bump may dip speed temporarily, but not by 70% in one frame. If it does, lower `CRASH_SPEED_DROP_RATIO` to 0.2 (means lose >80% to count as crash).

- [ ] **Step 3: Commit**

```bash
git add js/DriftScore.js
git commit -m "Reset drift chain on crash (>70% speed drop in one frame)"
```

---

## Task 5: Fix banner timer to use real dt

**Files:**
- Modify: `js/DriftScore.js`

- [ ] **Step 1: Promote dt into _render**

In `js/DriftScore.js`, change `_render()` signature to take `dt`:

Find:

```javascript
		this._render();
		this.prevSpeed = speed;
```

Replace with:

```javascript
		this._render( dt );
		this.prevSpeed = speed;
```

Then update `_render`:

Find:

```javascript
	_render() {
```

Replace with:

```javascript
	_render( dt ) {
```

Find inside _render:

```javascript
		if ( this.bannerTimer > 0 ) {

			this.bannerTimer -= 1 / 60; // approximate; refined when called from render loop
			if ( this.bannerTimer <= 0 ) this.bannerEl.classList.remove( 'show' );

		}
```

Replace with:

```javascript
		if ( this.bannerTimer > 0 ) {

			this.bannerTimer -= dt;
			if ( this.bannerTimer <= 0 ) this.bannerEl.classList.remove( 'show' );

		}
```

- [ ] **Step 2: Verify in browser**

Reload. Complete a chain. Expected: banner fades out smoothly over 1.5 seconds (now exact regardless of FPS).

- [ ] **Step 3: Commit**

```bash
git add js/DriftScore.js
git commit -m "Use real dt for banner timer (was approximate)"
```

---

## Task 6: dispose() for completeness

**Files:**
- Modify: `js/DriftScore.js`

- [ ] **Step 1: Implement dispose**

Replace the empty `dispose()`:

```javascript
	dispose() {

		if ( this.panelEl ) this.panelEl.remove();
		if ( this.bannerEl ) this.bannerEl.remove();
		this.panelEl = null;
		this.bannerEl = null;

	}
```

- [ ] **Step 2: Commit**

```bash
git add js/DriftScore.js
git commit -m "Implement DriftScore.dispose() for clean teardown"
```

---

## Task 7: Acceptance pass

**Files:** None.

- [ ] **Step 1: Walk acceptance criteria from spec**

From [the spec](../specs/2026-05-19-drift-score-chain-design.md#acceptance-criteria):

For a fresh test, reset:
```javascript
localStorage.removeItem( 'racing.driftScore.default' );
location.reload();
```

Verify:

1. ☐ HUD panel below minimap shows `0` (grey) and `BEST 0`.
2. ☐ Initiate handbrake drift → score counts up live, lights yellow.
3. ☐ Recover grip → enters grace; score pauses; HUD stays yellow.
4. ☐ Drift again within 1.5s → `CHAIN x2` appears.
5. ☐ Wait >1.5s in grip → banner flashes `{N} POINTS!`, HUD resets, BEST updates if score > prev best.
6. ☐ Wall crash mid-chain → all score reset, BEST not updated.
7. ☐ Refresh page → BEST persists.
8. ☐ Drive normally w/o drifting → HUD stays 0/grey.
9. ☐ FPS still 60.
10. ☐ Drift physics, lap timer, ghost, atmosphere, blossoms, bollards unchanged.

- [ ] **Step 2: Tune**

Tunables at top of `js/DriftScore.js`:
- Scores too small → bump `SCORE_SCALE` 100→200.
- Chain breaks too easily → bump `CHAIN_GRACE_SECONDS` 1.5→2.5.
- Light steering triggers drift state → bump `DRIFT_THRESHOLD` 0.3→0.5.
- Crash false positives (especially on bumps) → drop `CRASH_SPEED_DROP_RATIO` 0.3→0.2.
- Banner too brief → bump `BANNER_DURATION_SECONDS` 1.5→2.5.
- Trivial scores polluting BEST → bump `MIN_CHAIN_SCORE_TO_SAVE` 50→200.

One commit per tune:

```bash
git add js/DriftScore.js
git commit -m "Tune SCORE_SCALE 100 → 200"
```

- [ ] **Step 3: Stop**

When all 10 criteria pass, drift score shipped.

---

## Out of scope (logged for future)

- Drift style bonuses (donut, S-curve, sweep detection)
- Letter grades (S/A/B/C)
- Score-fed nitro
- Network leaderboards
- Per-corner breakdown
- Banner sound effects
- HUD theme variants for day/night
