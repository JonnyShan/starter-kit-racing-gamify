# Ghost Car Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record best lap as a 30Hz position+quaternion trajectory; play back as a translucent blue car so the player races their previous best each lap.

**Architecture:** New `js/Ghost.js` module owns recording buffer, ghost mesh (clone of vehicle model with override blue translucent material), and persistence to `localStorage['racing.ghost.<trackId>']`. `LapTimer` gets one new field (`onLapComplete`) and one call site to fire it. `main.js` constructs `Ghost` after `vehicle` + `lapTimer` are ready and drives `ghost.update()` from the render loop.

**Tech Stack:** three.js 0.184.0, ES modules, base64-encoded `Float32Array` in localStorage. No test runner. Verification via browser drive-and-check per acceptance criteria.

**Spec:** [docs/superpowers/specs/2026-05-19-ghost-car-replay-design.md](../specs/2026-05-19-ghost-car-replay-design.md)

---

## File Structure

**Created:**
- `js/Ghost.js` — Ghost class: recording buffer, playback mesh, save/load. Single responsibility: best-lap trajectory replay.

**Modified:**
- `js/LapTimer.js` — add `onLapComplete = null` constructor field; fire it at end of `completeLap()`. ~3 lines.
- `js/main.js` — import `Ghost`, instantiate inside `loadTrack` after vehicle + lapTimer ready, call `ghost.update()` in render loop. ~4 lines.

---

## Task 1: Ghost module skeleton + constants

**Files:**
- Create: `js/Ghost.js`

- [ ] **Step 1: Write Ghost.js skeleton**

```javascript
import * as THREE from 'three';

const GHOST_SAMPLE_RATE = 30;
const GHOST_SAMPLE_INTERVAL = 1 / GHOST_SAMPLE_RATE;
const GHOST_FLOATS_PER_SAMPLE = 7;
const GHOST_MAX_SECONDS = 300;
const GHOST_MAX_SAMPLES = GHOST_SAMPLE_RATE * GHOST_MAX_SECONDS;
const GHOST_COLOR = 0x4a9eff;
const GHOST_OPACITY = 0.55;
const STORAGE_PREFIX = 'racing.ghost.';

const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _qr = new THREE.Quaternion();

export class Ghost {

	constructor( scene, trackId, vehicleModel, lapTimer ) {

		this.scene = scene;
		this.storageKey = STORAGE_PREFIX + ( trackId || 'default' );
		this.lapTimer = lapTimer;

		this.recordBuffer = new Float32Array( GHOST_MAX_SAMPLES * GHOST_FLOATS_PER_SAMPLE );
		this.recordCount = 0;
		this._recordAccum = 0;

		this.ghostBuffer = null;
		this.mesh = null;

	}

	update( dt, vehicle, lapTime ) {
		// filled in later tasks
	}

	dispose() {
		// filled in later tasks
	}

}
```

- [ ] **Step 2: Sanity import in main.js (temp)**

In `js/main.js`, after `import { ColorMapGLTFLoader } from './Loader.js';` and the existing `import { Sky } from './Sky.js';` block, add:

```javascript
import { Ghost } from './Ghost.js';
```

Reload page. Expected: no console error, no visual change.

- [ ] **Step 3: Commit**

```bash
git add js/Ghost.js js/main.js
git commit -m "Add Ghost module skeleton with constants"
```

---

## Task 2: Build ghost mesh from vehicle model

**Files:**
- Modify: `js/Ghost.js`

- [ ] **Step 1: Add ghost mesh builder + invoke from constructor**

In `js/Ghost.js`, add a method below the constructor (inside the class):

```javascript
	_buildGhostMesh( vehicleModel ) {

		const mesh = vehicleModel.clone( true );

		const material = new THREE.MeshBasicMaterial( {
			color: GHOST_COLOR,
			transparent: true,
			opacity: GHOST_OPACITY,
			depthWrite: false,
		} );

		mesh.traverse( ( child ) => {

			if ( child.isMesh ) {

				child.material = material;
				child.castShadow = false;
				child.receiveShadow = false;

			}

		} );

		mesh.visible = false;
		return mesh;

	}
```

Then in the constructor, after `this.ghostBuffer = null;` line, replace `this.mesh = null;` with:

```javascript
		this.mesh = this._buildGhostMesh( vehicleModel );
		scene.add( this.mesh );
```

- [ ] **Step 2: Verify no visible change yet**

Reload. Expected: no console error. Ghost mesh exists in scene but is hidden (`visible = false`). Confirm via DevTools:

```javascript
// In console (replace with actual scene reference if different):
// No direct access expected; just confirm no errors. Visual check: no second car visible.
```

