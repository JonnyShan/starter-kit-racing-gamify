# Multi-Ghost (Top 3) — Design

**Date:** 2026-05-19
**Scope:** Race against the player's three fastest recorded laps simultaneously. Gold = 1st place ghost, silver = 2nd, bronze = 3rd. Persists across reloads. Migrates old single-ghost localStorage transparently.

## Problem

Single ghost rewards beating the most recent best. Multi-ghost gives a richer race feel: you can see three of your prior trajectories at once, and slotting into the top 3 (not just the top 1) becomes a goal.

## Non-goals

- More than 3 ghosts
- Lap time labels above each ghost head
- Per-ghost colored skid marks / smoke
- Friend / network ghosts
- Per-ghost slot configuration UI

## Design

### Storage schema

- New key: `racing.ghosts.{trackId}` = JSON `{ slots: [ { time, data }, ... ] }`, sorted by `time` ascending. Max 3 entries.
- `time` = lap time in seconds (Number).
- `data` = base64-encoded Float32Array (existing format).
- Migration: on load, if `racing.ghosts.{trackId}` is absent but `racing.ghost.{trackId}` exists, build a new schema with slot 0 = `{ time: bestLap, data: oldGhostBase64 }` where `bestLap = Number(localStorage['racing.bestLap.{trackId}'])` (falls back to 0). After migration, delete the legacy `racing.ghost.{trackId}` key.

Legacy `racing.bestLap.{trackId}` (managed by `LapTimer`) is untouched.

### Module surface

Keep class name `Ghost` (caller in main.js unchanged). Internals re-shaped:

```javascript
new Ghost( scene, trackId, vehicleModel, lapTimer )
ghost.update( dt, vehicle, lapTime )
ghost.dispose()
```

Internal state:
- `this.slots = [ { time, buffer }, ... ]` — up to 3 entries, Float32Array buffers, sorted by `time` ascending.
- `this.meshes = [ ... ]` — 3 ghost meshes (built up-front).
- `this.recordBuffer`, `this.recordCount`, `this._recordAccum` — current lap recording (unchanged).

### Mesh tints

```javascript
const GHOST_TINTS = [ 0xffd84a, 0xc0c8d8, 0xc89060 ]; // gold, silver, bronze
```

Three meshes built at construction:
```javascript
this.meshes = GHOST_TINTS.map( tint => this._buildGhostMesh( vehicleModel, tint ) );
this.meshes.forEach( m => scene.add( m ) );
```

`_buildGhostMesh` takes a tint argument now:
```javascript
_buildGhostMesh( vehicleModel, tint ) {
	const mesh = vehicleModel.clone( true );
	const material = new THREE.MeshBasicMaterial( {
		color: tint,
		transparent: true,
		opacity: GHOST_OPACITY,
		depthWrite: false,
	} );
	mesh.traverse( ... apply material ... );
	mesh.visible = false;
	return mesh;
}
```

### Recording

Unchanged — single ongoing `recordBuffer`.

### Slot insertion on lap complete

`_onLapComplete(time, isBest)`:
- `isBest` ignored — we decide insertion ourselves based on time vs slot times.
- If `time > GHOST_MAX_SECONDS` or `recordCount === 0` → discard.
- Find insertion index `i` where `time` < slot[i].time, else after last.
- If `i < MAX_SLOTS` (3):
  - Slice current recording into a buffer
  - Insert `{ time, buffer }` at index i
  - Drop the slot at index `MAX_SLOTS` if length > MAX_SLOTS
  - `_save()` writes the whole slots array
- Reset `recordCount`, `_recordAccum`.

```javascript
const MAX_SLOTS = 3;
```

### Persistence: save + load

```javascript
_save() {
	try {
		const payload = {
			slots: this.slots.map( s => ( {
				time: s.time,
				data: bufferToBase64( s.buffer ),
			} ) ),
		};
		localStorage.setItem( this.storageKey, JSON.stringify( payload ) );
	} catch {}
}

_load() {
	try {
		const raw = localStorage.getItem( this.storageKey );
		if ( raw ) {
			const payload = JSON.parse( raw );
			if ( payload && Array.isArray( payload.slots ) ) {
				this.slots = payload.slots
					.map( s => ( { time: Number( s.time ), buffer: base64ToBuffer( s.data ) } ) )
					.filter( s => Number.isFinite( s.time ) && s.buffer.length > 0 && s.buffer.length % GHOST_FLOATS_PER_SAMPLE === 0 )
					.sort( ( a, b ) => a.time - b.time )
					.slice( 0, MAX_SLOTS );
				return;
			}
		}
	} catch {}

	// Fall-through: try legacy single-ghost
	this._migrateLegacy();
}

_migrateLegacy() {
	try {
		const legacyKey = LEGACY_PREFIX + ( this.trackIdRaw || 'default' );
		const legacyBest = LEGACY_BEST_PREFIX + ( this.trackIdRaw || 'default' );
		const raw = localStorage.getItem( legacyKey );
		if ( ! raw ) return;
		const buf = base64ToBuffer( raw );
		if ( buf.length === 0 || buf.length % GHOST_FLOATS_PER_SAMPLE !== 0 ) return;
		const bestRaw = localStorage.getItem( legacyBest );
		const time = bestRaw !== null ? Number( bestRaw ) : 60;
		this.slots = [ { time: Number.isFinite( time ) ? time : 60, buffer: buf } ];
		this._save();
		localStorage.removeItem( legacyKey );
	} catch {}
}
```

