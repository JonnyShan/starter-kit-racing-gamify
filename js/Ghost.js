import * as THREE from 'three';

const GHOST_SAMPLE_RATE = 30;
const GHOST_SAMPLE_INTERVAL = 1 / GHOST_SAMPLE_RATE;
const GHOST_FLOATS_PER_SAMPLE = 7;
const GHOST_MAX_SECONDS = 300;
const GHOST_MAX_SAMPLES = GHOST_SAMPLE_RATE * GHOST_MAX_SECONDS;
const GHOST_OPACITY = 0.55;
const GHOST_TINTS = [ 0x4a9eff ]; // single blue ghost
const MAX_SLOTS = GHOST_TINTS.length;
const STORAGE_PREFIX = 'racing.ghosts.';
const LEGACY_PREFIX = 'racing.ghost.';
const LEGACY_BEST_PREFIX = 'racing.bestLap.';

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
		this.trackIdRaw = trackId || 'default';
		this.storageKey = STORAGE_PREFIX + this.trackIdRaw;
		this.lapTimer = lapTimer;

		this.recordBuffer = new Float32Array( GHOST_MAX_SAMPLES * GHOST_FLOATS_PER_SAMPLE );
		this.recordCount = 0;
		this._recordAccum = 0;

		this.slots = [];
		this.meshes = GHOST_TINTS.map( ( tint ) => this._buildGhostMesh( vehicleModel, tint ) );
		this.meshes.forEach( ( m ) => scene.add( m ) );

		this._load();

		this.lapTimer.onLapComplete = ( time, isBest ) => this._onLapComplete( time, isBest );

	}

	_buildGhostMesh( vehicleModel, tint ) {

		const mesh = vehicleModel.clone( true );

		const material = new THREE.MeshBasicMaterial( {
			color: tint,
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

		try {
			const payload = {
				slots: this.slots.map( ( s ) => ( {
					time: s.time,
					data: bufferToBase64( s.buffer ),
				} ) ),
			};
			localStorage.setItem( this.storageKey, JSON.stringify( payload ) );
		} catch {}

	}

	_load() {

		try {
			const raw = localStorage.getItem( this.storageKey );
			if ( raw ) {
				const payload = JSON.parse( raw );
				if ( payload && Array.isArray( payload.slots ) ) {
					this.slots = payload.slots
						.map( ( s ) => ( { time: Number( s.time ), buffer: base64ToBuffer( s.data ) } ) )
						.filter( ( s ) => Number.isFinite( s.time ) && s.buffer.length > 0 && s.buffer.length % GHOST_FLOATS_PER_SAMPLE === 0 )
						.sort( ( a, b ) => a.time - b.time )
						.slice( 0, MAX_SLOTS );
					return;
				}
			}
		} catch {}

		this._migrateLegacy();

	}

	_migrateLegacy() {

		try {
			const legacyKey = LEGACY_PREFIX + this.trackIdRaw;
			const legacyBestKey = LEGACY_BEST_PREFIX + this.trackIdRaw;
			const raw = localStorage.getItem( legacyKey );
			if ( ! raw ) return;
			const buf = base64ToBuffer( raw );
			if ( buf.length === 0 || buf.length % GHOST_FLOATS_PER_SAMPLE !== 0 ) return;
			const bestRaw = localStorage.getItem( legacyBestKey );
			const time = bestRaw !== null ? Number( bestRaw ) : 60;
			this.slots = [ { time: Number.isFinite( time ) ? time : 60, buffer: buf } ];
			this._save();
			localStorage.removeItem( legacyKey );
		} catch {}

	}

	_onLapComplete( time, isBest ) {

		if ( time > GHOST_MAX_SECONDS || this.recordCount === 0 ) {

			this.recordCount = 0;
			this._recordAccum = 0;
			return;

		}

		let insertAt = this.slots.length;
		for ( let i = 0; i < this.slots.length; i ++ ) {

			if ( time < this.slots[ i ].time ) {

				insertAt = i;
				break;

			}

		}

		if ( insertAt < MAX_SLOTS ) {

			const buffer = this.recordBuffer.slice( 0, this.recordCount * GHOST_FLOATS_PER_SAMPLE );
			this.slots.splice( insertAt, 0, { time, buffer } );
			if ( this.slots.length > MAX_SLOTS ) this.slots.length = MAX_SLOTS;
			this._save();

		}

		this.recordCount = 0;
		this._recordAccum = 0;

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

		for ( let i = 0; i < MAX_SLOTS; i ++ ) {

			const slot = this.slots[ i ];
			const mesh = this.meshes[ i ];

			if ( ! slot || ! this.lapTimer.running ) {

				mesh.visible = false;
				continue;

			}

			const buf = slot.buffer;
			const totalSamples = buf.length / GHOST_FLOATS_PER_SAMPLE;
			const idxFloat = lapTime * GHOST_SAMPLE_RATE;
			const i0 = Math.min( Math.floor( idxFloat ), totalSamples - 1 );
			const i1 = Math.min( i0 + 1, totalSamples - 1 );
			const t = i0 === i1 ? 0 : idxFloat - i0;

			const o0 = i0 * GHOST_FLOATS_PER_SAMPLE;
			const o1 = i1 * GHOST_FLOATS_PER_SAMPLE;

			mesh.position.set(
				buf[ o0     ] + ( buf[ o1     ] - buf[ o0     ] ) * t,
				buf[ o0 + 1 ] + ( buf[ o1 + 1 ] - buf[ o0 + 1 ] ) * t,
				buf[ o0 + 2 ] + ( buf[ o1 + 2 ] - buf[ o0 + 2 ] ) * t,
			);

			_qa.set( buf[ o0 + 3 ], buf[ o0 + 4 ], buf[ o0 + 5 ], buf[ o0 + 6 ] );
			_qb.set( buf[ o1 + 3 ], buf[ o1 + 4 ], buf[ o1 + 5 ], buf[ o1 + 6 ] );
			_qr.copy( _qa ).slerp( _qb, t );
			mesh.quaternion.copy( _qr );

			mesh.visible = true;

		}

	}

	dispose() {

		for ( const mesh of this.meshes ) {

			this.scene.remove( mesh );
			mesh.traverse( ( child ) => {

				if ( child.isMesh ) child.material.dispose();

			} );

		}
		this.meshes = [];

		if ( this.lapTimer ) this.lapTimer.onLapComplete = null;

	}

}
