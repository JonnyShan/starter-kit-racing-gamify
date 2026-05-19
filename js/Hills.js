import * as THREE from 'three';

const FAR_HILL_COUNT = 10;
const FAR_HILL_RING_RADIUS = 160;
const FAR_HILL_RING_VARIATION = 50;
const FAR_HILL_SIZE_MIN = 35;
const FAR_HILL_SIZE_MAX = 65;
const FAR_HILL_COLOR = 0x4f8a35;
const FAR_HILL_BASE_Y = -10;

const NEAR_HILL_COUNT = 24;
const NEAR_HILL_OFFSET = 28;
const NEAR_HILL_VARIATION = 10;
const NEAR_HILL_SIZE_MIN = 2;
const NEAR_HILL_SIZE_MAX = 5;
const NEAR_HILL_COLOR = 0x6fa84a;
const NEAR_HILL_BASE_Y = -1.5;

const HILL_GEOM_DETAIL = 2;

function hash01( seed ) {

	let h = seed * 374761393;
	h = ( h ^ ( h >> 13 ) ) * 1274126177;
	return ( ( h ^ ( h >> 16 ) ) >>> 0 ) / 4294967295;

}

export class Hills {

	constructor( scene, trackBounds ) {

		this.scene = scene;
		this.group = new THREE.Group();
		this.geometry = new THREE.IcosahedronGeometry( 1, HILL_GEOM_DETAIL );

		this.farMaterial = new THREE.MeshLambertMaterial( { color: FAR_HILL_COLOR, flatShading: true } );
		this.nearMaterial = new THREE.MeshLambertMaterial( { color: NEAR_HILL_COLOR, flatShading: true } );

		const cx = trackBounds.centerX;
		const cz = trackBounds.centerZ;
		const hw = trackBounds.halfWidth + NEAR_HILL_OFFSET;
		const hd = trackBounds.halfDepth + NEAR_HILL_OFFSET;

		// Near ring: elliptical, hugs the track on all sides.
		for ( let i = 0; i < NEAR_HILL_COUNT; i ++ ) {

			const angle = ( i / NEAR_HILL_COUNT ) * Math.PI * 2 + hash01( i ) * 0.3;
			const jitterR = ( hash01( i + 50 ) - 0.5 ) * 2 * NEAR_HILL_VARIATION;
			const x = cx + Math.cos( angle ) * ( hw + jitterR );
			const z = cz + Math.sin( angle ) * ( hd + jitterR );
			const size = NEAR_HILL_SIZE_MIN + hash01( i + 200 ) * ( NEAR_HILL_SIZE_MAX - NEAR_HILL_SIZE_MIN );

			const mesh = new THREE.Mesh( this.geometry, this.nearMaterial );
			mesh.position.set( x, NEAR_HILL_BASE_Y + size * 0.5, z );
			const xz = 0.8 + hash01( i + 300 ) * 0.5;
			const yScale = 0.55 + hash01( i + 400 ) * 0.4;
			mesh.scale.set( size * xz, size * yScale, size * xz );
			this.group.add( mesh );

		}

		// Far ring: large bumps in background, fog absorbs them.
		for ( let i = 0; i < FAR_HILL_COUNT; i ++ ) {

			const angle = ( i / FAR_HILL_COUNT ) * Math.PI * 2 + hash01( i + 1000 ) * 0.4;
			const radius = FAR_HILL_RING_RADIUS + ( hash01( i + 1100 ) - 0.5 ) * 2 * FAR_HILL_RING_VARIATION;
			const size = FAR_HILL_SIZE_MIN + hash01( i + 1200 ) * ( FAR_HILL_SIZE_MAX - FAR_HILL_SIZE_MIN );

			const mesh = new THREE.Mesh( this.geometry, this.farMaterial );
			mesh.position.set(
				cx + Math.cos( angle ) * radius,
				FAR_HILL_BASE_Y + size * 0.55,
				cz + Math.sin( angle ) * radius,
			);
			const xz = 0.8 + hash01( i + 1300 ) * 0.5;
			const yScale = 0.5 + hash01( i + 1400 ) * 0.4;
			mesh.scale.set( size * xz, size * yScale, size * xz );
			this.group.add( mesh );

		}

		scene.add( this.group );

	}

	dispose() {

		if ( this.group ) {

			this.scene.remove( this.group );
			this.geometry.dispose();
			this.farMaterial.dispose();
			this.nearMaterial.dispose();
			this.group = null;

		}

	}

}
