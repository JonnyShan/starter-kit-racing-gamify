# Day Atmosphere Flip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert grey night scene to bright sunny anime day scene — sky gradient, sprite clouds, vivid green ground plane, warm sun, blue atmospheric fog.

**Architecture:** New `js/Sky.js` module encapsulates skydome (BackSide icosahedron w/ gradient ShaderMaterial) and 8 drifting `THREE.Sprite` clouds (procedural canvas alpha texture). `main.js` swaps light/fog/bg colors, adds ground plane, instantiates Sky, drives `sky.update()` from render loop. No new GLB assets, no test framework (visual verification per spec acceptance criteria).

**Tech Stack:** three.js 0.184.0, vanilla ES modules. Static page, no bundler, no test runner.

**Spec:** [docs/superpowers/specs/2026-05-19-day-atmosphere-flip-design.md](../specs/2026-05-19-day-atmosphere-flip-design.md)

---

## File Structure

**Created:**
- `js/Sky.js` — Sky class: skydome geometry + gradient shader, cloud sprite field, drift update. Single responsibility: atmosphere rendering.

**Modified:**
- `js/main.js` — light colors/intensities (lines 22-49), scene.background + fog (lines 34-36), bloom strength (line 26), add ground plane inside `loadTrack` before probe bake, import + instantiate Sky, call `sky.update(dt, camera.position)` from render loop.

No other files touched. Vehicle / Controls / Track / Physics / Particles / DriftMarks / Audio / LapTimer / Loader untouched.

---

## Task 1: Create Sky module skeleton

**Files:**
- Create: `js/Sky.js`

- [ ] **Step 1: Write minimal Sky.js exporting empty class**

Create `js/Sky.js`:

```javascript
import * as THREE from 'three';

const SKY_TOP_COLOR = 0x4a7fc1;
const SKY_BOTTOM_COLOR = 0xc8e2ff;
const SKY_HORIZON_OFFSET = 0.3;
const SKY_RADIUS = 500;

const CLOUD_COUNT = 8;
const CLOUD_SIZE_MIN = 60;
const CLOUD_SIZE_MAX = 110;
const CLOUD_RING_RADIUS = 300;
const CLOUD_HEIGHT_MIN = 80;
const CLOUD_HEIGHT_MAX = 180;
const CLOUD_DRIFT_SPEED = 0.5;
const CLOUD_TINT = 0xfffaf0;

export class Sky {

	constructor( scene ) {

		this.scene = scene;
		this.skydome = null;
		this.cloudGroup = null;

	}

	update( dt, cameraPosition ) {
		// filled in later tasks
	}

	dispose() {
		// filled in later tasks
	}

}
```

- [ ] **Step 2: Sanity check by importing in main.js temporarily**

In `js/main.js`, after existing imports near line 15, add:

```javascript
import { Sky } from './Sky.js';
```

Reload browser. Expected: no console error, no visual change.

- [ ] **Step 3: Commit**

```bash
git add js/Sky.js js/main.js
git commit -m "Add empty Sky module skeleton"
```

---

## Task 2: Build skydome with gradient shader

**Files:**
- Modify: `js/Sky.js` (constructor)

- [ ] **Step 1: Add skydome construction in constructor**

In `js/Sky.js`, replace the constructor with:

```javascript
	constructor( scene ) {

		this.scene = scene;
		this.skydome = this._buildSkydome();
		this.cloudGroup = null;

		scene.add( this.skydome );

	}

	_buildSkydome() {

		const geometry = new THREE.IcosahedronGeometry( SKY_RADIUS, 4 );

		const material = new THREE.ShaderMaterial( {
			side: THREE.BackSide,
			depthWrite: false,
			fog: false,
			uniforms: {
				topColor: { value: new THREE.Color( SKY_TOP_COLOR ) },
				bottomColor: { value: new THREE.Color( SKY_BOTTOM_COLOR ) },
				offset: { value: SKY_HORIZON_OFFSET },
				radius: { value: SKY_RADIUS },
			},
			vertexShader: `
				varying vec3 vWorldPos;
				void main() {
					vec4 wp = modelMatrix * vec4( position, 1.0 );
					vWorldPos = wp.xyz;
					gl_Position = projectionMatrix * viewMatrix * wp;
				}
			`,
			fragmentShader: `
				uniform vec3 topColor;
				uniform vec3 bottomColor;
				uniform float offset;
				uniform float radius;
				varying vec3 vWorldPos;
				void main() {
					float t = clamp( vWorldPos.y / radius + offset, 0.0, 1.0 );
					t = smoothstep( 0.0, 1.0, t );
					gl_FragColor = vec4( mix( bottomColor, topColor, t ), 1.0 );
				}
			`,
		} );

		const mesh = new THREE.Mesh( geometry, material );
		mesh.frustumCulled = false;
		mesh.renderOrder = - 10;
		return mesh;

	}
```

