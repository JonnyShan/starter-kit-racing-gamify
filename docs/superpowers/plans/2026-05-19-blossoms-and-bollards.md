# Cherry Blossoms + Corner Bollards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recolor forest trees to pink sakura via texture pink-shift on green pixels; add red/white striped procedural bollards along the outer arc of each track-corner cell.

**Architecture:** Two new ES modules. `js/SakuraTexture.js` exports an async builder that loads `models/Textures/colormap.png` into a canvas, pink-shifts green pixels (brightness preserved), and returns a `THREE.CanvasTexture`. `js/Bollards.js` exports `buildBollards(scene, cells)` that filters for `track-corner` cells, computes 5 outer-arc positions per corner (rotated by `ORIENT_DEG`), and assembles a single `THREE.InstancedMesh`. `main.js` awaits the sakura texture in `loadModels`, patches the `decoration-forest` material, and calls `buildBollards` after `buildTrack`.

**Tech Stack:** three.js 0.184.0 (CanvasTexture, InstancedMesh, CylinderGeometry), browser Canvas 2D, ES modules. No tests.

**Spec:** [docs/superpowers/specs/2026-05-19-blossoms-and-bollards-design.md](../specs/2026-05-19-blossoms-and-bollards-design.md)

---

## File Structure

**Created:**
- `js/SakuraTexture.js` — async builder for pink-shifted forest colormap. Single responsibility: texture transform.
- `js/Bollards.js` — `buildBollards(scene, cells)` function. Single responsibility: corner-bollard InstancedMesh.

**Modified:**
- `js/main.js` — import both modules; await `buildSakuraTexture()` in `loadModels` after `Promise.all` resolves; patch `decoration-forest` mesh materials; call `buildBollards(scene, customCells || TRACK_CELLS)` in `loadTrack` after `buildTrack`.

---

## Task 1: SakuraTexture module skeleton

**Files:**
- Create: `js/SakuraTexture.js`

- [ ] **Step 1: Create empty module**

```javascript
import * as THREE from 'three';

const SAKURA_R = 255;
const SAKURA_G = 183;
const SAKURA_B = 197;
const GREEN_MIN = 80;
const GREEN_DELTA = 15;
const COLORMAP_URL = 'models/Textures/colormap.png';

export function buildSakuraTexture() {

	return Promise.resolve( null );

}
```

- [ ] **Step 2: Sanity import in main.js (temp)**

In `js/main.js`, after the existing import block (after `import { Ghost } from './Ghost.js';`), add:

```javascript
import { buildSakuraTexture } from './SakuraTexture.js';
```

Reload page. Expected: no console error, no visual change.

- [ ] **Step 3: Commit**

```bash
git add js/SakuraTexture.js js/main.js
git commit -m "Add SakuraTexture module skeleton"
```

---

## Task 2: Load colormap as Image + draw to canvas

**Files:**
- Modify: `js/SakuraTexture.js`

- [ ] **Step 1: Implement loader + canvas draw**

Replace the export in `js/SakuraTexture.js`:

```javascript
export function buildSakuraTexture() {

	return new Promise( ( resolve, reject ) => {

		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => {

			const canvas = document.createElement( 'canvas' );
			canvas.width = img.width;
			canvas.height = img.height;
			const ctx = canvas.getContext( '2d' );
			ctx.drawImage( img, 0, 0 );
			resolve( canvas );

		};
		img.onerror = reject;
		img.src = COLORMAP_URL;

	} );

}
```

(Returns the canvas itself for now — pink-shift comes next task. Caller will type-check before texture-ifying.)

- [ ] **Step 2: Verify in browser**

Reload page. Expected: no error. Open DevTools console after page loads and run (replace with appropriate trigger if main.js calls it):

```javascript
import('./js/SakuraTexture.js').then( m => m.buildSakuraTexture().then( c => console.log( 'canvas:', c.width, c.height ) ) );
```

Expected: `canvas: 512 512`.

