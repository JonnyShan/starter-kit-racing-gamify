# Arcade Drift Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace scalar drift heuristic with slip-angle physics + handbrake (Space) input. Arcade Initial-D feel.

**Architecture:** Add `lateralSpeed` to `Vehicle` alongside `linearSpeed`. Two grip values (front/rear) gate steering authority and lateral decay. Handbrake drops rear grip. Existing `driftIntensity` formula rewritten to use slip angle so skid audio / drift marks / smoke / DRIFT badge auto-upgrade without downstream changes.

**Tech Stack:** Vanilla ES modules, three.js 0.184.0, crashcat 0.0.3, no test runner. Pure-math verification via one-off Node sanity scripts; integration verification in browser per acceptance criteria from spec.

**Spec:** [docs/superpowers/specs/2026-05-19-arcade-drift-overhaul-design.md](../specs/2026-05-19-arcade-drift-overhaul-design.md)

---

## File Structure

**Modified:**
- `js/Vehicle.js` — add lateral physics, grip model, slip-angle driftIntensity, body lean, wheel spin-up
- `js/Controls.js` — add `handbrake` field, Space key + gamepad button 0
- `js/main.js` — no semantic change; verify `input` already passes through (controls.update() result is forwarded to vehicle.update())

**Created (verification only, deleted at end):**
- `tools/slip-sanity.mjs` — Node sanity script for slip-angle math; deleted after Task 8 passes

No new runtime files. All edits surgical, contained to existing modules.

---

## Task 1: Add tuning constants + state to Vehicle

**Files:**
- Modify: `js/Vehicle.js:18-20` (constants block) and `js/Vehicle.js:31-61` (constructor)

- [ ] **Step 1: Add tuning constants under existing `MAX_SPEED`**

In `js/Vehicle.js`, after the existing `export const MAX_SPEED = 1.5;` line, add:

```javascript
const REAR_GRIP_NORMAL = 5.0;
const REAR_GRIP_HANDBRAKE = 0.6;
const FRONT_GRIP_GRIP = 4.0;
const FRONT_GRIP_SLIDE = 1.5;
const CHUCK_IN_KICK = 0.8;
const YAW_COUPLING = 3.0;
const SLIP_THRESHOLD = 0.05;        // |linearSpeed| below this → treat slip as 0
const DRIFT_INTENSITY_SCALE = 2.5;  // 30° slide at MAX_SPEED → ~2.0 (matches DriftMarks INTENSITY_MAX)
```

- [ ] **Step 2: Add lateral state fields to constructor**

In `Vehicle` constructor, after `this.driftIntensity = 0;` add:

```javascript
		this.lateralSpeed = 0;
		this.handbrake = false;
		this.prevHandbrake = false;
```

- [ ] **Step 3: Sanity check by loading the page**

Run a local server (`python3 -m http.server 8000` from project root) and open `http://localhost:8000/`. Drive around. Expected: NO behaviour change yet — constants and fields added but unused. Game still works identically.

- [ ] **Step 4: Commit**

```bash
git add js/Vehicle.js
git commit -m "Add tuning constants and lateral state for drift overhaul"
```

---

## Task 2: Add handbrake input to Controls

**Files:**
- Modify: `js/Controls.js:3-22` (constructor), `js/Controls.js:108-161` (update)

- [ ] **Step 1: Add `handbrake` field to constructor**

In `Controls` constructor, after `this.z = 0;` add:

```javascript
		this.handbrake = false;
```

- [ ] **Step 2: Read Space key + gamepad button 0 in update()**

In `Controls.update()`, after the existing gamepad axis/trigger block (after the `break;` on line ~136) and before the touch block, add reading of buttons. The cleanest spot: at the top of `update()` initialize `let handbrake = false;` alongside `let x = 0, z = 0;`. Then:

Replace the start of `update()`:

```javascript
	update() {

		let x = 0, z = 0;
```

with:

```javascript
	update() {

		let x = 0, z = 0;
		let handbrake = false;

		// Keyboard handbrake
		if ( this.keys[ 'Space' ] ) handbrake = true;
```

Then inside the gamepad `for` loop (after the trigger reads, before `break;`):

```javascript
				if ( gp.buttons[ 0 ] && gp.buttons[ 0 ].pressed ) handbrake = true;
```

At the end of `update()`, before `return`:

```javascript
		this.handbrake = handbrake;
```

Update the return:

```javascript
		return { x, z, handbrake, touchActive: this.touchActive };
```

- [ ] **Step 3: Prevent Space from scrolling the page**

In the constructor, replace:

