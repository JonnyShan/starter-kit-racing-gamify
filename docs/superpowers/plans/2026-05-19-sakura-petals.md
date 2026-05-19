# Sakura Petals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 200 pink petal particles drift down around the camera with gentle sideways sway; respawn when below ground or outside the camera field.

**Architecture:** New `js/Petals.js` exposes `Petals` class. Allocates Float32 position + phase arrays, builds a procedural petal alpha texture (canvas), wraps a `THREE.BufferGeometry` + `THREE.PointsMaterial` + `THREE.Points`. `update(dt, cameraPosition)` advances motion and respawns out-of-field petals. `main.js` instantiates and drives update.

**Tech Stack:** three.js 0.184.0 (Points, PointsMaterial, BufferGeometry, CanvasTexture), Canvas 2D, vanilla ES modules. No tests.

**Spec:** [docs/superpowers/specs/2026-05-19-sakura-petals-design.md](../specs/2026-05-19-sakura-petals-design.md)

---

## File Structure

**Created:**
- `js/Petals.js` — petal field. One responsibility: ambient petal particles. ~90 LOC.

**Modified:**
- `js/main.js` — import + instantiate + drive update. ~3 LOC.

---

## Task 1: Petals module skeleton + constants

**Files:**
- Create: `js/Petals.js`

- [ ] **Step 1: Write skeleton**

```javascript
import * as THREE from 'three';

const PETAL_COUNT = 200;
const PETAL_FALL_SPEED = 1.5;
const PETAL_SWAY_AMPLITUDE = 0.3;
const PETAL_SIZE = 0.4;
const PETAL_FIELD_RADIUS = 30;
const PETAL_TOP_Y = 25;
const PETAL_BOTTOM_Y = 0;
const PETAL_COLOR = 0xffb7c5;

export class Petals {

	constructor( scene ) {

		this.scene = scene;
		this._time = 0;
		this.positions = null;
		this.phases = null;
		this.posAttr = null;
		this.points = null;

	}

	update( dt, cameraPosition ) {
	}

	dispose() {
	}

}
```

- [ ] **Step 2: Sanity import in main.js**

In `js/main.js`, after `import { DriftScore } from './DriftScore.js';` add:

```javascript
import { Petals } from './Petals.js';
```

Reload page. Expected: no console error, no visual change.

- [ ] **Step 3: Commit**

```bash
git add js/Petals.js js/main.js
git commit -m "Add Petals module skeleton with constants"
```

---

## Task 2: Procedural petal texture

**Files:**
- Modify: `js/Petals.js`

- [ ] **Step 1: Add texture generator**

In `js/Petals.js`, add a module-level function before the class:

```javascript
function makePetalTexture() {

	const size = 64;
	const canvas = document.createElement( 'canvas' );
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext( '2d' );

	const cx = size / 2;
	const cy = size / 2;
	const rx = 18;
	const ry = 12;

	// Soft alpha oval via radial gradient masked to ellipse.
	const grad = ctx.createRadialGradient( cx, cy, 0, cx, cy, rx );
	grad.addColorStop( 0, 'rgba(255,255,255,1)' );
	grad.addColorStop( 0.6, 'rgba(255,255,255,0.7)' );
	grad.addColorStop( 1, 'rgba(255,255,255,0)' );

	ctx.fillStyle = grad;
	ctx.beginPath();
	ctx.ellipse( cx, cy, rx, ry, 0, 0, Math.PI * 2 );
	ctx.fill();

	const tex = new THREE.CanvasTexture( canvas );
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 4;
	return tex;

}
```

- [ ] **Step 2: Verify in browser**

Reload. No console error. Texture unused yet.

- [ ] **Step 3: Commit**

```bash
git add js/Petals.js
git commit -m "Add procedural petal alpha texture"
```

---

## Task 3: Build Points geometry + material

**Files:**
- Modify: `js/Petals.js` (constructor)

- [ ] **Step 1: Allocate arrays and build Points object**

Replace the constructor body in `js/Petals.js`:

```javascript
	constructor( scene ) {

		this.scene = scene;
		this._time = 0;

		this.positions = new Float32Array( PETAL_COUNT * 3 );
		this.phases = new Float32Array( PETAL_COUNT );

		for ( let i = 0; i < PETAL_COUNT; i ++ ) {

			this.positions[ i * 3 + 0 ] = ( Math.random() - 0.5 ) * 2 * PETAL_FIELD_RADIUS;
			this.positions[ i * 3 + 1 ] = PETAL_BOTTOM_Y + Math.random() * ( PETAL_TOP_Y - PETAL_BOTTOM_Y );
			this.positions[ i * 3 + 2 ] = ( Math.random() - 0.5 ) * 2 * PETAL_FIELD_RADIUS;
			this.phases[ i ] = Math.random() * Math.PI * 2;

		}

		const geometry = new THREE.BufferGeometry();
		this.posAttr = new THREE.BufferAttribute( this.positions, 3 );
		this.posAttr.setUsage( THREE.DynamicDrawUsage );
		geometry.setAttribute( 'position', this.posAttr );

		const material = new THREE.PointsMaterial( {
			map: makePetalTexture(),
			color: PETAL_COLOR,
			size: PETAL_SIZE,
			sizeAttenuation: true,
			transparent: true,
			depthWrite: false,
		} );

		this.points = new THREE.Points( geometry, material );
		this.points.frustumCulled = false;
		scene.add( this.points );

	}
```

