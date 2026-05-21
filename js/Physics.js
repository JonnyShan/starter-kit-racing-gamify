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

	const WALL_HALF_THICK = 0.25;
	const WALL_X = 4.75;
	const WALL_HALF_H = 1.5;

	const hThick = WALL_HALF_THICK * S;
	const hHeight = WALL_HALF_H * S;
	const hLen = CELL_HALF * S;

	// Road collider — thin slab covering the cell, tilted to match the
	// piece. Sits just above the visual road surface so the vehicle sphere
	// rests on it instead of the off-track ground box.
	const SLAB_HALF_THICK_LOCAL = 0.05;
	const SLAB_TOP_LIFT_LOCAL = 0.03;
	const slabHalfThick = SLAB_HALF_THICK_LOCAL * S;
	const slabHalfLen = CELL_HALF * S;

	const ARC_SPAN = - Math.PI / 2;
	const ARC_CENTER_X = - CELL_HALF;
	const ARC_CENTER_Z = CELL_HALF;
	const OUTER_R = 2 * CELL_HALF - WALL_HALF_THICK;
	const OUTER_SEG = 8;
	const OUTER_SEG_HALF_LEN = ( OUTER_R * ( Math.PI / 2 ) / OUTER_SEG / 2 ) * S;
	const INNER_R = WALL_HALF_THICK;
	const INNER_SEG = 3;
	const INNER_SEG_HALF_LEN = ( INNER_R * ( Math.PI / 2 ) / INNER_SEG / 2 ) * S;

	function addArcWall( wcx, wcz, arcStart, radius, numSeg, segHalfLen, arcWallY ) {

		for ( let i = 0; i < numSeg; i ++ ) {

			const aMid = arcStart + ( ( i + 0.5 ) / numSeg ) * ARC_SPAN;
			const halfExtents = [ hThick, hHeight, segHalfLen ];
			const position = [
				wcx + radius * Math.cos( aMid ) * S,
				arcWallY,
				wcz + radius * Math.sin( aMid ) * S
			];
			const quaternion = [ 0, Math.sin( - aMid / 2 ), 0, Math.cos( - aMid / 2 ) ];

			rigidBody.create( world, {
				shape: box.create( { halfExtents } ),
				motionType: MotionType.STATIC,
				objectLayer: world._OL_STATIC,
				position,
				quaternion,
				friction: 0.0,
				restitution: 0.1,
			} );

			if ( debugGroup ) addDebugBox( debugGroup, halfExtents, position, quaternion );

		}

	}

	const cells = customCells || TRACK_CELLS;
	const elevMap = buildElevationMap( cells );

	for ( const cell of cells ) {

		const [ gx, gz, key, orient ] = cell;
		if ( key === 'track-bump' ) continue;

		const cx = ( gx + 0.5 ) * CELL_RAW * S;
		const cz = ( gz + 0.5 ) * CELL_RAW * S;

		const t = computeCellTransform( cell, elevMap );
		const rad = t.yawRad;
		const cr = Math.cos( rad ), sr = Math.sin( rad );

		// World Y of piece center for this cell (matches Track.js placement).
		const pieceWorldY = - 0.5 + t.pieceLocalY * S;
		const wallY = pieceWorldY + WALL_HALF_H * S;
		const slabCenterWorldY = pieceWorldY + ( SLAB_TOP_LIFT_LOCAL - SLAB_HALF_THICK_LOCAL ) * S;

		// Quaternion: yaw + pitch (pitch is zero for corners + bumps).
		makeCellQuaternion( rad, t.pitch, _wallQ );
		const wallQuat = [ _wallQ.x, _wallQ.y, _wallQ.z, _wallQ.w ];

		// Road slab — same quat as piece. Even corner slabs use this (pitch=0).
		const slabHalfExtents = [ slabHalfLen, slabHalfThick, slabHalfLen ];
		const slabPos = [ cx, slabCenterWorldY, cz ];
		rigidBody.create( world, {
			shape: box.create( { halfExtents: slabHalfExtents } ),
			motionType: MotionType.STATIC,
			objectLayer: world._OL_STATIC,
			position: slabPos,
			quaternion: wallQuat,
			friction: 5.0,
			restitution: 0.0,
		} );
		if ( debugGroup ) addDebugBox( debugGroup, slabHalfExtents, slabPos, wallQuat );

		if ( key === 'track-straight' || key === 'track-finish' ) {

			for ( const side of [ - 1, 1 ] ) {

				const lx = side * WALL_X;
				const wx = cx + ( lx * cr ) * S;
				const wz = cz + ( - lx * sr ) * S;
				const halfExtents = [ hThick, hHeight, hLen ];
				const position = [ wx, wallY, wz ];

				rigidBody.create( world, {
					shape: box.create( { halfExtents } ),
					motionType: MotionType.STATIC,
					objectLayer: world._OL_STATIC,
					position,
					quaternion: wallQuat,
					friction: 0.0,
					restitution: 0.1,
				} );

				if ( debugGroup ) addDebugBox( debugGroup, halfExtents, position, wallQuat );

			}

		} else if ( key === 'track-corner' ) {

			const wcx = cx + ( ARC_CENTER_X * cr + ARC_CENTER_Z * sr ) * S;
			const wcz = cz + ( - ARC_CENTER_X * sr + ARC_CENTER_Z * cr ) * S;
			const arcStart = - rad;

			// Arc walls share corner's lifted wallY (pitch=0 for corners).
			addArcWall( wcx, wcz, arcStart, OUTER_R, OUTER_SEG, OUTER_SEG_HALF_LEN, wallY );
			addArcWall( wcx, wcz, arcStart, INNER_R, INNER_SEG, INNER_SEG_HALF_LEN, wallY );

		}

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
		restitution: 0.1,
		linearDamping: 0.1,
		angularDamping: 4.0,
		gravityFactor: 1.5,
		motionQuality: MotionQuality.LINEAR_CAST,
	} );

	return body;

}
