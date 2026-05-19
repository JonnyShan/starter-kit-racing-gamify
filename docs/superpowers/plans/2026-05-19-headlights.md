# Headlight Cones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two warm-white SpotLight cones attached to player car, illuminating the road at night, invisible by day.

**Architecture:** New `js/Headlights.js` parents 2 SpotLights + their targets to `vehicle.container`. `update(dt)` interpolates intensity from `hemiLight.intensity` so lights track the day/night state without explicit coupling.

**Spec:** [docs/superpowers/specs/2026-05-19-headlights-design.md](../specs/2026-05-19-headlights-design.md)

---

## File Structure

**Created:**
- `js/Headlights.js`

**Modified:**
- `js/main.js` — import, instantiate, drive update.

---

## Task 1: Build module + 2 SpotLights parented to vehicle

**Files:**
- Create: `js/Headlights.js`

- [ ] **Step 1: Write module**

```javascript
import * as THREE from 'three';

const HEADLIGHT_OFFSET_X = 0.4;
const HEADLIGHT_OFFSET_Y = 0.3;
const HEADLIGHT_OFFSET_Z = 0.4;
const HEADLIGHT_TARGET_Y = -1.0;
const HEADLIGHT_TARGET_Z = 8.0;
const HEADLIGHT_COLOR = 0xfffae0;
const HEADLIGHT_MAX_INTENSITY = 8;
const HEADLIGHT_DISTANCE = 25;
const HEADLIGHT_ANGLE = Math.PI / 8;
const HEADLIGHT_PENUMBRA = 0.3;
const HEADLIGHT_DECAY = 1;
const HEMI_DAY = 1.8;
const HEMI_NIGHT = 0.3;

export class Headlights {

	constructor( scene, vehicle, hemiLight ) {

		this.scene = scene;
		this.vehicle = vehicle;
		this.hemiLight = hemiLight;

		this.left = this._makeLight( - HEADLIGHT_OFFSET_X );
		this.right = this._makeLight( + HEADLIGHT_OFFSET_X );

	}

	_makeLight( signedX ) {

		const light = new THREE.SpotLight(
			HEADLIGHT_COLOR,
			0,
			HEADLIGHT_DISTANCE,
			HEADLIGHT_ANGLE,
			HEADLIGHT_PENUMBRA,
			HEADLIGHT_DECAY,
		);
		light.castShadow = false;
		light.position.set( signedX, HEADLIGHT_OFFSET_Y, HEADLIGHT_OFFSET_Z );

		const target = new THREE.Object3D();
		target.position.set( signedX, HEADLIGHT_TARGET_Y, HEADLIGHT_TARGET_Z );

		this.vehicle.container.add( light );
		this.vehicle.container.add( target );
		light.target = target;

		return light;

	}

	update( dt ) {

		const nightT = THREE.MathUtils.clamp(
			1 - ( this.hemiLight.intensity - HEMI_NIGHT ) / ( HEMI_DAY - HEMI_NIGHT ),
			0, 1
		);
		const intensity = nightT * HEADLIGHT_MAX_INTENSITY;
		this.left.intensity = intensity;
		this.right.intensity = intensity;

	}

	dispose() {

		if ( this.left ) {
			this.vehicle.container.remove( this.left );
			this.vehicle.container.remove( this.left.target );
			this.left = null;
		}
		if ( this.right ) {
			this.vehicle.container.remove( this.right );
			this.vehicle.container.remove( this.right.target );
			this.right = null;
		}

	}

}
```

- [ ] **Step 2: Wire into main.js**

After `import { Stars } from './Stars.js';`:

```javascript
import { Headlights } from './Headlights.js';
```

Find inside `init()` where vehicle is initialized — search for `vehicle.init( models[`. Immediately after that line (and after `scene.add( vehicleGroup );`), add:

```javascript
	const headlights = new Headlights( scene, vehicle, hemiLight );
```

In render loop, after `stars.update( dt );`:

```javascript
		headlights.update( dt );
```

- [ ] **Step 3: Verify in browser**

Reload. Day mode: no visible cones, intensity 0.

Press N → night fades in, headlight cones appear lighting the road forward of the car. Steer left/right → cones rotate with car.

Drive around → cones illuminate bollards, trees, ground. ~25m reach.

If no cones visible at night: check spotlight intensity in DevTools (`headlights.left.intensity`). Should be 8 at full night.

If cones aim wrong direction: tweak `HEADLIGHT_TARGET_Y` (more negative = aim down) or `HEADLIGHT_TARGET_Z` (forward distance).

If cones overlap weirdly: increase `HEADLIGHT_OFFSET_X` from 0.4 to 0.5 to spread further.

- [ ] **Step 4: Commit**

```bash
git add js/Headlights.js js/main.js
git commit -m "Add headlight cones, intensity fades with hemiLight"
```

---

## Task 2: Acceptance

1. ☐ Day: no cones.
2. ☐ Night: two cones lighting road in front of car.
3. ☐ Cones turn with car.
4. ☐ Illuminate bollards, trees, ground within ~25 m.
5. ☐ FPS 60.
6. ☐ No shadow artifacts (shadows disabled).
7. ☐ All other features unchanged.
8. ☐ N back to day → cones fade.

Tunables at top of Headlights.js.

---

## Out of scope

- Tail lights / brake glow
- Beam toggle key
- High beam mode
- Volumetric haze
- NPC headlights
- Per-car offset variation