- [ ] **Step 3: Commit**

```bash
git add js/Ghost.js
git commit -m "Build translucent blue ghost mesh from vehicle model"
```

---

## Task 3: Recording branch

**Files:**
- Modify: `js/Ghost.js` (update method)

- [ ] **Step 1: Implement recording in update()**

Replace the placeholder `update()` body in `js/Ghost.js`:

```javascript
	update( dt, vehicle, lapTime ) {

		if ( this.lapTimer.running && this.recordCount < GHOST_MAX_SAMPLES ) {

			this._recordAccum += dt;
			while ( this._recordAccum >= GHOST_SAMPLE_INTERVAL && this.recordCount < GHOST_MAX_SAMPLES ) {

				const o = this.recordCount * GHOST_FLOATS_PER_SAMPLE;
				const p = vehicle.container.position;
				const q = vehicle.container.quaternion;
				this.recordBuffer[ o     ] = p.x;
				this.recordBuffer[ o + 1 ] = p.y;
				this.recordBuffer[ o + 2 ] = p.z;
				this.recordBuffer[ o + 3 ] = q.x;
				this.recordBuffer[ o + 4 ] = q.y;
				this.recordBuffer[ o + 5 ] = q.z;
				this.recordBuffer[ o + 6 ] = q.w;
				this.recordCount += 1;
				this._recordAccum -= GHOST_SAMPLE_INTERVAL;

			}

		}

	}
```

- [ ] **Step 2: Verify in browser (instrumented)**

Open the game. Add a one-shot console log inside the while loop:

```javascript
				if ( this.recordCount % 30 === 0 ) console.log( 'recorded', this.recordCount, 'samples' );
```

Reload. Drive until lap-timer starts running (cross any input threshold). Expected: console prints "recorded 30 samples", "recorded 60 samples", ... Roughly once per second.

Remove the console.log before committing.

- [ ] **Step 3: Commit**

```bash
git add js/Ghost.js
git commit -m "Record vehicle position + quaternion at 30Hz while lap running"
```

---

## Task 4: Persistence (save + load) helpers

**Files:**
- Modify: `js/Ghost.js`

- [ ] **Step 1: Add base64 codec helpers + save/load methods**

Inside `js/Ghost.js`, between the class top and constructor (module-level), add:

```javascript
function bufferToBase64( float32 ) {

	const bytes = new Uint8Array( float32.buffer, float32.byteOffset, float32.byteLength );
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

Inside the class, add two methods (after `_buildGhostMesh`):

```javascript
	_save() {

		if ( ! this.ghostBuffer ) return;
		try {
			localStorage.setItem( this.storageKey, bufferToBase64( this.ghostBuffer ) );
		} catch {}

	}

	_load() {

		try {
			const str = localStorage.getItem( this.storageKey );
			if ( ! str ) return;
			const buf = base64ToBuffer( str );
			if ( buf.length === 0 || buf.length % GHOST_FLOATS_PER_SAMPLE !== 0 ) return;
			this.ghostBuffer = buf;
		} catch {}

	}
```

In the constructor, call `_load` at the end:

```javascript
		this.mesh = this._buildGhostMesh( vehicleModel );
		scene.add( this.mesh );

		this._load();
```

- [ ] **Step 2: Verify load doesn't break on empty storage**

Open DevTools, run:

```javascript
localStorage.removeItem( 'racing.ghost.default' );
```

Reload. Expected: no error. `ghost.ghostBuffer` is null (no replay until first save).

- [ ] **Step 3: Commit**

```bash
git add js/Ghost.js
git commit -m "Add base64 persistence helpers and _load on construct"
```

---

## Task 5: LapTimer onLapComplete callback

**Files:**
- Modify: `js/LapTimer.js:52` (constructor) and around line 192 (end of completeLap)

- [ ] **Step 1: Add callback field to constructor**

In `js/LapTimer.js`, find:

```javascript
		this.running = false;
```

Add after it:

```javascript
		this.onLapComplete = null;
```

- [ ] **Step 2: Fire callback at end of completeLap**

In `js/LapTimer.js`, find the end of `completeLap()`:

```javascript
		const color = isBest ? '#5af168' : '#ff6e6e';
		this.currentEl.animate(
			[ { color }, { color }, { color: '#fff' } ],
			{ duration: 1200, easing: 'ease-out' }
		);

	}
```

Replace with:

```javascript
		const color = isBest ? '#5af168' : '#ff6e6e';
		this.currentEl.animate(
			[ { color }, { color }, { color: '#fff' } ],
			{ duration: 1200, easing: 'ease-out' }
		);

		if ( this.onLapComplete ) this.onLapComplete( this.lastLap, isBest );

	}
