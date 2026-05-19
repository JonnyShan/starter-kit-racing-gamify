# Stars + Moon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Star field + moon billboard auto-fade in when hemiLight.intensity drops toward the NIGHT preset.

**Architecture:** New `js/Stars.js` builds Points field (random upper-hemisphere positions) + Sprite moon (procedural glow texture). Each frame, compute opacity from `hemiLight.intensity` and apply to both materials.

**Tech Stack:** three.js Points, Sprite, CanvasTexture.

**Spec:** [docs/superpowers/specs/2026-05-19-stars-and-moon-design.md](../specs/2026-05-19-stars-and-moon-design.md)

---

## File Structure

**Created:**
- `js/Stars.js` — star field + moon + auto-fade.

**Modified:**
- `js/main.js` — import, instantiate, drive update.

---

## Task 1: Skeleton + constants

**Files:**
- Create: `js/Stars.js`

- [ ] **Step 1: Write skeleton**

```javascript
import * as THREE from 'three';

const STAR_COUNT = 400;
const STAR_RADIUS = 480;
const STAR_MIN_Y_FRACTION = 0.15;
const STAR_SIZE = 1.2;
const MOON_HEIGHT = 200;
const MOON_OFFSET_X = -300;
const MOON_OFFSET_Z = -200;
const MOON_SIZE = 40;
const HEMI_DAY = 1.8;
const HEMI_NIGHT = 0.3;

export class Stars {

	constructor( scene, hemiLight ) {

		this.scene = scene;
		this.hemiLight = hemiLight;
		this.stars = null;
		this.moon = null;

	}

	update( dt ) {
	}

	dispose() {
	}

}
```

- [ ] **Step 2: Sanity import in main.js**

After `import { DayNight } from './DayNight.js';` add:

```javascript
import { Stars } from './Stars.js';
```

Reload. No error.

- [ ] **Step 3: Commit**

```bash
git add js/Stars.js js/main.js
git commit -m "Add Stars module skeleton with constants"
```

---

## Task 2: Build star field

**Files:**
- Modify: `js/Stars.js`

- [ ] **Step 1: Build field in constructor**

In the constructor body, after `this.hemiLight = hemiLight;`:

```javascript
		this.stars = this._buildStars();
		scene.add( this.stars );
```

Add method:

```javascript
	_buildStars() {

		const positions = new Float32Array( STAR_COUNT * 3 );
		for ( let i = 0; i < STAR_COUNT; i ++ ) {

			// Random unit vector with y >= STAR_MIN_Y_FRACTION; sphere of radius STAR_RADIUS.
			let x, y, z, len;
			do {
				x = Math.random() * 2 - 1;
				y = Math.random();
				z = Math.random() * 2 - 1;
				len = Math.sqrt( x * x + y * y + z * z );
			} while ( len < 0.001 || y / len < STAR_MIN_Y_FRACTION );

			positions[ i * 3 + 0 ] = ( x / len ) * STAR_RADIUS;
			positions[ i * 3 + 1 ] = ( y / len ) * STAR_RADIUS;
			positions[ i * 3 + 2 ] = ( z / len ) * STAR_RADIUS;

		}

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );

		const material = new THREE.PointsMaterial( {
			color: 0xffffff,
			size: STAR_SIZE,
			sizeAttenuation: false,
			transparent: true,
			opacity: 0,
			depthWrite: false,
			fog: false,
		} );

		const points = new THREE.Points( geometry, material );
		points.frustumCulled = false;
		points.renderOrder = - 5;
		return points;

	}
```

- [ ] **Step 2: Verify in browser**

Reload. Expected: no console error. Stars exist but opacity is 0 so invisible. To sanity-check, in DevTools temporarily set `localStorage.removeItem('whatever')` — no, just trust the structure. Toggle N to night → still invisible (no fade logic yet). Next task fixes.

- [ ] **Step 3: Commit**

```bash
git add js/Stars.js
git commit -m "Build invisible star Points field on upper hemisphere"
```

---

## Task 3: Build moon sprite

**Files:**
- Modify: `js/Stars.js`

- [ ] **Step 1: Add moon builder + texture generator**

Add module-level function before the class:

