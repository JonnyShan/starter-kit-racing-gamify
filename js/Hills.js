import * as THREE from 'three';

const HILL_COUNT = 14;
const HILL_RING_RADIUS = 95;
const HILL_RING_VARIATION = 30;
const HILL_SIZE_MIN = 25;
const HILL_SIZE_MAX = 55;
const HILL_COLOR = 0x5e9a3c;
const HILL_BASE_Y = -6;
const HILL_GEOM_DETAIL = 12;

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
			color: HILL_COLOR,
			flatShading: true,
		} );

		const centerX = trackBounds.centerX;
		const centerZ = trackBounds.centerZ;

		for ( let i = 0; i < HILL_COUNT; i ++ ) {

			const angle = ( i / HILL_COUNT ) * Math.PI * 2 + hash01( i ) * 0.4;
			const radius = HILL_RING_RADIUS + ( hash01( i + 100 ) - 0.5 ) * 2 * HILL_RING_VARIATION;
			const size = HILL_SIZE_MIN + hash01( i + 200 ) * ( HILL_SIZE_MAX - HILL_SIZE_MIN );

			const mesh = new THREE.Mesh( this.geometry, this.material );
			mesh.position.set(
				centerX + Math.cos( angle ) * radius,
				HILL_BASE_Y + size * 0.55,
				centerZ + Math.sin( angle ) * radius,
			);

			const xz = 0.8 + hash01( i + 300 ) * 0.5;
			const yScale = 0.5 + hash01( i + 400 ) * 0.4;
			mesh.scale.set( size * xz, size * yScale, size * xz );

			mesh.castShadow = false;
			mesh.receiveShadow = false;
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