```

- [ ] **Step 3: Verify no behaviour change in browser**

Reload. Drive a lap. Confirm timer still works, no console error. Callback fires but no one is listening yet.

- [ ] **Step 4: Commit**

```bash
git add js/LapTimer.js
git commit -m "Add LapTimer.onLapComplete callback fired after completeLap"
```

---

## Task 6: Ghost subscribes + saves on best lap

**Files:**
- Modify: `js/Ghost.js`

- [ ] **Step 1: Implement _onLapComplete and subscribe in constructor**

In `js/Ghost.js`, add method after `_load`:

```javascript
	_onLapComplete( time, isBest ) {

		if ( isBest && time <= GHOST_MAX_SECONDS && this.recordCount > 0 ) {

			this.ghostBuffer = this.recordBuffer.slice(
				0,
				this.recordCount * GHOST_FLOATS_PER_SAMPLE,
			);
			this._save();

		}

		this.recordCount = 0;
		this._recordAccum = 0;

	}
```

In constructor, after `this._load()` line, add:

```javascript
		this.lapTimer.onLapComplete = ( time, isBest ) => this._onLapComplete( time, isBest );
```

- [ ] **Step 2: Verify in browser (no ghost rendering yet)**

Reload. Drive a complete lap. Open DevTools, run:

```javascript
localStorage.getItem( 'racing.ghost.default' )
```

Expected: a long base64 string. (If you're driving on a non-default track, replace `default` with the trackId from URL `?map=<id>`.)

If `null`, lap didn't complete-as-best (existing best is faster). Run:

```javascript
localStorage.removeItem( 'racing.bestLap.default' );
localStorage.removeItem( 'racing.ghost.default' );
location.reload();
```

Then drive a fresh first lap and check again.

- [ ] **Step 3: Commit**

```bash
git add js/Ghost.js
git commit -m "Persist best-lap recording into ghost buffer on completeLap"
```

---

## Task 7: Playback branch

**Files:**
- Modify: `js/Ghost.js` (update method)

- [ ] **Step 1: Add playback to update()**

Replace `update()` with:

```javascript
	update( dt, vehicle, lapTime ) {

		// Recording
		if ( this.lapTimer.running && this.recordCount < GHOST_MAX_SAMPLES ) {

			this._recordAccum += dt;
			while ( this._recordAccum >= GHOST_SAMPLE_INTERVAL && this.recordCount < GHOST_MAX_SAMPLES ) {

				const o = this.recordCount * GHOST_FLOATS_PER_SAMPLE;
				const p = vehicle.container.position;
				const q = vehicle.container.quaternion;
				this.recordBuffer[ o     ] = p.x;
				this.recordBuffer[ o + 1 ] = p.y;
				this.recordBuffer[ o + 2 ] = p.z;
				this.recordBuffer[ o + 3 ] = q.x;
				this.recordBuffer[ o + 4 ] = q.y;
				this.recordBuffer[ o + 5 ] = q.z;
				this.recordBuffer[ o + 6 ] = q.w;
				this.recordCount += 1;
				this._recordAccum -= GHOST_SAMPLE_INTERVAL;

			}

		}

		// Playback
		if ( this.ghostBuffer && this.lapTimer.running ) {

			const totalSamples = this.ghostBuffer.length / GHOST_FLOATS_PER_SAMPLE;
			const idxFloat = lapTime * GHOST_SAMPLE_RATE;
			const i0 = Math.min( Math.floor( idxFloat ), totalSamples - 1 );
			const i1 = Math.min( i0 + 1, totalSamples - 1 );
			const t = i0 === i1 ? 0 : idxFloat - i0;

			const o0 = i0 * GHOST_FLOATS_PER_SAMPLE;
			const o1 = i1 * GHOST_FLOATS_PER_SAMPLE;
			const b = this.ghostBuffer;

			this.mesh.position.set(
				b[ o0     ] + ( b[ o1     ] - b[ o0     ] ) * t,
				b[ o0 + 1 ] + ( b[ o1 + 1 ] - b[ o0 + 1 ] ) * t,
				b[ o0 + 2 ] + ( b[ o1 + 2 ] - b[ o0 + 2 ] ) * t,
			);

			_qa.set( b[ o0 + 3 ], b[ o0 + 4 ], b[ o0 + 5 ], b[ o0 + 6 ] );
			_qb.set( b[ o1 + 3 ], b[ o1 + 4 ], b[ o1 + 5 ], b[ o1 + 6 ] );
			_qr.copy( _qa ).slerp( _qb, t );
			this.mesh.quaternion.copy( _qr );

			this.mesh.visible = true;

		} else {

			this.mesh.visible = false;

		}

	}
