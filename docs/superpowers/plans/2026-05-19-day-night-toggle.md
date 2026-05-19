# Day / Night Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** N key crossfades scene between day (current) and night presets over 1.5 s. No persistence.

**Architecture:** New `js/DayNight.js` owns dayMode flag, transition progress, keydown listener, and per-frame lerp of background / fog / dirLight / hemiLight / exposure / sky uniforms. Receives all targets by reference from main.js.

**Tech Stack:** three.js Color.lerpColors, vanilla DOM keydown.

**Spec:** [docs/superpowers/specs/2026-05-19-day-night-toggle-design.md](../specs/2026-05-19-day-night-toggle-design.md)

---

## File Structure

**Created:**
- `js/DayNight.js` — preset constants, transition state, key handler, lerp loop.

**Modified:**
- `js/main.js` — import + instantiate w/ refs + drive update.

---

## Task 1: Module skeleton + presets + N key

**Files:**
- Create: `js/DayNight.js`

- [ ] **Step 1: Skeleton**

```javascript
import * as THREE from 'three';

const TRANSITION_SECONDS = 1.5;

const DAY = {
	bg: 0xc8e2ff,
	fog: 0xc8e2ff,
	dirColor: 0xfff2d6,
	dirIntensity: 4,
	hemiSky: 0xa3d4ff,
	hemiGround: 0x6fa84a,
	hemiIntensity: 1.8,
	exposure: 1.05,
	skyTop: 0x4a7fc1,
	skyBottom: 0xc8e2ff,
};

const NIGHT = {
	bg: 0x0d1426,
	fog: 0x0d1426,
	dirColor: 0x5c7eb8,
	dirIntensity: 0.5,
	hemiSky: 0x1a2540,
	hemiGround: 0x0a1518,
	hemiIntensity: 0.3,
	exposure: 0.85,
	skyTop: 0x0a1428,
	skyBottom: 0x1f2d4a,
};

export class DayNight {

	constructor( { scene, renderer, dirLight, hemiLight, sky } ) {

		this.scene = scene;
		this.renderer = renderer;
		this.dirLight = dirLight;
		this.hemiLight = hemiLight;
		this.sky = sky;

		this.dayMode = true;
		this.t = 1; // 1 = fully at target
		this.from = this._snapshotPreset( DAY );
		this.to = this._snapshotPreset( DAY );

		this._onKey = ( e ) => {
			if ( e.code === 'KeyN' ) this._toggle();
		};
		window.addEventListener( 'keydown', this._onKey );

	}

	_snapshotPreset( preset ) {

		return {
			bg: new THREE.Color( preset.bg ),
			fog: new THREE.Color( preset.fog ),
			dirColor: new THREE.Color( preset.dirColor ),
			dirIntensity: preset.dirIntensity,
			hemiSky: new THREE.Color( preset.hemiSky ),
			hemiGround: new THREE.Color( preset.hemiGround ),
			hemiIntensity: preset.hemiIntensity,
			exposure: preset.exposure,
			skyTop: new THREE.Color( preset.skyTop ),
			skyBottom: new THREE.Color( preset.skyBottom ),
		};

	}

	_toggle() {

		// Snapshot current live values as new `from`
		this.from = {
			bg: this.scene.background.clone(),
			fog: this.scene.fog.color.clone(),
			dirColor: this.dirLight.color.clone(),
			dirIntensity: this.dirLight.intensity,
			hemiSky: this.hemiLight.color.clone(),
			hemiGround: this.hemiLight.groundColor.clone(),
			hemiIntensity: this.hemiLight.intensity,
			exposure: this.renderer.toneMappingExposure,
			skyTop: this.sky.skydome.material.uniforms.topColor.value.clone(),
			skyBottom: this.sky.skydome.material.uniforms.bottomColor.value.clone(),
		};
		this.dayMode = ! this.dayMode;
		this.to = this._snapshotPreset( this.dayMode ? DAY : NIGHT );
		this.t = 0;

	}

	update( dt ) {
	}

	dispose() {

		window.removeEventListener( 'keydown', this._onKey );

	}

}
```

- [ ] **Step 2: Sanity import in main.js**

After `import { Petals } from './Petals.js';` add:

