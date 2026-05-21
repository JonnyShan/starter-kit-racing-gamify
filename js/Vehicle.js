import * as THREE from 'three';
import { rigidBody } from 'crashcat';
import { CELL_RAW, GRID_SCALE, buildElevationMap, computeCellTransform } from './Track.js';

const _logoTex = new THREE.TextureLoader().load( 'sprites/gamify-logo.png' );
_logoTex.colorSpace = THREE.SRGBColorSpace;
_logoTex.anisotropy = 8;
const LOGO_ASPECT = 332 / 257;

const _tmpVec = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _zAxis = new THREE.Vector3();
const _newZ = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _up = new THREE.Vector3( 0, 1, 0 );

const SPEED_SCALE = 12.5;
const LINEAR_DAMP = 0.1;
export const MAX_SPEED = 1.5;

const REAR_GRIP_NORMAL = 5.0;
const REAR_GRIP_HANDBRAKE = 0.6;
const FRONT_GRIP_GRIP = 4.0;
const FRONT_GRIP_SLIDE = 1.5;
const CHUCK_IN_KICK = 0.8;
const YAW_COUPLING = 3.0;
const SLIP_THRESHOLD = 0.05;
const DRIFT_INTENSITY_SCALE = 2.5;

function lerpAngle( a, b, t ) {

	let diff = b - a;
	while ( diff > Math.PI ) diff -= Math.PI * 2;
	while ( diff < -Math.PI ) diff += Math.PI * 2;
	return a + diff * t;

}

export class Vehicle {

	constructor() {

		this.linearSpeed = 0;
		this.angularSpeed = 0;
		this.acceleration = 0;

		this.spherePos = new THREE.Vector3( 3.5, 0.5, 5 );
		this.sphereVel = new THREE.Vector3();

		this.rigidBody = null;
		this.physicsWorld = null;

		this.modelVelocity = new THREE.Vector3();
		this.prevModelPos = new THREE.Vector3( 3.5, 0, 5 );

		this.container = new THREE.Group();
		this.bodyNode = null;
		this.wheels = [];
		this.wheelFL = null;
		this.wheelFR = null;
		this.wheelBL = null;
		this.wheelBR = null;

		this.inputX = 0;
		this.inputZ = 0;

		this.driftIntensity = 0;

		this.lateralSpeed = 0;
		this.handbrake = false;
		this.prevHandbrake = false;

		// Last on-track position — restored on respawn (ball falling below
		// Y=-10) so the player resumes near where they fell off, not at the
		// origin. Updated each frame while the ball is sitting on a road slab.
		this.lastSafePos = new THREE.Vector3( 3.5, 0.5, 5 );
		this.lastSafeYaw = 0;

		// Road-surface pitch tracking — applied to bodyNode so the visible
		// car tilts to match the slope it's sitting on.
		this.roadPitch = 0;
		this.prevRoadPitch = 0;
		this.cells = null;
		this.elevMap = null;

		// Drift boost — accumulate while drifting hard, release as a
		// short forward burst when the player exits the slide.
		this.driftChargeTime = 0;
		this.boostTimeLeft = 0;

	}

	// Called from main.js after cells are loaded so the vehicle can look up
	// the slope under its current position.
	setCells( cells ) {

		this.cells = cells;
		this.elevMap = buildElevationMap( cells );

	}