- [ ] **Step 2: Instantiate in main.js temporarily**

In `js/main.js`, after `scene` is created but before `loadTrack` runs (around line 49 after hemiLight), add:

```javascript
const sky = new Sky( scene );
```

Reload browser. Expected: dome is visible but currently obscured by the grey `scene.background`. Should see gradient at horizon edges where bg color shows through fog. If you set `scene.background = null` temporarily in DevTools, you'll see the gradient sphere. Don't commit a background change yet.

- [ ] **Step 3: Commit**

```bash
git add js/Sky.js js/main.js
git commit -m "Add gradient skydome to Sky module"
```

---

## Task 3: Procedural cloud texture generator

**Files:**
- Modify: `js/Sky.js`

- [ ] **Step 1: Add cloud texture generation method**

In `js/Sky.js`, add a private method after `_buildSkydome` (still inside the class):

```javascript
	_makeCloudTexture() {

		const size = 256;
		const canvas = document.createElement( 'canvas' );
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext( '2d' );

		// Transparent background. Draw 14 soft radial gradients clustered roughly
		// in the middle, then a few smaller ones offset to break the silhouette.
		const blobs = 14;
		const cx = size * 0.5;
		const cy = size * 0.55;
		for ( let i = 0; i < blobs; i ++ ) {

			const ang = Math.random() * Math.PI * 2;
			const dist = Math.random() * size * 0.28;
			const x = cx + Math.cos( ang ) * dist;
			const y = cy + Math.sin( ang ) * dist * 0.5;
			const r = size * ( 0.18 + Math.random() * 0.18 );
			const grad = ctx.createRadialGradient( x, y, 0, x, y, r );
			grad.addColorStop( 0, 'rgba(255,255,255,0.85)' );
			grad.addColorStop( 0.5, 'rgba(255,255,255,0.45)' );
			grad.addColorStop( 1, 'rgba(255,255,255,0)' );
			ctx.fillStyle = grad;
			ctx.fillRect( 0, 0, size, size );

		}

		const tex = new THREE.CanvasTexture( canvas );
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.anisotropy = 4;
		return tex;

	}
```

- [ ] **Step 2: Quick visual confirm**

Don't wire it in yet. Just confirm no syntax error by reloading the page — no console errors. The method is defined but unused.

- [ ] **Step 3: Commit**

```bash
git add js/Sky.js
git commit -m "Add procedural cloud texture generator"
```

---

## Task 4: Build cloud field

**Files:**
- Modify: `js/Sky.js`

- [ ] **Step 1: Add cloud-field construction and wire into constructor**

In `js/Sky.js`, add this method below `_makeCloudTexture`:

```javascript
	_buildCloudField() {

		const texture = this._makeCloudTexture();
		const material = new THREE.SpriteMaterial( {
			map: texture,
			color: CLOUD_TINT,
			transparent: true,
			depthWrite: false,
			fog: false,
		} );

		const group = new THREE.Group();

		for ( let i = 0; i < CLOUD_COUNT; i ++ ) {

			const sprite = new THREE.Sprite( material );
			const angle = ( i / CLOUD_COUNT ) * Math.PI * 2 + Math.random() * 0.4;
			const radius = CLOUD_RING_RADIUS * ( 0.7 + Math.random() * 0.6 );
			sprite.position.set(
				Math.cos( angle ) * radius,
				CLOUD_HEIGHT_MIN + Math.random() * ( CLOUD_HEIGHT_MAX - CLOUD_HEIGHT_MIN ),
				Math.sin( angle ) * radius,
			);
			const size = CLOUD_SIZE_MIN + Math.random() * ( CLOUD_SIZE_MAX - CLOUD_SIZE_MIN );
			sprite.scale.set( size, size * 0.5, 1 );
			group.add( sprite );

		}

		return group;

	}
```