```

- [ ] **Step 2: Wire ghost.update into main.js render loop**

In `js/main.js`, find the render loop section where `lapTimer.update(...)` is called (around line 286). Add immediately after:

```javascript
		ghost.update( dt, vehicle, lapTimer.currentLapTime );
```

- [ ] **Step 3: Instantiate ghost inside loadTrack**

In `js/main.js`, find `init()` where `lapTimer` is constructed (around line 253: `const lapTimer = new LapTimer( customCells, mapParam );`). Immediately after, add:

```javascript
	const ghost = new Ghost( scene, mapParam, models[ 'vehicle-truck-yellow' ], lapTimer );
```

Both `lapTimer` and the render loop (`animate` function around line 275) live inside the same `init()` scope, so no hoisting needed.

- [ ] **Step 4: Verify in browser**

Reload page. You should already have a ghost buffer from Task 6. Drive again. Expected:
- Translucent blue car appears at start line when lap-timer starts running.
- Ghost follows the previous best trajectory.
- Ghost is non-solid (you can drive through it).

If ghost is invisible: check that `localStorage['racing.ghost.default']` (or your trackId) exists.

If ghost is solid black or wrong color: ensure the override material was applied — check Task 2.

If ghost stutters: check sample rate — should be 30Hz. Could be `dt` is very large during loading frames; safe to ignore.

- [ ] **Step 5: Commit**

```bash
git add js/Ghost.js js/main.js
git commit -m "Play back ghost trajectory aligned with current lap time"
```

---

## Task 8: dispose() for completeness

**Files:**
- Modify: `js/Ghost.js`

- [ ] **Step 1: Implement dispose**

Replace placeholder `dispose()`:

```javascript
	dispose() {

		if ( this.mesh ) {

			this.scene.remove( this.mesh );
			this.mesh.traverse( ( child ) => {

				if ( child.isMesh ) child.material.dispose();

			} );
			this.mesh = null;

		}

		if ( this.lapTimer ) this.lapTimer.onLapComplete = null;

	}
```

- [ ] **Step 2: Commit (no behaviour change)**

```bash
git add js/Ghost.js
git commit -m "Implement Ghost.dispose() for clean teardown"
```

---

## Task 9: Full acceptance pass

**Files:** None.

- [ ] **Step 1: Run acceptance criteria from spec**

From [the spec](../specs/2026-05-19-ghost-car-replay-design.md#acceptance-criteria):

Reset state for a clean test:
```javascript
localStorage.removeItem( 'racing.bestLap.default' );
localStorage.removeItem( 'racing.ghost.default' );
location.reload();
```

Then verify:

1. ☐ First lap on a track with no prior best → no ghost visible. Drive to completion across finish line.
2. ☐ Second lap → translucent blue car appears at start line, follows your previous trajectory.
3. ☐ Beat previous best → on third lap, ghost follows new (faster) line.
4. ☐ Run a slower lap deliberately → ghost still plays previous best; reaches finish line ahead; freezes parked past it.
5. ☐ Refresh page → ghost persists.
6. ☐ DevTools: `localStorage['racing.ghost.default']` returns base64 string.
7. ☐ Ghost is visibly translucent blue, no shadow, no collision.
8. ☐ FPS stays at 60 (Stats overlay).
9. ☐ Drift, lap timer, drift marks, day atmosphere, audio unchanged.

- [ ] **Step 2: Tuning if needed**

Tunables at top of `js/Ghost.js`:
- Ghost too see-through → `GHOST_OPACITY` 0.55 → 0.75
- Ghost color too neon → `GHOST_COLOR` 0x4a9eff → 0x6fb2ff
- Playback stutters → bump `GHOST_SAMPLE_RATE` 30 → 60 (will require re-record to refill at new rate; just drive a new best lap)

One commit per tune:

```bash
git add js/Ghost.js
git commit -m "Tune GHOST_OPACITY 0.55 → 0.7"  # example
```

- [ ] **Step 3: Stop**

When all 9 criteria pass, ghost is shipped.

---

## Out of scope (logged for future plans)

- Multi-ghost (race vs your top-3 personal bests)
- Ghost color shift when player ahead vs behind
- Network ghosts (online leaderboard)
- Smoke trail behind ghost during its drift sections
- Ghost transparency fade by distance from camera
- "Reset ghost" button in UI
- Per-time-of-day ghost variants