	init( model ) {

		const vehicleModel = model.clone();

		this.container.add( vehicleModel );

		// Find body and wheel nodes
		vehicleModel.traverse( ( child ) => {

			const name = child.name.toLowerCase();

			if ( name === 'body' ) {

				child.rotation.order = 'YXZ';
				this.bodyNode = child;

			} else if ( name.includes( 'wheel' ) ) {

				child.rotation.order = 'YXZ';
				this.wheels.push( child );

				if ( name.includes( 'front' ) && name.includes( 'left' ) ) this.wheelFL = child;
				if ( name.includes( 'front' ) && name.includes( 'right' ) ) this.wheelFR = child;
				if ( name.includes( 'back' ) && name.includes( 'left' ) ) this.wheelBL = child;
				if ( name.includes( 'back' ) && name.includes( 'right' ) ) this.wheelBR = child;

			}

			if ( child.isMesh ) {

				child.castShadow = true;
				child.receiveShadow = true;

			}

		} );

		if ( this.bodyNode ) {

			this.container.updateMatrixWorld( true );
			const bbox = new THREE.Box3().setFromObject( this.bodyNode );
			const invMat = new THREE.Matrix4().copy( this.bodyNode.matrixWorld ).invert();
			bbox.applyMatrix4( invMat );
			const size = bbox.getSize( new THREE.Vector3() );
			const center = bbox.getCenter( new THREE.Vector3() );

			const logoMat = new THREE.MeshBasicMaterial( {
				map: _logoTex,
				transparent: true,
				depthWrite: false,
				side: THREE.DoubleSide,
				polygonOffset: true,
				polygonOffsetFactor: - 1,
				polygonOffsetUnits: - 1,
			} );

			const basis = ( x, y, z ) => {
				const m = new THREE.Matrix4().makeBasis( x, y, z );
				return new THREE.Quaternion().setFromRotationMatrix( m );
			};

			// Door decals on left + right cab sides. Cab is forward portion of body.
			const doorH = size.y * 0.32;
			const doorW = doorH * LOGO_ASPECT;
			const doorZ = center.z + size.z * 0.22;
			const doorY = center.y - size.y * 0.12;
			const doorGeo = new THREE.PlaneGeometry( doorW, doorH );

			const leftDoor = new THREE.Mesh( doorGeo, logoMat );
			leftDoor.quaternion.copy( basis(
				new THREE.Vector3( 0, 0, 1 ),
				new THREE.Vector3( 0, 1, 0 ),
				new THREE.Vector3( - 1, 0, 0 ),
			) );
			leftDoor.position.set( bbox.min.x - 0.01, doorY, doorZ );
			this.bodyNode.add( leftDoor );

			const rightDoor = new THREE.Mesh( doorGeo, logoMat );
			rightDoor.quaternion.copy( basis(
				new THREE.Vector3( 0, 0, - 1 ),
				new THREE.Vector3( 0, 1, 0 ),
				new THREE.Vector3( 1, 0, 0 ),
			) );
			rightDoor.position.set( bbox.max.x + 0.01, doorY, doorZ );
			this.bodyNode.add( rightDoor );

		}

		return this.container;

	}