- [ ] **Step 2: Verify in browser**

Reload. Expected: ~200 pink dots floating motionless in the air around origin. They sit static until `update()` is wired.

If you see no dots: open DevTools console — likely the Points wasn't added or material failed.

- [ ] **Step 3: Commit**

```bash
git add js/Petals.js
git commit -m "Build Points field with random initial petal positions"
```

---

## Task 4: Petal motion + respawn

**Files:**
- Modify: `js/Petals.js`

- [ ] **Step 1: Implement update()**

Replace the `update()` body:

```javascript
	update( dt, cameraPosition ) {

		this._time += dt;
		const camX = cameraPosition.x;
		const camZ = cameraPosition.z;
		const pos = this.positions;

		for ( let i = 0; i < PETAL_COUNT; i ++ ) {

			const o = i * 3;

			pos[ o + 1 ] -= dt * PETAL_FALL_SPEED;
			pos[ o + 0 ] += Math.sin( this._time + this.phases[ i ] ) * dt * PETAL_SWAY_AMPLITUDE;

			const dx = pos[ o + 0 ] - camX;
			const dz = pos[ o + 2 ] - camZ;

			if ( pos[ o + 1 ] < PETAL_BOTTOM_Y ||
				dx > PETAL_FIELD_RADIUS || dx < - PETAL_FIELD_RADIUS ||
				dz > PETAL_FIELD_RADIUS || dz < - PETAL_FIELD_RADIUS ) {

				pos[ o + 0 ] = camX + ( Math.random() - 0.5 ) * 2 * PETAL_FIELD_RADIUS;
				pos[ o + 1 ] = PETAL_TOP_Y + Math.random() * 5;
				pos[ o + 2 ] = camZ + ( Math.random() - 0.5 ) * 2 * PETAL_FIELD_RADIUS;

			}

		}

		this.posAttr.needsUpdate = true;

	}
```

- [ ] **Step 2: Wire into main.js**

In `js/main.js`, find inside `init()` where `const sky = new Sky( scene );` is. Add immediately after:

```javascript
const petals = new Petals( scene );
```

In the render loop, after `sky.update( dt, cam.camera.position );` add:

```javascript
		petals.update( dt, cam.camera.position );
```

- [ ] **Step 3: Verify in browser**

Reload. Expected: pink petals visibly drift down across the scene with subtle sideways motion. Drive in any direction — petals follow the camera and stay in view.

If petals fall but never respawn: check that `dt` is positive and `cameraPosition` is the live camera object. Console-log `petals.positions[0]` over time to check Y descends.

If petals look like flat squares instead of soft petals: texture failed to load or material map missing. Confirm `makePetalTexture` returns a CanvasTexture.

- [ ] **Step 4: Commit**

```bash
git add js/Petals.js js/main.js
git commit -m "Animate petals with fall + sway, respawn out of field"
```

---

## Task 5: dispose() for completeness

**Files:**
- Modify: `js/Petals.js`

- [ ] **Step 1: Implement dispose**

Replace the empty `dispose()`:

```javascript
	dispose() {

		if ( this.points ) {

			this.scene.remove( this.points );
			this.points.geometry.dispose();
			this.points.material.map.dispose();
			this.points.material.dispose();
			this.points = null;

		}

	}
```

- [ ] **Step 2: Commit**

```bash
git add js/Petals.js
git commit -m "Implement Petals.dispose() for clean teardown"
```

---

## Task 6: Acceptance pass

**Files:** None.

- [ ] **Step 1: Walk acceptance criteria**

From [the spec](../specs/2026-05-19-sakura-petals-design.md#acceptance-criteria):

1. ☐ On load, pink petals visible drifting down.
2. ☐ ~200 petals at once.
3. ☐ Slow descent + subtle sideways sway.
4. ☐ Drive far → petals follow camera, never visibly run out.
5. ☐ Petals hitting ground respawn at top.
6. ☐ Pink reads against road, grass, sky, trees.
7. ☐ FPS still 60.
8. ☐ Drift, lap timer, ghost, atmosphere, blossoms, bollards, drift score unchanged.

- [ ] **Step 2: Tune**

Tunables at top of `js/Petals.js`:
- Too sparse → bump `PETAL_COUNT` 200→400.
- Too dense → drop 200→100.
- Falling too fast → drop `PETAL_FALL_SPEED` 1.5→0.7.
- Sway too jittery → drop `PETAL_SWAY_AMPLITUDE` 0.3→0.15.
- Too small → bump `PETAL_SIZE` 0.4→0.6.
- Edge despawn visible → bump `PETAL_FIELD_RADIUS` 30→50.

One commit per tune:

```bash
git add js/Petals.js
git commit -m "Tune PETAL_COUNT 200 → 400"
```

- [ ] **Step 3: Stop**

When all 8 criteria pass, petals shipped.

---

## Out of scope

- Petals settling on ground / sticking
- Per-petal rotation
- Wind gusts / variable density
- Petals affected by car wake
- Day/night auto-off
- Multi-color variants
