import * as THREE from 'three';

const TRAIL_DISTANCE = 8.5;
const TRAIL_HEIGHT = 5.0;
const LOOK_AHEAD = 5.0;
const LOOK_HEIGHT = 1.5;
const POSITION_LERP = 20.0;
const LOOK_LERP = 30.0;
const SPEED_REF = 15;
const LOOK_SPEED_BONUS = 0;
const RESPAWN_SNAP_DISTANCE = 5.0;

const _forward = new THREE.Vector3();
const _desiredPos = new THREE.Vector3();
const _desiredLook = new THREE.Vector3();
const _prevPos = new THREE.Vector3();

export class Camera {

	constructor() {

		this.camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 0.1, 60 );
		this.smoothedLook = new THREE.Vector3();
		this.initialized = false;

		this._shakeMagnitude = 0;
		this._shakeRemaining = 0;
		this._shakeDuration = 0;

		window.addEventListener( 'resize', () => {

			this.camera.aspect = window.innerWidth / window.innerHeight;
			this.camera.updateProjectionMatrix();

		} );

	}

	update( dt, vehicle ) {

		const carPos = vehicle.container.position;

		_forward.set( 0, 0, 1 ).applyQuaternion( vehicle.container.quaternion );
		_forward.y = 0;
		const len = _forward.length();
		if ( len > 0.001 ) _forward.multiplyScalar( 1 / len );
		else _forward.set( 0, 0, 1 );

		const speed = vehicle.modelVelocity ? vehicle.modelVelocity.length() : 0;
		const speedFactor = Math.min( speed / SPEED_REF, 1 );

		// Camera tilts subtly with the road slope. Positive vehicle pitch
		// (nose down / descending) drops the look point; negative pitch
		// (climbing) lifts it. Damped by 0.6 so the move is gentle.
		const pitch = vehicle.roadPitch || 0;
		const lookPitchOffset = pitch * 0.6 * TRAIL_DISTANCE;

		_desiredPos.copy( carPos )
			.addScaledVector( _forward, - TRAIL_DISTANCE );
		_desiredPos.y += TRAIL_HEIGHT + pitch * 0.4 * TRAIL_DISTANCE;

		_desiredLook.copy( carPos )
			.addScaledVector( _forward, LOOK_AHEAD + speedFactor * LOOK_SPEED_BONUS );
		_desiredLook.y += LOOK_HEIGHT - lookPitchOffset;

		if ( ! this.initialized ) {

			this.camera.position.copy( _desiredPos );
			this.smoothedLook.copy( _desiredLook );
			this.initialized = true;

		} else {

			// Detect respawn-style teleport: car position jumped a lot; snap.
			if ( _prevPos.distanceTo( carPos ) > RESPAWN_SNAP_DISTANCE ) {

				this.camera.position.copy( _desiredPos );
				this.smoothedLook.copy( _desiredLook );

			} else {

				const posAlpha = 1 - Math.exp( - dt * POSITION_LERP );
				this.camera.position.lerp( _desiredPos, posAlpha );

				const lookAlpha = 1 - Math.exp( - dt * LOOK_LERP );
				this.smoothedLook.lerp( _desiredLook, lookAlpha );

			}

		}

		_prevPos.copy( carPos );

		this.camera.lookAt( this.smoothedLook );

		if ( this._shakeRemaining > 0 ) {

			const tNorm = this._shakeRemaining / this._shakeDuration;
			const amp = this._shakeMagnitude * tNorm * tNorm;
			this.camera.position.x += ( Math.random() - 0.5 ) * 2 * amp;
			this.camera.position.y += ( Math.random() - 0.5 ) * 2 * amp;
			this.camera.position.z += ( Math.random() - 0.5 ) * 2 * amp;
			this._shakeRemaining = Math.max( 0, this._shakeRemaining - dt );

		}

	}

	shake( magnitude, duration ) {

		this._shakeMagnitude = magnitude;
		this._shakeRemaining = duration;
		this._shakeDuration = duration;

	}

}