Constants:
```javascript
const STORAGE_PREFIX = 'racing.ghosts.';
const LEGACY_PREFIX = 'racing.ghost.';
const LEGACY_BEST_PREFIX = 'racing.bestLap.';
```

`trackIdRaw` stored on `this` from constructor.

### Playback

`update(dt, vehicle, lapTime)`:
- Recording branch unchanged.
- Playback: for each slot in `this.slots`, interp position + slerp quaternion, set on the corresponding mesh. If fewer than 3 slots, hide unused meshes.

```javascript
for ( let i = 0; i < MAX_SLOTS; i ++ ) {
	const slot = this.slots[ i ];
	const mesh = this.meshes[ i ];
	if ( ! slot || ! this.lapTimer.running ) {
		mesh.visible = false;
		continue;
	}
	const buf = slot.buffer;
	const totalSamples = buf.length / GHOST_FLOATS_PER_SAMPLE;
	const idxFloat = lapTime * GHOST_SAMPLE_RATE;
	const i0 = Math.min( Math.floor( idxFloat ), totalSamples - 1 );
	const i1 = Math.min( i0 + 1, totalSamples - 1 );
	const t = i0 === i1 ? 0 : idxFloat - i0;
	const o0 = i0 * GHOST_FLOATS_PER_SAMPLE;
	const o1 = i1 * GHOST_FLOATS_PER_SAMPLE;
	mesh.position.set(
		buf[ o0     ] + ( buf[ o1     ] - buf[ o0     ] ) * t,
		buf[ o0 + 1 ] + ( buf[ o1 + 1 ] - buf[ o0 + 1 ] ) * t,
		buf[ o0 + 2 ] + ( buf[ o1 + 2 ] - buf[ o0 + 2 ] ) * t,
	);
	_qa.set( buf[ o0 + 3 ], buf[ o0 + 4 ], buf[ o0 + 5 ], buf[ o0 + 6 ] );
	_qb.set( buf[ o1 + 3 ], buf[ o1 + 4 ], buf[ o1 + 5 ], buf[ o1 + 6 ] );
	_qr.copy( _qa ).slerp( _qb, t );
	mesh.quaternion.copy( _qr );
	mesh.visible = true;
}
```

### dispose

Remove all 3 meshes + materials.

## Files touched

- Modify: `js/Ghost.js` only. ~120 LOC delta on top of current 197.

## Acceptance criteria

1. ☐ Existing best ghost still appears on first lap (legacy migration succeeded).
2. ☐ After legacy migration, `localStorage['racing.ghost.default']` is gone; `localStorage['racing.ghosts.default']` is a JSON string.
3. ☐ Complete a lap slower than previous best but faster than empty slot 2 → silver ghost appears on next lap; gold remains.
4. ☐ Three slots filled → bronze ghost appears on lap 4.
5. ☐ Beat slot 2 → gold/silver swap; bronze drops off; new bronze = old silver.
6. ☐ Run a lap slower than the bronze slot → no slot change, no new save.
7. ☐ FPS still 60 with 3 ghosts visible.
8. ☐ Drift / lap timer / drift score / atmosphere / decorations / day-night / countdown all unchanged.

## Risks

- **Legacy migration writes new key BEFORE deleting old.** Ordered intentionally so a failure mid-migration leaves the old data intact.
- **`racing.bestLap` is read but not removed.** LapTimer continues to use it. The two systems stay in sync because they fire from the same `onLapComplete` callback chain.
- **Quaternion drift accumulation across slots** — each slot's quaternions are independent, no risk.

## Tuning

- Silver/bronze tints feel wrong → swap `GHOST_TINTS` values.
- 3 ghosts too cluttered → drop `MAX_SLOTS` to 2.
- Per-ghost opacity differentiation → could add `GHOST_OPACITIES = [0.7, 0.55, 0.4]` and apply per slot, but skipped for now (YAGNI).

## Out of scope

- Lap time HUD label above each ghost
- Per-ghost colored skid marks
- Network / shared ghosts
- "Reset top 3" UI button
- Day/night tint variants for ghosts