```javascript
import { DayNight } from './DayNight.js';
```

Reload. No console error.

- [ ] **Step 3: Commit**

```bash
git add js/DayNight.js js/main.js
git commit -m "Add DayNight module skeleton with presets and N key listener"
```

---

## Task 2: Lerp transition each frame

**Files:**
- Modify: `js/DayNight.js`

- [ ] **Step 1: Implement update()**

Replace `update()`:

```javascript
	update( dt ) {

		if ( this.t >= 1 ) return;

		this.t = Math.min( 1, this.t + dt / TRANSITION_SECONDS );
		const e = this.t;
		const f = this.from;
		const to = this.to;

		this.scene.background.lerpColors( f.bg, to.bg, e );
		this.scene.fog.color.lerpColors( f.fog, to.fog, e );

		this.dirLight.color.lerpColors( f.dirColor, to.dirColor, e );
		this.dirLight.intensity = f.dirIntensity + ( to.dirIntensity - f.dirIntensity ) * e;

		this.hemiLight.color.lerpColors( f.hemiSky, to.hemiSky, e );
		this.hemiLight.groundColor.lerpColors( f.hemiGround, to.hemiGround, e );
		this.hemiLight.intensity = f.hemiIntensity + ( to.hemiIntensity - f.hemiIntensity ) * e;

		this.renderer.toneMappingExposure = f.exposure + ( to.exposure - f.exposure ) * e;

		const skyTop = this.sky.skydome.material.uniforms.topColor.value;
		const skyBottom = this.sky.skydome.material.uniforms.bottomColor.value;
		skyTop.lerpColors( f.skyTop, to.skyTop, e );
		skyBottom.lerpColors( f.skyBottom, to.skyBottom, e );

	}
```

- [ ] **Step 2: Wire into main.js**

In `js/main.js`, find inside `init()` where `const petals = new Petals( scene );` is, or near the `sky` instantiation. Add after `const sky = new Sky( scene );` and `const petals = new Petals( scene );` (and after `dirLight` + `hemiLight` declared at module level — they are):

```javascript
const dayNight = new DayNight( { scene, renderer, dirLight, hemiLight, sky } );
```

In render loop, after `petals.update( dt, cam.camera.position );` add:

```javascript
		dayNight.update( dt );
```

- [ ] **Step 3: Verify in browser**

Reload. Press N. Expected: scene crossfades to night over 1.5 s — bg darkens to deep blue, sunlight dims, sky gradient swaps. Press N again → returns to day.

If nothing happens: verify keydown fires by adding `console.log('n')` in `_onKey`. If logs but no transition: `_toggle()` may not be wired; check Step 1.

If transition is jerky / pops: lerp targets may have been mutated mid-transition. The `_toggle` clones current values into `from`, so this should be safe even when interrupting.

- [ ] **Step 4: Commit**

```bash
git add js/DayNight.js js/main.js
git commit -m "Crossfade scene atmosphere on N key over 1.5s"
```

---

## Task 3: Acceptance

**Files:** None.

- [ ] **Step 1: Walk acceptance from spec**

1. ☐ Loads in day mode unchanged.
2. ☐ N → crossfades to night over 1.5 s (bg, fog, lights, sky gradient, exposure).
3. ☐ N again → crossfades back to day.
4. ☐ Rapid N presses don't break (mid-transition flip starts fresh from current state).
5. ☐ Petals + blossoms + bollards visible in both.
6. ☐ FPS 60.
7. ☐ Drift / lap timer / ghost / drift score unchanged.
8. ☐ Refresh → starts in day.

- [ ] **Step 2: Tune if needed**

Top of `js/DayNight.js`:
- Transition too slow → `TRANSITION_SECONDS` 1.5→0.8.
- Night too dark → bump `NIGHT.dirIntensity` 0.5→0.9 or `NIGHT.hemiIntensity` 0.3→0.6.
- Night sky too washed → drop `NIGHT.skyBottom` toward 0x152340.

- [ ] **Step 3: Stop**

When all 8 pass, shipped.

---

## Out of scope

- Persistence
- Auto-cycle
- Stars/moon
- Headlight cones
- Day/night decoration recolor
