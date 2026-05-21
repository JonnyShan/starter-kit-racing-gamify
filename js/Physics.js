import * as THREE from 'three';
import { rigidBody, box, sphere, MotionType, MotionQuality } from 'crashcat';
import {
	TRACK_CELLS, CELL_RAW, GRID_SCALE,
	buildElevationMap, computeCellTransform, makeCellQuaternion,
} from './Track.js';

const _wallQ = new THREE.Quaternion();

const _debugMat = new THREE.MeshBasicMaterial( { color: 0x00ff00, wireframe: true } );

function addDebugBox( group, halfExtents, position, quaternion ) {

	const geo = new THREE.BoxGeometry( halfExtents[ 0 ] * 2, halfExtents[ 1 ] * 2, halfExtents[ 2 ] * 2 );
	const mesh = new THREE.Mesh( geo, _debugMat );
	mesh.position.set( position[ 0 ], position[ 1 ], position[ 2 ] );
	if ( quaternion ) mesh.quaternion.set( quaternion[ 0 ], quaternion[ 1 ], quaternion[ 2 ], quaternion[ 3 ] );
	group.add( mesh );

}

export function buildWallColliders( world, debugGroup, customCells ) {

	const S = GRID_SCALE;
	const CELL_HALF = CELL_RAW / 2;

	// Road collider — thin slab covering the cell, tilted to match the
	// piece. Sits just above the visual road surface so the vehicle sphere
	// rests on it instead of the off-track ground box. No side walls —
	// track is intentionally barrier-free, ball can fall off the edge.
	const SLAB_HALF_THICK_LOCAL = 0.05;
	const SLAB_TOP_LIFT_LOCAL = 0.03;
	const slabHalfThick = SLAB_HALF_THICK_LOCAL * S;
	const slabHalfLen = CELL_HALF * S;

	const cells = customCells || TRACK_CELLS;
	const elevMap = buildElevationMap( cells );

	for ( const cell of cells ) {

		const key = cell[ 2 ];
		if ( key === 'track-bump' ) continue;

		const gx = cell[ 0 ];
		const gz = cell[ 1 ];
		const cx = ( gx + 0.5 ) * CELL_RAW * S;
		const cz = ( gz + 0.5 ) * CELL_RAW * S;

		const t = computeCellTransform( cell, elevMap );
		const pieceWorldY = - 0.5 + t.pieceLocalY * S;
		const slabCenterWorldY = pieceWorldY + ( SLAB_TOP_LIFT_LOCAL - SLAB_HALF_THICK_LOCAL ) * S;

		makeCellQuaternion( t.yawRad, t.pitch, _wallQ );
		const slabQuat = [ _wallQ.x, _wallQ.y, _wallQ.z, _wallQ.w ];

		const slabHalfExtents = [ slabHalfLen, slabHalfThick, slabHalfLen ];
		const slabPos = [ cx, slabCenterWorldY, cz ];
		rigidBody.create( world, {
			shape: box.create( { halfExtents: slabHalfExtents } ),
			motionType: MotionType.STATIC,
			objectLayer: world._OL_STATIC,
			position: slabPos,
			quaternion: slabQuat,
			friction: 5.0,
			restitution: 0.0,
		} );
		if ( debugGroup ) addDebugBox( debugGroup, slabHalfExtents, slabPos, slabQuat );

	}

}

export function createSphereBody( world, spawnPos ) {

	const body = rigidBody.create( world, {
		shape: sphere.create( { radius: 0.5 } ),
		motionType: MotionType.DYNAMIC,
		objectLayer: world._OL_MOVING,
		position: spawnPos || [ 3.5, 0.5, 5 ],
		mass: 1000.0,
		friction: 5.0,
		// Restitution 0 — prevents the ball from bouncing off slab edges
		// where adjacent road cells have small Y discontinuities, which
		// was making the car bob vertically while driving.
		restitution: 0.0,
		linearDamping: 0.1,
		angularDamping: 4.0,
		gravityFactor: 1.5,
		motionQuality: MotionQuality.LINEAR_CAST,
	} );

	return body;

}