```javascript
		window.addEventListener( 'keydown', ( e ) => this.keys[ e.code ] = true );
```

with:

```javascript
		window.addEventListener( 'keydown', ( e ) => {
			this.keys[ e.code ] = true;
			if ( e.code === 'Space' ) e.preventDefault();
		} );
```

- [ ] **Step 4: Verify in browser**

Reload page. Open devtools console. Add a one-shot debug: in browser console, after game loads, type:

```javascript
// Hook into the running controls for one frame
const _origUpdate = window.__controls?.update;
```

If `window.__controls` not exposed (likely), instead add a temporary `console.log` to `Controls.update()`:

```javascript
		if ( handbrake ) console.log( 'handbrake!' );
```

Hold Space → see "handbrake!" repeatedly. Release → stops. Remove the console.log after confirmed.

- [ ] **Step 5: Commit**

```bash
git add js/Controls.js
git commit -m "Add handbrake input (Space + gamepad button 0)"
```

---

## Task 3: Wire handbrake input through to Vehicle

**Files:**
- Modify: `js/Vehicle.js:155-158` (update method input handling)

- [ ] **Step 1: Read handbrake from controls input**

In `Vehicle.update( dt, controlsInput )`, after the existing:

```javascript
		this.inputX = controlsInput.x;
		this.inputZ = controlsInput.z;
```

add:

```javascript
		this.prevHandbrake = this.handbrake;
		this.handbrake = !! controlsInput.handbrake;
```

- [ ] **Step 2: Verify in browser**

Add a temporary inline log at the top of `Vehicle.update()`:

```javascript
		if ( this.handbrake && ! this.prevHandbrake ) console.log( 'handbrake DOWN' );
		if ( ! this.handbrake && this.prevHandbrake ) console.log( 'handbrake UP' );
```

Tap Space → see DOWN then UP. Release after long hold → see UP once. Remove logs.

- [ ] **Step 3: Verify main.js passes input through**

Open `js/main.js`. Find where vehicle.update is called. Confirm it passes the full controls return object (it already does — `vehicle.update( dt, input )`). NO edit needed in main.js. If structure differs, edit so `controls.update()` result reaches `vehicle.update()` unchanged.

- [ ] **Step 4: Commit**

```bash
git add js/Vehicle.js
git commit -m "Wire handbrake input through Vehicle.update"
```

---

## Task 4: Compute grips + apply frontGrip to steering authority

**Files:**
- Modify: `js/Vehicle.js:175-202` (keyboard/gamepad branch of update)

- [ ] **Step 1: Insert grip calculations and replace steering line**

In the keyboard/gamepad branch of `Vehicle.update()` (the `else` branch starting near line 174), find:

```javascript
			let direction = Math.sign( this.linearSpeed );
			if ( direction === 0 ) direction = Math.abs( this.inputZ ) > 0.1 ? Math.sign( this.inputZ ) : 1;

			const steeringGrip = THREE.MathUtils.clamp( Math.abs( this.linearSpeed ), 0.2, 1.0 );

			const targetAngular = - this.inputX * steeringGrip * 4 * direction;
```

Replace with:

```javascript
			let direction = Math.sign( this.linearSpeed );
			if ( direction === 0 ) direction = Math.abs( this.inputZ ) > 0.1 ? Math.sign( this.inputZ ) : 1;

			const steeringGrip = THREE.MathUtils.clamp( Math.abs( this.linearSpeed ), 0.2, 1.0 );

			const rearGrip = this.handbrake ? REAR_GRIP_HANDBRAKE : REAR_GRIP_NORMAL;
			const speedDenom = Math.abs( this.linearSpeed ) + 0.1;
			const slipMag = Math.min( Math.abs( this.lateralSpeed ) / speedDenom, 1 );
			const frontGrip = THREE.MathUtils.lerp( FRONT_GRIP_GRIP, FRONT_GRIP_SLIDE, slipMag );

			const targetAngular = - this.inputX * steeringGrip * frontGrip * direction;
```

Save `rearGrip` and `slipMag` for next tasks — leave them as local consts in this scope.

- [ ] **Step 2: Verify in browser**

Reload. Drive normally (no handbrake). Expected: steering feels essentially identical (lateralSpeed = 0 → slipMag = 0 → frontGrip = FRONT_GRIP_GRIP = 4.0, same as before). If steering feels wildly different, FRONT_GRIP_GRIP is mis-tuned — adjust constant before moving on.

- [ ] **Step 3: Commit**

```bash
git add js/Vehicle.js
git commit -m "Compute front/rear grip and use frontGrip for steering authority"
```

---