	update( dt, controlsInput ) {

		this.inputX = controlsInput.x;
		this.inputZ = controlsInput.z;
		this.prevHandbrake = this.handbrake;
		this.handbrake = !! controlsInput.handbrake;

		if ( controlsInput.touchActive && ( this.inputX !== 0 || this.inputZ !== 0 ) ) {

			// Touch: joystick defines world-space direction, auto-gas
			const targetAngle = Math.atan2( this.inputX, this.inputZ );
			_quat.setFromAxisAngle( _up, targetAngle );
			this.container.quaternion.slerp( _quat, 1 - Math.exp( - 3 * dt ) );

			_forward.set( 0, 0, 1 ).applyQuaternion( this.container.quaternion );
			const cross = _forward.x * this.inputZ - _forward.z * this.inputX;
			this.inputX = THREE.MathUtils.clamp( - cross * 2, - 1, 1 );

			this.linearSpeed = THREE.MathUtils.lerp( this.linearSpeed, MAX_SPEED, dt * 1.5 );

		} else {

			// Keyboard / gamepad: standard steering + throttle
			let direction = Math.sign( this.linearSpeed );
			if ( direction === 0 ) direction = Math.abs( this.inputZ ) > 0.1 ? Math.sign( this.inputZ ) : 1;

			const steeringGrip = THREE.MathUtils.clamp( Math.abs( this.linearSpeed ), 0.2, 1.0 );

			const rearGrip = this.handbrake ? REAR_GRIP_HANDBRAKE : REAR_GRIP_NORMAL;
			const speedDenom = Math.abs( this.linearSpeed ) + 0.1;
			const slipMag = Math.min( Math.abs( this.lateralSpeed ) / speedDenom, 1 );
			// Slope-aware grip: downhill (positive roadPitch = nose down) cuts
			// front grip up to 60% on the steepest descents, giving a looser
			// "fast descent" feel that rewards earlier braking.
			const slopeGripFactor = Math.max( 0.4, 1 - Math.max( 0, this.roadPitch ) * 1.2 );
			const frontGrip = THREE.MathUtils.lerp( FRONT_GRIP_GRIP, FRONT_GRIP_SLIDE, slipMag ) * slopeGripFactor;

			if ( this.handbrake && ! this.prevHandbrake && Math.abs( this.linearSpeed ) > 0.2 ) {

				this.lateralSpeed += this.inputX * this.linearSpeed * CHUCK_IN_KICK;

			}

			// Lateral decay: rear grip pulls lateral velocity back to zero.
			this.lateralSpeed *= Math.max( 0, 1 - rearGrip * dt );

			// Yaw coupling: drag heading toward velocity direction.
			if ( Math.abs( this.linearSpeed ) > SLIP_THRESHOLD ) {

				const slipDir = Math.atan2( this.lateralSpeed, this.linearSpeed );
				const couplingRate = YAW_COUPLING * rearGrip * slipMag;
				this.container.rotateY( slipDir * couplingRate * dt );

			}

			const targetAngular = - this.inputX * steeringGrip * frontGrip * direction;
			this.angularSpeed = THREE.MathUtils.lerp( this.angularSpeed, targetAngular, dt * 4 );

			this.container.rotateY( this.angularSpeed * dt );

			const targetSpeed = this.inputZ;

			if ( targetSpeed < 0 && this.linearSpeed > 0.01 ) {

				this.linearSpeed = THREE.MathUtils.lerp( this.linearSpeed, 0.0, dt * 8 );

			} else if ( targetSpeed < 0 ) {

				this.linearSpeed = THREE.MathUtils.lerp( this.linearSpeed, targetSpeed / 2, dt * 2 );

			} else {

				this.linearSpeed = THREE.MathUtils.lerp( this.linearSpeed, targetSpeed * MAX_SPEED, dt * 1.5 );

			}

		}

		_tmpVec.set( 0, 1, 0 ).applyQuaternion( this.container.quaternion );

		if ( _tmpVec.y > 0.5 ) {

			const targetQuat = this.alignWithY( this.container.quaternion, _up );
			this.container.quaternion.slerp( targetQuat, 0.2 );

		}

		this.linearSpeed *= Math.max( 0, 1 - LINEAR_DAMP * dt );

		if ( this.rigidBody ) {

			_forward.set( 0, 0, 1 ).applyQuaternion( this.container.quaternion );
			_forward.y = 0;
			_forward.normalize();

			_right.set( 1, 0, 0 ).applyQuaternion( this.container.quaternion );
			_right.y = 0;
			_right.normalize();

			const angvel = this.rigidBody.motionProperties.angularVelocity;
			const fwdDrive = this.linearSpeed * 100 * dt;
			const latDrive = this.lateralSpeed * 100 * dt;

			rigidBody.setAngularVelocity( this.physicsWorld, this.rigidBody, [
				angvel[ 0 ] + _right.x * fwdDrive - _forward.x * latDrive,
				angvel[ 1 ],
				angvel[ 2 ] + _right.z * fwdDrive - _forward.z * latDrive
			] );

			const pos = this.rigidBody.position;
			this.spherePos.set( pos[ 0 ], pos[ 1 ], pos[ 2 ] );

			const vel = this.rigidBody.motionProperties.linearVelocity;
			this.sphereVel.set( vel[ 0 ], vel[ 1 ], vel[ 2 ] );

		}

		// Drift-boost charge: build while handbraking with real sideways
		// slip. Release into a forward burst when the player exits.
		const driftHard = this.handbrake && Math.abs( this.lateralSpeed ) > 0.15;
		if ( driftHard ) {

			this.driftChargeTime += dt;

		} else if ( this.prevHandbrake && this.driftChargeTime > 0.8 ) {

			this.boostTimeLeft = 1.4;
			this.driftChargeTime = 0;

		} else if ( ! this.handbrake ) {

			this.driftChargeTime = Math.max( 0, this.driftChargeTime - dt * 0.5 );

		}

		if ( this.boostTimeLeft > 0 ) {

			this.boostTimeLeft -= dt;
			// Push linearSpeed past MAX_SPEED briefly — natural damping
			// pulls it back once the boost timer expires.
			const target = MAX_SPEED * 1.3;
			if ( this.linearSpeed < target ) {

				this.linearSpeed = THREE.MathUtils.lerp( this.linearSpeed, target, dt * 4 );

			}

		}

		this.acceleration = THREE.MathUtils.lerp(
			this.acceleration,
			this.linearSpeed + ( 0.25 * this.linearSpeed * Math.abs( this.linearSpeed ) ),
			dt
		);

		// Record last on-track position so respawn snaps back to it instead
		// of origin. Heuristic: ball sits on a road slab when Y is above the
		// off-track ground plane (~ -0.1). Lift slightly when restoring.
		if ( this.spherePos.y > 0 ) {

			this.lastSafePos.copy( this.spherePos );
			this.lastSafeYaw = this.container.rotation.y;

		}

		if ( this.spherePos.y < - 10 ) {

			const sx = this.lastSafePos.x;
			const sy = this.lastSafePos.y + 1.0;
			const sz = this.lastSafePos.z;

			if ( this.rigidBody ) {

				rigidBody.setPosition( this.physicsWorld, this.rigidBody, [ sx, sy, sz ], false );
				rigidBody.setLinearVelocity( this.physicsWorld, this.rigidBody, [ 0, 0, 0 ] );
				rigidBody.setAngularVelocity( this.physicsWorld, this.rigidBody, [ 0, 0, 0 ] );

			}

			this.spherePos.set( sx, sy, sz );
			this.sphereVel.set( 0, 0, 0 );
			this.linearSpeed = 0;
			this.angularSpeed = 0;
			this.acceleration = 0;
			this.lateralSpeed = 0;
			this.handbrake = false;
			this.prevHandbrake = false;
			this.container.rotation.set( 0, this.lastSafeYaw, 0 );
			this.container.quaternion.setFromAxisAngle( _up, this.lastSafeYaw );

		}

		this.container.position.set(
			this.spherePos.x,
			this.spherePos.y - 0.5,
			this.spherePos.z
		);

		if ( dt > 0 ) {

			this.modelVelocity.subVectors( this.container.position, this.prevModelPos ).divideScalar( dt );
			this.prevModelPos.copy( this.container.position );

		}

		this.updateRoadPitch( dt );
		this.updateBody( dt );
		this.updateWheels( dt );

		const speedAbs = Math.abs( this.linearSpeed );
		const slipAngleAbs = speedAbs > SLIP_THRESHOLD
			? Math.abs( Math.atan2( this.lateralSpeed, this.linearSpeed ) )
			: 0;
		this.driftIntensity = slipAngleAbs * speedAbs * DRIFT_INTENSITY_SCALE;

	}

