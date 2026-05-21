import * as THREE from 'three';

// Distant mountain ridge silhouettes. Big low-poly cones placed far from
// the track so they sit on the horizon above the near hills. Atmospheric
// hazy blue keeps them reading as background, not foreground.

const MOUNTAIN_COUNT = 22;
const RING_RADIUS_MIN = 140;
const RING_RADIUS_MAX = 220;
const SIZE_MIN = 22;
const SIZE_MAX = 55;
const COLOR_NEAR = 0x6c8aa8;
const COLOR_FAR  = 0x90a8c4;
const BASE_Y = -2.0;

function hash01( seed ) {

	let h = seed * 374761393;
	h = ( h ^ ( h >> 13 ) ) * 1274126177;
	return ( ( h ^ ( h >> 16 ) ) >>> 0 ) / 4294967295;

}

export class Mountains {

	constructor( scene, trackBounds ) {

		this.scene = scene;
		this.group = new THREE.Group();
		this.geometry = new THREE.ConeGeometry( 1, 1, 6, 1 );

		const cx = trackBounds.centerX;
		const cz = trackBounds.centerZ;

		for ( let i = 0; i < MOUNTAIN_COUNT; i ++ ) {

			const angle = ( i / MOUNTAIN_COUNT ) * Math.PI * 2 + hash01( i ) * 0.4;
			const r = RING_RADIUS_MIN + hash01( i + 50 ) * ( RING_RADIUS_MAX - RING_RADIUS_MIN );
			const x = cx + Math.cos( angle ) * r;
			const z = cz + Math.sin( angle ) * r;
			const size = SIZE_MIN + hash01( i + 200 ) * ( SIZE_MAX - SIZE_MIN );
			const farLerp = ( r - RING_RADIUS_MIN ) / ( RING_RADIUS_MAX - RING_RADIUS_MIN );

			const color = new THREE.Color( COLOR_NEAR ).lerp( new THREE.Color( COLOR_FAR ), farLerp );
			const mat = new THREE.MeshBasicMaterial( {
				color,
				fog: false,
			} );

			const mesh = new THREE.Mesh( this.geometry, mat );
			mesh.position.set( x, BASE_Y + size * 0.5, z );
			const xz = 0.8 + hash01( i + 300 ) * 0.5;
			mesh.scale.set( size * xz, size, size * xz );
			mesh.rotation.y = hash01( i + 400 ) * Math.PI * 2;
			this.group.add( mesh );

		}

		scene.add( this.group );

	}

	dispose() {

		if ( this.group ) {

			this.scene.remove( this.group );
			this.geometry.dispose();
			this.group.traverse( ( o ) => { if ( o.isMesh ) o.material.dispose(); } );
			this.group = null;

		}

	}

}
