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