- [ ] **Step 3: Commit**

```bash
git add js/SakuraTexture.js
git commit -m "Load colormap PNG and draw to OffscreenCanvas"
```

---

## Task 3: Pink-shift pixels + return CanvasTexture

**Files:**
- Modify: `js/SakuraTexture.js`

- [ ] **Step 1: Add pixel shift then convert to CanvasTexture**

Replace the export:

```javascript
export function buildSakuraTexture() {

	return new Promise( ( resolve, reject ) => {

		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => {

			const canvas = document.createElement( 'canvas' );
			canvas.width = img.width;
			canvas.height = img.height;
			const ctx = canvas.getContext( '2d' );
			ctx.drawImage( img, 0, 0 );

			const imageData = ctx.getImageData( 0, 0, canvas.width, canvas.height );
			const data = imageData.data;

			for ( let i = 0; i < data.length; i += 4 ) {

				const r = data[ i     ];
				const g = data[ i + 1 ];
				const b = data[ i + 2 ];

				if ( g > GREEN_MIN && g > r + GREEN_DELTA && g > b + GREEN_DELTA ) {

					const factor = g / 255;
					data[ i     ] = SAKURA_R * factor;
					data[ i + 1 ] = SAKURA_G * factor;
					data[ i + 2 ] = SAKURA_B * factor;

				}

			}

			ctx.putImageData( imageData, 0, 0 );

			const tex = new THREE.CanvasTexture( canvas );
			tex.colorSpace = THREE.SRGBColorSpace;
			tex.flipY = false;
			tex.anisotropy = 4;
			resolve( tex );

		};
		img.onerror = reject;
		img.src = COLORMAP_URL;

	} );

}
```

- [ ] **Step 2: Verify in browser**

Reload. In DevTools console:

```javascript
import('./js/SakuraTexture.js').then( m => m.buildSakuraTexture().then( t => console.log( 'tex:', t.image.width, 'pinky' ) ) );
```

Expected: `tex: 512 pinky`. No error.

- [ ] **Step 3: Commit**

```bash
git add js/SakuraTexture.js
git commit -m "Pink-shift green pixels and return as CanvasTexture"
```

---

## Task 4: Patch decoration-forest material in main.js

**Files:**
- Modify: `js/main.js` (loadModels function)

- [ ] **Step 1: Append patch after Promise.all**

In `js/main.js`, locate the end of `loadModels` (line 124: `await Promise.all( promises );` followed by `}` on line 126). `models` is a module-level `const`, mutated by load callbacks — there is no `return models` to modify. Replace:

```javascript
	await Promise.all( promises );

}
```

with:

```javascript
	await Promise.all( promises );

	const sakura = await buildSakuraTexture();
	const forest = models[ 'decoration-forest' ];
	if ( forest ) {

		forest.traverse( ( child ) => {

			if ( child.isMesh ) {

				child.material = child.material.clone();
				child.material.map = sakura;
				child.material.needsUpdate = true;

			}

		} );

	}

}
```

- [ ] **Step 2: Verify in browser**

Reload page. Expected: all forest trees render PINK instead of green. Tents and vehicles unchanged. Drive around — pink trees ring the track. Trunks remain brown.

If trees still green: check that `buildSakuraTexture` resolved (look for promise errors). If brown trunks turned pink too: tighten `GREEN_MIN` or `GREEN_DELTA` in `SakuraTexture.js`.

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "Patch decoration-forest material with sakura colormap"
```

---

## Task 5: Bollards module skeleton + stripe texture

**Files:**
- Create: `js/Bollards.js`

- [ ] **Step 1: Create module with constants + stripe texture generator**

```javascript
import * as THREE from 'three';
import { CELL_RAW, GRID_SCALE, ORIENT_DEG } from './Track.js';

