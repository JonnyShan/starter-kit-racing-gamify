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

function bufferToBase64( float32 ) {

	const bytes = new Uint8Array( float32.buffer, float32.byteOffset, float32.byteLength );
	let bin = '';
	for ( let i = 0; i < bytes.length; i ++ ) bin += String.fromCharCode( bytes[ i ] );
	return btoa( bin );

}

function base64ToBuffer( str ) {

	const bin = atob( str );
	const bytes = new Uint8Array( bin.length );
	for ( let i = 0; i < bin.length; i ++ ) bytes[ i ] = bin.charCodeAt( i );
	return new Float32Array( bytes.buffer );

}

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

		this._load();

		this.lapTimer.onLapComplete = ( time, isBest ) => this._onLapComplete( time, isBest );

	}

	_onLapComplete( time, isBest ) {

		if ( isBest && time <= GHOST_MAX_SECONDS && this.recordCount > 0 ) {

			this.ghostBuffer = this.recordBuffer.slice(
				0,
				this.recordCount * GHOST_FLOATS_PER_SAMPLE,
			);
			this._save();

		}

		this.recordCount = 0;
		this._recordAccum = 0;

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

	_save() {

		if ( ! this.ghostBuffer ) return;
		try {
			localStorage.setItem( this.storageKey, bufferToBase64( this.ghostBuffer ) );
		} catch {}

	}

	_load() {

		try {
			const str = localStorage.getItem( this.storageKey );
			if ( ! str ) return;
			const buf = base64ToBuffer( str );
			if ( buf.length === 0 || buf.length % GHOST_FLOATS_PER_SAMPLE !== 0 ) return;
			this.ghostBuffer = buf;
		} catch {}

	}

	update( dt, vehicle, lapTime ) {

		if ( this.lapTimer.running && this.recordCount < GHOST_MAX_SAMPLES ) {

			this._recordAccum += dt;
			while ( this._recordAccum >= GHOST_SAMPLE_INTERVAL && this.recordCount < GHOST_MAX_SAMPLES ) {

				const o = this.recordCount * GHOST_FLOATS_PER_SAMPLE;
				const p = vehicle.container.position;
				const q = vehicle.container.quaternion;
				this.recordBuffer[ o     ] = p.x;
				this.recordBuffer[ o + 1 ] = p.y;
				this.recordBuffer[ o + 2 ] = p.z;
				this.recordBuffer[ o + 3 ] = q.x;
				this.recordBuffer[ o + 4 ] = q.y;
				this.recordBuffer[ o + 5 ] = q.z;
				this.recordBuffer[ o + 6 ] = q.w;
				this.recordCount += 1;
				this._recordAccum -= GHOST_SAMPLE_INTERVAL;

			}

		}

	}

	dispose() {
	}

}