```javascript
function makeMoonTexture() {

	const size = 128;
	const canvas = document.createElement( 'canvas' );
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext( '2d' );

	const cx = size / 2;
	const cy = size / 2;
	const grad = ctx.createRadialGradient( cx, cy, 0, cx, cy, size / 2 );
	grad.addColorStop( 0, 'rgba(255,250,220,1)' );
	grad.addColorStop( 0.4, 'rgba(255,245,200,0.95)' );
	grad.addColorStop( 0.7, 'rgba(255,240,180,0.4)' );
	grad.addColorStop( 1, 'rgba(255,240,180,0)' );

	ctx.fillStyle = grad;
	ctx.fillRect( 0, 0, size, size );

	const tex = new THREE.CanvasTexture( canvas );
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 4;
	return tex;

}
```

In the class, add method:

```javascript
	_buildMoon() {

		const material = new THREE.SpriteMaterial( {
			map: makeMoonTexture(),
			transparent: true,
			opacity: 0,
			depthWrite: false,
			fog: false,
		} );

		const sprite = new THREE.Sprite( material );
		sprite.position.set( MOON_OFFSET_X, MOON_HEIGHT, MOON_OFFSET_Z );
		sprite.scale.set( MOON_SIZE, MOON_SIZE, 1 );
		sprite.renderOrder = - 4;
		return sprite;

	}
```

In the constructor, after the stars line:

```javascript
		this.moon = this._buildMoon();
		scene.add( this.moon );
```

- [ ] **Step 2: Verify in browser**

Reload. No console error. Moon also invisible (opacity 0). Next task fades both in.

- [ ] **Step 3: Commit**

```bash
git add js/Stars.js
git commit -m "Build invisible moon Sprite with soft glow texture"
```

---

## Task 4: Auto-fade by hemiLight intensity

**Files:**
- Modify: `js/Stars.js` (update)

- [ ] **Step 1: Implement update()**

Replace `update()`:

```javascript
	update( dt ) {

		const opacity = THREE.MathUtils.clamp(
			1 - ( this.hemiLight.intensity - HEMI_NIGHT ) / ( HEMI_DAY - HEMI_NIGHT ),
			0, 1
		);

		this.stars.material.opacity = opacity;
		this.moon.material.opacity = opacity;

	}
```

- [ ] **Step 2: Wire into main.js**

After `const dayNight = new DayNight( ... );`:

```javascript
const stars = new Stars( scene, hemiLight );
```

In render loop after `dayNight.update( dt );`:

```javascript
		stars.update( dt );
```

- [ ] **Step 3: Verify in browser**

Reload (day). Stars/moon invisible. Press N → night fades in; stars + moon fade in simultaneously. Moon visible up-left in sky. Press N back → fade out.

- [ ] **Step 4: Commit**

```bash
git add js/Stars.js js/main.js
git commit -m "Fade stars + moon by hemiLight intensity (visible at night)"
```

---

## Task 5: dispose

**Files:**
- Modify: `js/Stars.js`

- [ ] **Step 1: Implement**

```javascript
	dispose() {

		if ( this.stars ) {

			this.scene.remove( this.stars );
			this.stars.geometry.dispose();
			this.stars.material.dispose();
			this.stars = null;

		}

		if ( this.moon ) {

			this.scene.remove( this.moon );
			this.moon.material.map.dispose();
			this.moon.material.dispose();
			this.moon = null;

		}

	}
```

- [ ] **Step 2: Commit**

```bash
git add js/Stars.js
git commit -m "Implement Stars.dispose() for clean teardown"
```

---

## Task 6: Acceptance

1. ☐ Day mode: invisible.
2. ☐ N → stars + moon fade in over 1.5s with the rest of night atmosphere.
3. ☐ Moon visible upper-left of sky, soft glow.
4. ☐ Stars scattered across upper hemisphere.
5. ☐ Fog doesn't kill horizon stars.
6. ☐ N back to day → fade out.
7. ☐ FPS 60.
8. ☐ Everything else unchanged.

Tunables at top of `js/Stars.js`. Commit each tune separately.

---

## Out of scope

- Twinkle
- Constellations
- Moon shadow lighting
- Aurora / nebula
- Per-time-of-day moon color variants
