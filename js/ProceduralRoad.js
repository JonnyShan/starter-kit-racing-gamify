import * as THREE from 'three';

// Plain dark-grey road pieces, no painted lines or kerbs. Two flavours:
//   - Straight: narrow rectangular strip aligned along the cell's +Z axis
//   - Corner:   quarter-arc strip generated from custom BufferGeometry,
//               oriented to connect the cell's W and S edges (orient 0
//               convention). Other orientations come from placePiece's
//               yaw rotation.
//
// Road width is ROAD_WIDTH on both pieces so adjacent cells join flush
// at the cell-edge midpoints.

const CELL_LENGTH = 9.99;
const HALF_CELL = CELL_LENGTH / 2;
const ROAD_WIDTH = 5.0;
const ROAD_THICKNESS = 0.1;
const ROAD_COLOR = 0x3c3c3c;

const _mat = new THREE.MeshLambertMaterial( {
	color: ROAD_COLOR,
	flatShading: true,
} );

// --- Straight ---
const _straightGeom = new THREE.BoxGeometry( ROAD_WIDTH, ROAD_THICKNESS, CELL_LENGTH );
_straightGeom.translate( 0, - ROAD_THICKNESS / 2, 0 );

export function buildProceduralStraight() {

	const mesh = new THREE.Mesh( _straightGeom, _mat );
	mesh.receiveShadow = true;
	return mesh;

}

// --- Corner (quarter arc) ---
// Connects W edge midpoint (-HALF_CELL, 0) to S edge midpoint (0, +HALF_CELL)
// via an arc bulging toward the cell's NE quadrant. Arc center sits at the
// cell's NW corner-of-cell (-HALF_CELL, -HALF_CELL).
//
// Wait — geometrically the only arc that goes from W mid to S mid with both
// points at the same radius is centered at the cell's diagonally opposite
// corner. The natural pick is SW corner-of-cell (-HALF_CELL, +HALF_CELL):
//   dist( (-H,+H), (-H, 0) ) = H
//   dist( (-H,+H), ( 0,+H) ) = H
// Arc radius = HALF_CELL; arc bows into the NE quadrant of the cell.
function _buildCornerGeom() {

	const segments = 12;
	const arcCx = - HALF_CELL;
	const arcCz = + HALF_CELL;
	const innerR = HALF_CELL - ROAD_WIDTH / 2;
	const outerR = HALF_CELL + ROAD_WIDTH / 2;

	// Angle convention: in cell-local (X right, Z south), parameterise around
	// the arc center. W edge midpoint = arc center + (0, -HALF_CELL) -> angle
	// atan2(-H, 0) = -PI/2. S edge midpoint = arc center + (+H, 0) -> angle 0.
	// We sweep from -PI/2 to 0 inclusive.
	const startAng = - Math.PI / 2;
	const endAng = 0;

	const positions = [];
	const indices = [];

	for ( let i = 0; i <= segments; i ++ ) {

		const t = i / segments;
		const a = startAng + ( endAng - startAng ) * t;
		const ca = Math.cos( a );
		const sa = Math.sin( a );

		const outerX = arcCx + outerR * ca;
		const outerZ = arcCz + outerR * sa;
		const innerX = arcCx + innerR * ca;
		const innerZ = arcCz + innerR * sa;

		// vertex layout per ring step: 4 verts (outerTop, outerBot, innerTop, innerBot)
		positions.push( outerX, 0, outerZ );                  // 0 outer top
		positions.push( outerX, - ROAD_THICKNESS, outerZ );   // 1 outer bot
		positions.push( innerX, 0, innerZ );                  // 2 inner top
		positions.push( innerX, - ROAD_THICKNESS, innerZ );   // 3 inner bot

	}

	for ( let i = 0; i < segments; i ++ ) {

		const base = i * 4;
		const next = ( i + 1 ) * 4;
		// Top face (visible road surface). Two triangles per step.
		indices.push( base + 0, base + 2, next + 0 );
		indices.push( next + 0, base + 2, next + 2 );
		// Bottom face (reversed winding) — helps avoid backface artifacts
		// when the camera dips below the road.
		indices.push( base + 1, next + 1, base + 3 );
		indices.push( next + 1, next + 3, base + 3 );

	}

	const geom = new THREE.BufferGeometry();
	geom.setAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );
	geom.setIndex( indices );
	geom.computeVertexNormals();
	return geom;

}

const _cornerGeom = _buildCornerGeom();

export function buildProceduralCorner() {

	const mesh = new THREE.Mesh( _cornerGeom, _mat );
	mesh.receiveShadow = true;
	return mesh;

}

// Back-compat fallback (used as a no-op for track-bump cells).
export function buildProceduralRoad() {

	return buildProceduralStraight();

}
