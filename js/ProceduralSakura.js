import * as THREE from 'three';

const TRUNK_HEIGHT = 1.2;
const TRUNK_RADIUS_TOP = 0.10;
const TRUNK_RADIUS_BOTTOM = 0.16;
const TRUNK_COLOR = 0x5e3a20;

const BLOSSOM_COLOR = 0xffc1d4;
const BLOSSOM_COLOR_HIGHLIGHT = 0xffd6e3;

const BLOSSOM_BLOBS = [
	{ x:  0.00, y: 1.45, z:  0.00, size: 0.90 },
	{ x:  0.55, y: 1.65, z:  0.20, size: 0.72 },
	{ x: -0.50, y: 1.55, z:  0.30, size: 0.78 },
	{ x:  0.30, y: 1.85, z: -0.40, size: 0.65 },
	{ x: -0.25, y: 1.95, z: -0.20, size: 0.62 },
	{ x:  0.05, y: 2.10, z:  0.40, size: 0.58 },
	{ x:  0.40, y: 1.30, z: -0.55, size: 0.50 },
	{ x: -0.55, y: 1.30, z: -0.30, size: 0.48 },
];

const HIGHLIGHT_BLOBS = [
	{ x:  0.10, y: 2.20, z:  0.10, size: 0.40 },
	{ x: -0.30, y: 2.05, z:  0.10, size: 0.38 },
	{ x:  0.35, y: 1.95, z: -0.10, size: 0.36 },
];

export function buildProceduralSakura() {

	const root = new THREE.Group();
	root.name = 'decoration-sakura';

	const trunkMat = new THREE.MeshLambertMaterial( { color: TRUNK_COLOR, flatShading: true } );
	const blossomMat = new THREE.MeshLambertMaterial( { color: BLOSSOM_COLOR, flatShading: true } );
	const highlightMat = new THREE.MeshLambertMaterial( { color: BLOSSOM_COLOR_HIGHLIGHT, flatShading: true } );

	const trunk = new THREE.Mesh(
		new THREE.CylinderGeometry( TRUNK_RADIUS_TOP, TRUNK_RADIUS_BOTTOM, TRUNK_HEIGHT, 8 ),
		trunkMat,
	);
	trunk.position.y = TRUNK_HEIGHT / 2;
	trunk.castShadow = true;
	trunk.receiveShadow = true;
	root.add( trunk );

	const blossomGeom = new THREE.IcosahedronGeometry( 1, 1 );

	for ( const b of BLOSSOM_BLOBS ) {

		const mesh = new THREE.Mesh( blossomGeom, blossomMat );
		mesh.position.set( b.x, b.y, b.z );
		mesh.scale.setScalar( b.size );
		mesh.castShadow = true;
		root.add( mesh );

	}

	for ( const b of HIGHLIGHT_BLOBS ) {

		const mesh = new THREE.Mesh( blossomGeom, highlightMat );
		mesh.position.set( b.x, b.y, b.z );
		mesh.scale.setScalar( b.size );
		mesh.castShadow = true;
		root.add( mesh );

	}

	return root;

}