Then in the constructor, replace:

```javascript
		this.cloudGroup = null;

		scene.add( this.skydome );
```

with:

```javascript
		this.cloudGroup = this._buildCloudField();

		scene.add( this.skydome );
		scene.add( this.cloudGroup );
```

- [ ] **Step 2: Verify in browser**

Reload. Expected: faint cloud sprites visible in the sky area (look up while driving, or temporarily disable `scene.background` in DevTools to see). They'll be drowned by the grey bg until later tasks. To verify they exist, open DevTools console and type:

```javascript
// In console after game has loaded:
const cloudCount = document.querySelector('canvas') && true; // just confirm no error
```

A real check: look for them after Task 7 (background swap). For now, the absence of console errors is the gate.

- [ ] **Step 3: Commit**

```bash
git add js/Sky.js
git commit -m "Build cloud sprite field in Sky module"
```

---

## Task 5: Cloud drift + camera-relative follow

**Files:**
- Modify: `js/Sky.js`

- [ ] **Step 1: Implement update() with drift + camera follow**

In `js/Sky.js`, replace the empty `update` method:

```javascript
	update( dt, cameraPosition ) {

		if ( ! this.cloudGroup ) return;

		// Drift each cloud along world +x; wrap around the camera so they always
		// stay visible regardless of how far the player has driven.
		const wrapRange = CLOUD_RING_RADIUS * 2;
		const halfWrap = wrapRange / 2;
		const camX = cameraPosition.x;
		const camZ = cameraPosition.z;

		for ( const cloud of this.cloudGroup.children ) {

			cloud.position.x += dt * CLOUD_DRIFT_SPEED;

			// Keep within +/- halfWrap of camera in x/z.
			const dx = cloud.position.x - camX;
			if ( dx > halfWrap ) cloud.position.x -= wrapRange;
			else if ( dx < - halfWrap ) cloud.position.x += wrapRange;

			const dz = cloud.position.z - camZ;
			if ( dz > halfWrap ) cloud.position.z -= wrapRange;
			else if ( dz < - halfWrap ) cloud.position.z += wrapRange;

		}

	}
```

- [ ] **Step 2: Wire update() into main.js render loop**

In `js/main.js`, the three.js camera is exposed as `cam.camera` (where `cam = new Camera()` near line 223 and rendering uses `renderer.render( scene, cam.camera )`). Inside the per-frame function, after the existing update calls (vehicle / driftMarks / audio), add:

```javascript
		sky.update( dt, cam.camera.position );
```

- [ ] **Step 3: Verify in browser**

Reload. Won't see motion yet (grey background still hiding clouds). Confirm no console error. If error mentions `camera.position is undefined`, fix the accessor per Step 2 note.

- [ ] **Step 4: Commit**

```bash
git add js/Sky.js js/main.js
git commit -m "Drift clouds and keep them wrapped relative to camera"
```

---

## Task 6: dispose() for completeness

**Files:**
- Modify: `js/Sky.js`

- [ ] **Step 1: Implement dispose**

Replace empty `dispose` in `js/Sky.js`:

```javascript
	dispose() {

		if ( this.skydome ) {

			this.scene.remove( this.skydome );
			this.skydome.geometry.dispose();
			this.skydome.material.dispose();
			this.skydome = null;

		}

		if ( this.cloudGroup ) {

			this.scene.remove( this.cloudGroup );
			for ( const sprite of this.cloudGroup.children ) {

				sprite.material.map.dispose();
				sprite.material.dispose();

			}

			this.cloudGroup = null;

		}

	}
```

- [ ] **Step 2: Commit (no behaviour change)**

```bash
git add js/Sky.js
git commit -m "Implement Sky.dispose() for clean teardown"
```

---

## Task 7: Swap scene background + fog colors

**Files:**
- Modify: `js/main.js:34-36`

- [ ] **Step 1: Update background and fog**

In `js/main.js`, find:

```javascript
scene.background = new THREE.Color( 0xadb2ba );
scene.fog = new THREE.Fog( 0xadb2ba, 30, 55 );
```

Replace with:

```javascript
const FOG_COLOR = 0xc8e2ff;
scene.background = new THREE.Color( FOG_COLOR );
scene.fog = new THREE.Fog( FOG_COLOR, 30, 55 );
```

- [ ] **Step 2: Push fog far in loadTrack**

Find inside `loadTrack`:

```javascript
	scene.fog.near = groundSize * 0.4;
	scene.fog.far = groundSize * 0.8;
```

Replace with:

```javascript
	scene.fog.near = groundSize * 0.6;
	scene.fog.far = groundSize * 1.5;
```

- [ ] **Step 3: Verify in browser**

Reload. Expected: scene is now pale blue. Sky gradient becomes visible at horizon (deep blue band up top). Clouds visible drifting. Fog still wraps everything but in blue not grey. Track and car visible normally.

If clouds look like flat painted ovals: check that `Sprite` is being used (Task 4) — sprites auto-face camera.

- [ ] **Step 4: Commit**

```bash
git add js/main.js
git commit -m "Switch scene background + fog to pale blue atmosphere"
```

---

## Task 8: Warm sun + brighter ambient

**Files:**
- Modify: `js/main.js:38-49`

- [ ] **Step 1: Group lighting constants and replace lights**

In `js/main.js`, find:

```javascript
const dirLight = new THREE.DirectionalLight( 0xffffff, 3 );
dirLight.position.set( 11.4, 15, -5.3 );
dirLight.castShadow = true;
dirLight.shadow.mapSize.setScalar( 4096 );
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 60;
dirLight.shadow.radius = 4;
scene.add( dirLight );

const hemiLight = new THREE.HemisphereLight( 0xc8d8e8, 0x7a8a5a, 2 );
hemiLight.position.copy( dirLight.position )
scene.add( hemiLight );
```

Replace with:

```javascript
const SUN_COLOR = 0xfff2d6;
const SUN_INTENSITY = 4;
const SKY_AMBIENT = 0xa3d4ff;
const GROUND_AMBIENT = 0x6fa84a;
const AMBIENT_INTENSITY = 1.8;

const dirLight = new THREE.DirectionalLight( SUN_COLOR, SUN_INTENSITY );
dirLight.position.set( 11.4, 15, -5.3 );
dirLight.castShadow = true;
dirLight.shadow.mapSize.setScalar( 4096 );
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 60;
dirLight.shadow.radius = 4;
scene.add( dirLight );

const hemiLight = new THREE.HemisphereLight( SKY_AMBIENT, GROUND_AMBIENT, AMBIENT_INTENSITY );
hemiLight.position.copy( dirLight.position );
scene.add( hemiLight );
```

- [ ] **Step 2: Verify in browser**

Reload. Expected: scene visibly warmer — car body, road surface have warm sunlit cast. Shadows softer/bluer-tinged from ambient.

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "Warm sun color + saturated sky/ground hemisphere ambient"
```

---

## Task 9: Add vivid ground plane

**Files:**
- Modify: `js/main.js` (inside `loadTrack`, before probe bake)

- [ ] **Step 1: Locate insertion point**

Run:

```bash
grep -n "buildTrack\|probes.bake\|loadTrack\|groundSize" js/main.js
```

Identify the line where `buildTrack( scene, models, customCells );` is called (around line 157 per spec). Ground plane goes between groundSize computation and the `buildTrack` call.

- [ ] **Step 2: Insert ground plane**

In `js/main.js`, inside `loadTrack`, after the `scene.fog.near/far` assignment block from Task 7 and before `buildTrack( ... )`, add:

```javascript
	const GROUND_COLOR = 0x6fa84a;
	const groundGeo = new THREE.PlaneGeometry( groundSize * 4, groundSize * 4 );
	const groundMat = new THREE.MeshLambertMaterial( { color: GROUND_COLOR } );
	const ground = new THREE.Mesh( groundGeo, groundMat );
	ground.rotation.x = - Math.PI / 2;
	ground.position.set( bounds.centerX, - 0.15, bounds.centerZ );
	ground.receiveShadow = true;
	scene.add( ground );
