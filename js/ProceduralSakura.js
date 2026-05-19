import * as THREE from 'three';

const TRUNK_HEIGHT = 1.6;
const TRUNK_RADIUS_TOP = 0.14;
const TRUNK_RADIUS_BOTTOM = 0.22;
const TRUNK_COLOR = 0x5e3a20;

const BLOSSOM_COLOR = 0xffb9d0;
const BLOSSOM_COLOR_HIGHLIGHT = 0xffd2e0;

const BLOSSOM_BLOBS = [
	{ x:  0.00, y: 1.90, z:  0.00, size: 1.25 },
	{ x:  0.80, y: 2.15, z:  0.30, size: 1.00 },
	{ x: -0.75, y: 2.05, z:  0.45, size: 1.05 },
	{ x:  0.40, y: 2.45, z: -0.55, size: 0.90 },
	{ x: -0.35, y: 2.55, z: -0.30, size: 0.85 },
	{ x:  0.05, y: 2.80, z:  0.55, size: 0.75 },
	{ x:  0.55, y: 1.75, z: -0.75, size: 0.70 },
	{ x: -0.75, y: 1.75, z: -0.40, size: 0.68 },
];

const HIGHLIGHT_BLOBS = [
	{ x:  0.15, y: 3.00, z:  0.15, size: 0.55 },
	{ x: -0.40, y: 2.80, z:  0.15, size: 0.52 },
	{ x:  0.50, y: 2.65, z: -0.15, size: 0.50 },
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