const BOLLARD_RADIUS = 0.12;
const BOLLARD_HEIGHT = 1.0;
const BOLLARDS_PER_CORNER = 5;
const BOLLARD_OFFSET = 0.5;
const BOLLARD_BASE_LIFT = 0.05;
const BOLLARD_ANGLES_DEG = [ 5, 25, 45, 65, 85 ];
const STRIPE_RED = '#c43a2c';
const STRIPE_WHITE = '#ffffff';

function makeStripeTexture() {

	const w = 32;
	const h = 128;
	const canvas = document.createElement( 'canvas' );
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext( '2d' );

	ctx.fillStyle = STRIPE_RED;
	ctx.fillRect( 0, 0, w, h );

	ctx.fillStyle = STRIPE_WHITE;
	const bands = [ 18, 60, 100 ];
	const bandHeight = 12;
	for ( const y of bands ) ctx.fillRect( 0, y, w, bandHeight );

	const tex = new THREE.CanvasTexture( canvas );
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 4;
	return tex;

}

export function buildBollards( scene, cells ) {

	return null;

}
```

- [ ] **Step 2: Sanity import in main.js (temp)**

In `js/main.js` imports, add:

```javascript
import { buildBollards } from './Bollards.js';
```

Reload page. Expected: no console error. `buildBollards` defined but uncalled.

- [ ] **Step 3: Commit**

```bash
git add js/Bollards.js js/main.js
git commit -m "Add Bollards module skeleton with stripe texture generator"
```

---

## Task 6: Corner detection + arc geometry math

**Files:**
- Modify: `js/Bollards.js`

- [ ] **Step 1: Implement buildBollards**

Replace `buildBollards`:

```javascript
export function buildBollards( scene, cells ) {

	const corners = cells.filter( ( c ) => c[ 2 ] === 'track-corner' );
	if ( corners.length === 0 ) return null;

	const stripeTex = makeStripeTexture();
	const material = new THREE.MeshLambertMaterial( { map: stripeTex } );
	const geometry = new THREE.CylinderGeometry( BOLLARD_RADIUS, BOLLARD_RADIUS, BOLLARD_HEIGHT, 12 );

	const count = corners.length * BOLLARDS_PER_CORNER;
	const inst = new THREE.InstancedMesh( geometry, material, count );
	inst.castShadow = true;
	inst.receiveShadow = false;

	const dummy = new THREE.Object3D();
	const cellWorld = CELL_RAW * GRID_SCALE;
	const cellHalfWorld = cellWorld / 2;
	const outerRadius = ( 2 * ( CELL_RAW / 2 ) - 0.25 ) * GRID_SCALE;
	const placeRadius = outerRadius - BOLLARD_OFFSET;
	const trackY = - 0.5 + BOLLARD_HEIGHT / 2 + BOLLARD_BASE_LIFT;

	let idx = 0;
	for ( const [ gx, gz, _, orient ] of corners ) {

		const cellCenterX = ( gx + 0.5 ) * cellWorld;
		const cellCenterZ = ( gz + 0.5 ) * cellWorld;
		const orientDeg = ORIENT_DEG[ orient ] ?? 0;
		const orientRad = orientDeg * Math.PI / 180;

		// Default arc center (orient 0) is at cell-local (-CELL_HALF, +CELL_HALF).
		// Rotate that offset by orient around cell center.
		const arcLocalX = - cellHalfWorld;
		const arcLocalZ = + cellHalfWorld;
		const cos = Math.cos( orientRad );
		const sin = Math.sin( orientRad );
		const arcWorldX = cellCenterX + arcLocalX * cos - arcLocalZ * sin;
		const arcWorldZ = cellCenterZ + arcLocalX * sin + arcLocalZ * cos;

		for ( const ang of BOLLARD_ANGLES_DEG ) {

			const a = ang * Math.PI / 180 + orientRad;
			const x = arcWorldX + placeRadius * Math.cos( a );
			const z = arcWorldZ - placeRadius * Math.sin( a );
			dummy.position.set( x, trackY, z );
			dummy.rotation.set( 0, 0, 0 );
			dummy.updateMatrix();
			inst.setMatrixAt( idx, dummy.matrix );
			idx += 1;

		}

	}

	inst.instanceMatrix.needsUpdate = true;
	scene.add( inst );
	return inst;

}
```

- [ ] **Step 2: Wire into main.js loadTrack**

In `js/main.js`, find the `buildTrack( scene, models, customCells );` call inside `loadTrack`. Immediately after, add:

```javascript
	buildBollards( scene, customCells || ( await import( './Track.js' ) ).TRACK_CELLS );