## Task 5: Chuck-in kick on handbrake rising edge

**Files:**
- Modify: `js/Vehicle.js` (same keyboard branch, after grip block from Task 4)

- [ ] **Step 1: Add chuck-in injection after grip block**

Immediately after the lines added in Task 4 (after the `const frontGrip = ...` line and before `const targetAngular = ...`), insert:

```javascript
			if ( this.handbrake && ! this.prevHandbrake && Math.abs( this.linearSpeed ) > 0.2 ) {

				this.lateralSpeed += this.inputX * this.linearSpeed * CHUCK_IN_KICK;

			}
```

(`inputX` is steering, so positive steer + forward speed → positive lateral = throws rear to the right, classic chuck-in.)

- [ ] **Step 2: Verify in browser**

Drive to ~50 km/h. Hold A or D + tap Space. Expected: car visibly snaps sideways briefly, then physics decay takes over (no decay yet → stays sideways forever). This is correct intermediate state; next task fixes decay.

If nothing happens: confirm `inputX` is non-zero (steering held) and `linearSpeed > 0.2` (moving). Log values if needed.

- [ ] **Step 3: Commit**

```bash
git add js/Vehicle.js
git commit -m "Add handbrake chuck-in kick to lateralSpeed"
```

---

## Task 6: Lateral decay + yaw coupling

**Files:**
- Modify: `js/Vehicle.js` (same branch, after chuck-in block)

- [ ] **Step 1: Add decay and yaw coupling**

After the chuck-in `if`-block from Task 5 and before `const targetAngular = ...`, insert:

```javascript
			// Lateral decay: rear grip pulls lateral velocity back to zero.
			this.lateralSpeed *= Math.max( 0, 1 - rearGrip * dt );

			// Yaw coupling: drag heading toward velocity direction. Strong when gripping,
			// weak when sliding (handbrake) → car stays drifted under handbrake.
			if ( Math.abs( this.linearSpeed ) > SLIP_THRESHOLD ) {

				const slipDir = Math.atan2( this.lateralSpeed, this.linearSpeed );
				const couplingRate = YAW_COUPLING * rearGrip * slipMag;
				this.container.rotateY( slipDir * couplingRate * dt );

			}
```

- [ ] **Step 2: Verify in browser — grip recovery**

Drive to 80 km/h, chuck-in with handbrake, release Space. Expected: lateral velocity bleeds off within ~1 second, car straightens. Acceptance criterion #3 from spec.

If recovery too slow → increase `REAR_GRIP_NORMAL`. If too snappy → decrease. Stay within 3.0–7.0 range.

- [ ] **Step 3: Verify in browser — sustained drift**

Drive to 80 km/h, hold Space + steering. Expected: car holds slide as long as Space + steering are held. Releasing Space → recovery.

- [ ] **Step 4: Commit**

```bash
git add js/Vehicle.js
git commit -m "Add lateral decay and yaw-velocity coupling"
```

---

## Task 7: Apply lateral push to rigid body

**Files:**
- Modify: `js/Vehicle.js:215-232` (rigid body drive section)

- [ ] **Step 1: Replace forward-only push with combined forward + lateral**

Find this block:

```javascript
			const angvel = this.rigidBody.motionProperties.angularVelocity;
			const drive = this.linearSpeed * 100 * dt;

			rigidBody.setAngularVelocity( this.physicsWorld, this.rigidBody, [
				angvel[ 0 ] + _right.x * drive,
				angvel[ 1 ],
				angvel[ 2 ] + _right.z * drive
			] );
```

Replace with:

```javascript
			const angvel = this.rigidBody.motionProperties.angularVelocity;
			const fwdDrive = this.linearSpeed * 100 * dt;
			const latDrive = this.lateralSpeed * 100 * dt;

			rigidBody.setAngularVelocity( this.physicsWorld, this.rigidBody, [
				angvel[ 0 ] + _right.x * fwdDrive - _forward.x * latDrive,
				angvel[ 1 ],
				angvel[ 2 ] + _right.z * fwdDrive - _forward.z * latDrive
			] );
```

Sign reasoning: rolling on a ball, `v_center = ω × r_up`. Forward push uses ω = +right (yields +forward). Lateral push uses ω = -forward to yield +right linear motion. Hence subtract `_forward * latDrive` from x/z components.

- [ ] **Step 2: Verify in browser — visible slide**

Drive + handbrake + steer. Expected: car now visually slides sideways across the ground (rigid body sphere actually moves laterally, not just heading rotates). Before this task the lateralSpeed scalar moved but sphere only rolled forward.

