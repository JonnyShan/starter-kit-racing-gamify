import * as THREE from 'three';

const GHOST_SAMPLE_RATE = 30;
const GHOST_SAMPLE_INTERVAL = 1 / GHOST_SAMPLE_RATE;
const GHOST_FLOATS_PER_SAMPLE = 7;
const GHOST_MAX_SECONDS = 300;
const GHOST_MAX_SAMPLES = GHOST_SAMPLE_RATE * GHOST_MAX_SECONDS;
const GHOST_COLOR = 0x4a9eff;
const GHOST_OPACITY = 0.55;
const STORAGE_PREFIX = 'racing.ghost.';

const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _qr = new THREE.Quaternion();

export class Ghost {

	constructor( scene, trackId, vehicleModel, lapTimer ) {

		this.scene = scene;
		this.storageKey = STORAGE_PREFIX + ( trackId || 'default' );
		this.lapTimer = lapTimer;

		this.recordBuffer = new Float32Array( GHOST_MAX_SAMPLES * GHOST_FLOATS_PER_SAMPLE );
		this.recordCount = 0;
		this._recordAccum = 0;

		this.ghostBuffer = null;
		this.mesh = this._buildGhostMesh( vehicleModel );
		scene.add( this.mesh );

	}

	_buildGhostMesh( vehicleModel ) {

		const mesh = vehicleModel.clone( true );

		const material = new THREE.MeshBasicMaterial( {
			color: GHOST_COLOR,
			transparent: true,
			opacity: GHOST_OPACITY,
			depthWrite: false,
		} );

		mesh.traverse( ( child ) => {

			if ( child.isMesh ) {

				child.material = material;
				child.castShadow = false;
				child.receiveShadow = false;

			}

		} );

		mesh.visible = false;
		return mesh;

	}

	update( dt, vehicle, lapTime ) {
	}

	dispose() {
	}

}