```

Alternatively (cleaner): import `TRACK_CELLS` at the top of `main.js` alongside the other Track exports. Check existing imports for `buildTrack` — they look like `import { buildTrack, decodeCells, computeSpawnPosition, computeTrackBounds } from './Track.js';`. Append `TRACK_CELLS`:

```javascript
import { buildTrack, decodeCells, computeSpawnPosition, computeTrackBounds, TRACK_CELLS } from './Track.js';
```

Then replace the call:

```javascript
	buildBollards( scene, customCells || TRACK_CELLS );
```

- [ ] **Step 3: Verify in browser**

Reload page. Expected: at each track-corner cell, 5 vertical bollards stand along the outer arc, each striped red with three horizontal white bands.

If bollards appear on the INSIDE of the corner (in the racing line): the local arc-center offset sign is wrong. Flip `arcLocalX` to `+cellHalfWorld` and `arcLocalZ` to `-cellHalfWorld`, or rotate base angles by 180° (add `Math.PI` to `orientRad` in the angle loop).

If bollards appear on adjacent cell instead of own corner: the rotation math has a sign issue. Verify by hard-coding `orientRad = 0` and checking first corner only.

- [ ] **Step 4: Commit**

```bash
git add js/Bollards.js js/main.js
git commit -m "Build instanced bollards along outer arc of each track corner"
```

---

## Task 7: Acceptance pass + tune

**Files:** None.

- [ ] **Step 1: Walk acceptance criteria from spec**

From [the spec](../specs/2026-05-19-blossoms-and-bollards-design.md#acceptance-criteria):

1. ☐ All forest trees pink/sakura, trunks brown.
2. ☐ Tents + other decorations unaffected.
3. ☐ Each track-corner has ~5 striped red bollards along outer arc.
4. ☐ Bollards upright, base on ground, ~1m tall.
5. ☐ Bollards do not block player (no collision — wall handles crashes).
6. ☐ Vehicle GLBs unchanged color.
7. ☐ FPS still 60.
8. ☐ Drift, lap timer, ghost car, day atmosphere unchanged.

- [ ] **Step 2: Tune if needed**

Tunables in `js/SakuraTexture.js` (top) and `js/Bollards.js` (top):

- Sakura too saturated → `SAKURA_R 255→240, SAKURA_G 183→160, SAKURA_B 197→175`
- Greens leaking onto non-foliage → tighten `GREEN_MIN 80→120` or `GREEN_DELTA 15→30`
- Bollards too few per corner → `BOLLARDS_PER_CORNER 5→7`, then adjust `BOLLARD_ANGLES_DEG` array
- Bollards too thin → `BOLLARD_RADIUS 0.12→0.18`
- Bollards too close to wall → bump `BOLLARD_OFFSET 0.5→0.8`
- Bollards too short → `BOLLARD_HEIGHT 1.0→1.3` (also bump `BOLLARD_BASE_LIFT` accordingly)

One tune = one commit:

```bash
git add js/SakuraTexture.js  # or js/Bollards.js
git commit -m "Tune GREEN_MIN 80 → 120"
```

- [ ] **Step 3: Stop**

When all 8 criteria pass, blossoms + bollards shipped.

---

## Out of scope (logged for future)

- Mixed pink/green forest variants
- Per-tree scale jitter / wind sway
- Animated specular reflectors on bollards
- Alternative bollard variants (cones, K-rails)
- Day/night blossom color variant
- Falling sakura petal particles