If car drifts the wrong way (e.g., handbrake-right rotates car right but sphere slides left), flip the sign on the lateral term: `+ _forward.x * latDrive`.

- [ ] **Step 3: Commit**

```bash
git add js/Vehicle.js
git commit -m "Apply lateral velocity to rigid body angular drive"
```

---

## Task 8: Rewrite driftIntensity from slip angle

**Files:**
- Modify: `js/Vehicle.js:284-285` (driftIntensity calculation)

- [ ] **Step 1: Optional — pure-math sanity script**

Create `tools/slip-sanity.mjs`:

```javascript
// Confirm driftIntensity scaling.
// Expected: 30° slide at MAX_SPEED → ~2.0 (matches DriftMarks INTENSITY_MAX).

const MAX_SPEED = 1.5;
const DRIFT_INTENSITY_SCALE = 2.5;

function intensity( linearSpeed, lateralSpeed ) {
    const speedAbs = Math.abs( linearSpeed );
    if ( speedAbs <= 0.05 ) return 0;
    const slip = Math.abs( Math.atan2( lateralSpeed, linearSpeed ) );
    return slip * speedAbs * DRIFT_INTENSITY_SCALE;
}

// 30° slide at MAX_SPEED:
const lat30 = MAX_SPEED * Math.tan( Math.PI / 6 );
console.log( '30° at MAX_SPEED:', intensity( MAX_SPEED, lat30 ).toFixed( 3 ), '(expect ~1.96)' );

// 10° at half speed:
const lat10 = ( MAX_SPEED / 2 ) * Math.tan( Math.PI / 18 );
console.log( '10° at MAX/2:', intensity( MAX_SPEED / 2, lat10 ).toFixed( 3 ), '(expect ~0.33)' );

// Standing still: no intensity even with lateral.
console.log( 'stopped:', intensity( 0.01, 1.0 ).toFixed( 3 ), '(expect 0)' );
```

Run: `node tools/slip-sanity.mjs`

Expected output:
```
30° at MAX_SPEED: 1.963 (expect ~1.96)
10° at MAX/2: 0.327 (expect ~0.33)
stopped: 0.000 (expect 0)
```

If numbers diverge, `DRIFT_INTENSITY_SCALE` is wrong — fix before continuing.

- [ ] **Step 2: Replace driftIntensity formula**

In `Vehicle.update()` near line 284, find:

```javascript
		this.driftIntensity = Math.abs( this.linearSpeed - this.acceleration ) +
			( this.bodyNode ? Math.abs( this.bodyNode.rotation.z ) * 2 : 0 );
```

Replace with:

```javascript
		const speedAbs = Math.abs( this.linearSpeed );
		const slipAngleAbs = speedAbs > SLIP_THRESHOLD
			? Math.abs( Math.atan2( this.lateralSpeed, this.linearSpeed ) )
			: 0;
		this.driftIntensity = slipAngleAbs * speedAbs * DRIFT_INTENSITY_SCALE;
```

- [ ] **Step 3: Verify in browser**

Drive normally → DRIFT badge stays off, no smoke, no marks. Acceptance criterion #1.

Handbrake-steer → DRIFT badge lights, smoke kicks in, marks paint behind rear wheels, skid audio loop ramps up. Acceptance criteria #2, #4.

If smoke / marks too aggressive on normal driving → SCALE too high or SLIP_THRESHOLD too low. Tune.

- [ ] **Step 4: Delete sanity script**

```bash
rm tools/slip-sanity.mjs
```

- [ ] **Step 5: Commit**

```bash
git add js/Vehicle.js
git commit -m "Rewrite driftIntensity from slip angle"
```

---

## Task 9: Body lean from lateral velocity

**Files:**
- Modify: `js/Vehicle.js:310-314` (updateBody Z rotation)

- [ ] **Step 1: Augment body roll target**

In `updateBody( dt )` find:

```javascript
		this.bodyNode.rotation.z = lerpAngle(
			this.bodyNode.rotation.z,
			-( this.inputX / 5 ) * this.linearSpeed,
			dt * 5
		);
```

Replace with:

```javascript
		this.bodyNode.rotation.z = lerpAngle(
			this.bodyNode.rotation.z,
			-( this.inputX / 5 ) * this.linearSpeed - this.lateralSpeed * 0.3,
			dt * 5
		);
```

- [ ] **Step 2: Verify in browser**

Drift around a corner. Expected: car visibly leans outward during slide (body tilts opposite to slide direction). Subtle but present.

If lean too extreme → reduce `0.3` to `0.15`. If invisible → bump to `0.5`.

- [ ] **Step 3: Commit**