```

This must be BEFORE `probes.bake( ... )` so indirect lighting picks up the green bounce.

- [ ] **Step 3: Verify in browser**

Reload. Expected: looking past the road edges you now see a flat vivid green field extending to fog horizon. No more void / grey edge.

If you see z-fighting flicker at road edges: the ground is too close to track surface. Drop ground to `-0.25`.

- [ ] **Step 4: Commit**

```bash
git add js/main.js
git commit -m "Add vivid green ground plane under track"
```

---

## Task 10: Instantiate Sky + drive update from render loop

**Files:**
- Modify: `js/main.js`

- [ ] **Step 1: Replace the temporary Sky instantiation from Task 2 with the real one + drive update**

If you added `const sky = new Sky( scene );` in Task 2 at module top-level, leave it. If you didn't (i.e. you skipped because lights weren't set up), add it now near the end of the lighting block (after hemiLight from Task 8):

```javascript
const sky = new Sky( scene );
```

Then locate the render/animate loop. The three.js camera is at `cam.camera` (used by `renderer.render( scene, cam.camera )`). Inside the per-frame function, after the existing update calls (vehicle / driftMarks / audio), add:

```javascript
	sky.update( dt, cam.camera.position );
```

- [ ] **Step 2: Verify in browser**

Reload. Expected: clouds visibly drift across the sky. Drive long distance in one direction — clouds wrap around and stay visible (no empty sky).

If clouds vanish when driving far: the wrap math is broken. Check Task 5 `_wrapRange` and `halfWrap` calculations.

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "Instantiate Sky and drive cloud drift from render loop"
```

---

## Task 11: Bump bloom + exposure

**Files:**
- Modify: `js/main.js:23,26`

- [ ] **Step 1: Tweak post-processing**

In `js/main.js`, find:

```javascript
renderer.toneMappingExposure = 1.0;
```

Replace with:

```javascript
renderer.toneMappingExposure = 1.05;
```

And find:

```javascript
bloomPass.strength = 0.02;
```

Replace with:

```javascript
bloomPass.strength = 0.05;
```

- [ ] **Step 2: Verify in browser**

Reload. Expected: scene marginally brighter overall; slight halo around bright surfaces (white car panels, sky band). Subtle.

If overblown / washed out: roll exposure back to 1.0 or bloom to 0.03.

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "Bump exposure and bloom for sunlit feel"
```

---

## Task 12: Full acceptance pass

**Files:** None.

- [ ] **Step 1: Walk acceptance criteria from spec**

From [spec acceptance section](../specs/2026-05-19-day-atmosphere-flip-design.md#acceptance-criteria), verify each:

1. ☐ Sky shows gradient: deep blue top, pale horizon. Visible looking upward.
2. ☐ 6-8 fluffy clouds visible, drift slowly. Persist when driving long distance.
3. ☐ Ground past track is vivid green, no void / grey edge.
4. ☐ Sunlight reads warm — car body + road have warm cast.
5. ☐ Distance fades pale blue (atmospheric), not grey fog wall.
6. ☐ FPS still 60 (Stats overlay top-left).
7. ☐ Drift, lap timer, drift marks, minimap, audio all unchanged.
8. ☐ No z-fighting / flicker between ground and track GLBs.

- [ ] **Step 2: Tuning iteration**

If anything reads wrong, tune the constants at top of `js/Sky.js` or the grouped block in `js/main.js`. Single source of truth — no hunting logic.

Common tunes:
- Sky too dark → bump `SKY_TOP_COLOR` toward `#6fa3e0`.
- Ground too lime → swap `GROUND_COLOR` to `#5e9a3c`.
- Clouds too few → bump `CLOUD_COUNT` to 12.
- Clouds drift too fast → drop `CLOUD_DRIFT_SPEED` to 0.2.
- Sun too warm → swap `SUN_COLOR` back toward `#fffafa`.

Each tune = separate commit:

```bash
git add js/Sky.js  # or js/main.js
git commit -m "Tune CLOUD_COUNT 8 → 12"
```

- [ ] **Step 3: Stop**

When all 8 criteria pass, day flip is shipped. Out-of-scope follow-ups (cherry blossoms, bollards, road lines) go into next spec.

---

## Out of scope (logged for future plans)

- Cherry blossom tree variant (recolor decoration-forest)
- Red/white corner bollards (procedural cylinder geometry)
- Yellow center + white side road lines
- Distance mountain silhouettes
- Grass blade instances
- Day/night cycle toggle
- Sun lens flare