	alignWithY( quaternion, newY ) {

		_zAxis.set( 0, 0, 1 ).applyQuaternion( quaternion );
		const xAxis = _tmpVec.crossVectors( _zAxis, newY ).negate().normalize();
		_newZ.crossVectors( xAxis, newY ).normalize();

		_mat4.makeBasis( xAxis, newY, _newZ );
		return _quat.setFromRotationMatrix( _mat4 );

	}

	updateRoadPitch( dt ) {

		// Look up the cell the vehicle is currently over and lerp the
		// stored road-pitch toward that cell's slope. Off-track => 0.
		if ( ! this.elevMap || ! this.cells ) return;

		const cellW = CELL_RAW * GRID_SCALE;
		const gx = Math.floor( this.spherePos.x / cellW );
		const gz = Math.floor( this.spherePos.z / cellW );

		let target = 0;
		const list = this.elevMap.get( gx + ',' + gz );
		if ( list ) {

			// Pick cell at this (gx, gz) closest in Y to the ball — handles
			// bridge cells overlapping the same grid coord.
			const ballY = this.spherePos.y;
			let bestCell = null;
			let bestDist = Infinity;
			for ( const c of this.cells ) {

				if ( c[ 0 ] !== gx || c[ 1 ] !== gz ) continue;
				const cellY = c[ 4 ] ?? 0;
				const d = Math.abs( ballY - cellY );
				if ( d < bestDist ) { bestDist = d; bestCell = c; }

			}
			if ( bestCell ) target = computeCellTransform( bestCell, this.elevMap ).pitch;

		}

		// Crest detection: if we were climbing last frame (prev pitch
		// strongly negative = nose up) and we're now flat or descending,
		// pop the ball upward so the car catches air over the hill crest.
		const wasClimbing = this.prevRoadPitch < - 0.06;
		const flatOrDownNow = target > - 0.02;
		if ( wasClimbing && flatOrDownNow && this.linearSpeed > 0.6 && this.rigidBody ) {

			const v = this.rigidBody.motionProperties.linearVelocity;
			const popVy = Math.max( v[ 1 ], 3.5 + this.linearSpeed * 2.0 );
			rigidBody.setLinearVelocity( this.physicsWorld, this.rigidBody, [ v[ 0 ], popVy, v[ 2 ] ] );

		}

		this.prevRoadPitch = this.roadPitch;
		this.roadPitch = THREE.MathUtils.lerp( this.roadPitch, target, dt * 6 );

	}

	updateBody( dt ) {

		if ( ! this.bodyNode ) return;

		// Combine acceleration-driven pitch lean with the road slope.
		const accelPitch = - ( this.linearSpeed - this.acceleration ) / 6;
		this.bodyNode.rotation.x = lerpAngle(
			this.bodyNode.rotation.x,
			accelPitch + this.roadPitch,
			dt * 10
		);

		this.bodyNode.rotation.z = lerpAngle(
			this.bodyNode.rotation.z,
			-( this.inputX / 5 ) * this.linearSpeed - this.lateralSpeed * 0.3,
			dt * 5
		);

		this.bodyNode.position.y = THREE.MathUtils.lerp( this.bodyNode.position.y, 0.3, dt * 5 );

	}

	updateWheels( dt ) {

		const rearExtra = this.handbrake ? 0.6 : 0;

		for ( const wheel of this.wheels ) {

			wheel.rotation.x += this.acceleration;

		}

		if ( this.wheelBL ) this.wheelBL.rotation.x += rearExtra;
		if ( this.wheelBR ) this.wheelBR.rotation.x += rearExtra;

		if ( this.wheelFL ) {

			this.wheelFL.rotation.y = lerpAngle( this.wheelFL.rotation.y, -this.inputX / 1.5, dt * 10 );

		}

		if ( this.wheelFR ) {

			this.wheelFR.rotation.y = lerpAngle( this.wheelFR.rotation.y, -this.inputX / 1.5, dt * 10 );

		}

	}

}
