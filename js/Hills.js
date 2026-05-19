import * as THREE from 'three';

const NEAR_HILL_COUNT = 18;
const NEAR_HILL_OFFSET = 30;
const NEAR_HILL_VARIATION = 12;
const NEAR_HILL_SIZE_MIN = 3;
const NEAR_HILL_SIZE_MAX = 7;
const NEAR_HILL_COLOR = 0x82c958;
const NEAR_HILL_BASE_Y = -1.2;

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

		this.material = new THREE.MeshLambertMaterial( {
			color: NEAR_HILL_COLOR,
			flatShading: true,
		} );

		const cx = trackBounds.centerX;
		const cz = trackBounds.centerZ;
		const hw = trackBounds.halfWidth + NEAR_HILL_OFFSET;
		const hd = trackBounds.halfDepth + NEAR_HILL_OFFSET;

		// Single elliptical ring of low grass-coloured bumps hugging the track.
		// The previous larger far-ring was being lit by the warm directional
		// light and blooming into a peach band that hid the sky, so it's gone.
		for ( let i = 0; i < NEAR_HILL_COUNT; i ++ ) {

			const angle = ( i / NEAR_HILL_COUNT ) * Math.PI * 2 + hash01( i ) * 0.3;
			const jitterR = ( hash01( i + 50 ) - 0.5 ) * 2 * NEAR_HILL_VARIATION;
			const x = cx + Math.cos( angle ) * ( hw + jitterR );
			const z = cz + Math.sin( angle ) * ( hd + jitterR );
			const size = NEAR_HILL_SIZE_MIN + hash01( i + 200 ) * ( NEAR_HILL_SIZE_MAX - NEAR_HILL_SIZE_MIN );

			const mesh = new THREE.Mesh( this.geometry, this.material );
			mesh.position.set( x, NEAR_HILL_BASE_Y + size * 0.5, z );
			const xz = 0.9 + hash01( i + 300 ) * 0.6;
			const yScale = 0.5 + hash01( i + 400 ) * 0.4;
			mesh.scale.set( size * xz, size * yScale, size * xz );
			this.group.add( mesh );

		}

		scene.add( this.group );

	}

	dispose() {

		if ( this.group ) {

			this.scene.remove( this.group );
			this.geometry.dispose();
			this.material.dispose();
			this.group = null;

		}

	}

}
