import * as THREE from 'three';

// Plain dark-grey road piece. No painted lines, no kerb, no side strips —
// just a flat slab that meets the surrounding grass directly. One square
// covers a full cell so straight + corner cells form a continuous-width
// road without abrupt narrowings or intersections.

const CELL_LENGTH = 9.99;
const ROAD_COLOR = 0x3c3c3c;
const ROAD_THICKNESS = 0.1;

const _geom = new THREE.BoxGeometry( CELL_LENGTH, ROAD_THICKNESS, CELL_LENGTH );
// Translate so the top face sits at local y = 0 — placePiece sets
// piece.position.y = pieceLocalY (top-of-road convention).
_geom.translate( 0, - ROAD_THICKNESS / 2, 0 );

const _mat = new THREE.MeshLambertMaterial( {
	color: ROAD_COLOR,
	flatShading: true,
} );

export function buildProceduralRoad() {

	const mesh = new THREE.Mesh( _geom, _mat );
	mesh.receiveShadow = true;
	return mesh;

}