```bash
git add js/Vehicle.js
git commit -m "Lean body away from lateral velocity during drift"
```

---

## Task 10: Rear wheel spin-up under handbrake

**Files:**
- Modify: `js/Vehicle.js:320-340` (updateWheels)

- [ ] **Step 1: Add extra spin to rear wheels when handbrake held**

In `updateWheels( dt )`, replace:

```javascript
		for ( const wheel of this.wheels ) {

			wheel.rotation.x += this.acceleration;

		}
```

with:

```javascript
		const rearExtra = this.handbrake ? 0.6 : 0;

		for ( const wheel of this.wheels ) {

			wheel.rotation.x += this.acceleration;

		}

		if ( this.wheelBL ) this.wheelBL.rotation.x += rearExtra;
		if ( this.wheelBR ) this.wheelBR.rotation.x += rearExtra;
```

- [ ] **Step 2: Verify in browser**

Hold Space while stationary or rolling. Expected: rear wheels visibly spin faster than fronts. Watch from chase camera — should look like a burnout.

- [ ] **Step 3: Commit**

```bash
git add js/Vehicle.js
git commit -m "Spin rear wheels faster while handbrake held"
```

---

## Task 11: Reset lateralSpeed on respawn

**Files:**
- Modify: `js/Vehicle.js:248-266` (respawn block)

- [ ] **Step 1: Zero lateralSpeed in fall-off-world reset**

Find the block starting `if ( this.spherePos.y < - 10 ) {` near line 248. Inside, find:

```javascript
			this.linearSpeed = 0;
			this.angularSpeed = 0;
			this.acceleration = 0;
```

Replace with:

```javascript
			this.linearSpeed = 0;
			this.angularSpeed = 0;
			this.acceleration = 0;
			this.lateralSpeed = 0;
			this.handbrake = false;
			this.prevHandbrake = false;
```

- [ ] **Step 2: Verify in browser**

Drive off the map. Reset. Expected: car respawns at start, no residual sliding behaviour.

- [ ] **Step 3: Commit**

```bash
git add js/Vehicle.js
git commit -m "Reset lateralSpeed and handbrake state on respawn"
```

---

## Task 12: Full acceptance pass + R key reset

**Files:**
- None (verification only). Possibly `js/main.js` if R-reset key exists and needs lateralSpeed.

- [ ] **Step 1: Locate R-key reset path if present**

Run:

```bash
grep -n "KeyR\|reset" js/main.js js/Vehicle.js
```

If a manual reset path exists separate from fall-off-world, ensure it also zeroes `lateralSpeed`, `handbrake`, `prevHandbrake`. The screenshot UI mentions "Reset Car: R" — verify it doesn't leave stale lateral velocity.

- [ ] **Step 2: Run acceptance criteria from spec**

From [the spec](../specs/2026-05-19-arcade-drift-overhaul-design.md#acceptance-criteria), verify each:

1. ☐ Normal cornering w/o Space feels essentially unchanged from before this PR.
2. ☐ W + Space + A at speed → car slides into corner, DRIFT badge appears, smoke + marks + skid audio fire.
3. ☐ Release Space mid-slide → grip recovery within ~1 second.
4. ☐ Skid audio loop volume tracks slide intensity audibly.
5. ☐ Touch controls (open on a mobile or in DevTools device mode) still work, no regression.
6. ☐ Lap timer still records best lap. Drift marks still persist to localStorage. Minimap still shows car.
7. ☐ FPS stays at 60 — open Stats overlay (visible top-left in screenshot) and confirm.

- [ ] **Step 3: Tuning pass**

If any feel issue (too slidey, too grippy, snaps too fast, chuck-in too violent), tune the constants block ONLY. Constants are: `REAR_GRIP_NORMAL`, `REAR_GRIP_HANDBRAKE`, `FRONT_GRIP_GRIP`, `FRONT_GRIP_SLIDE`, `CHUCK_IN_KICK`, `YAW_COUPLING`, `DRIFT_INTENSITY_SCALE`.

Do not touch logic during tuning. Commit each tuning iteration separately:

```bash
git add js/Vehicle.js
git commit -m "Tune REAR_GRIP_NORMAL 5.0 → 4.5"  # example
```

- [ ] **Step 4: Final commit if untracked changes remain**

```bash
git status
# if anything untracked from sanity scripts etc:
git clean -nd  # dry-run
# if safe:
git clean -fd
```

---

## Out of scope (logged for future plans)

- Ghost car replay
- Drift score UI / chain combo
- Touch handbrake button
- Countryside track / lighting pass
- AI rivals
