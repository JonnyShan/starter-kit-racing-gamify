import * as THREE from 'three';

export const ORIENT_DEG = { 0: 0, 10: 180, 16: 90, 22: 270 };

export const CELL_RAW = 9.99;
export const GRID_SCALE = 0.75;

// Elevation system — see computeCellTransform() below.
// cellY (5th tuple element, optional, default 0) is an INTEGER step count.
// World-Y rise per step = STEP_HEIGHT (pre-GRID_SCALE). With STEP_HEIGHT=1.5
// and GRID_SCALE=0.75 -> 1.125 world units per step. Across one cell length
// (CELL_RAW=9.99) one step delta = ~8.5 deg grade — drivable.
export const STEP_HEIGHT = 1.5;

const _dummy = new THREE.Object3D();
const _axisY = new THREE.Vector3( 0, 1, 0 );
const _axisX = new THREE.Vector3( 1, 0, 0 );
const _yawQ = new THREE.Quaternion();
const _pitchQ = new THREE.Quaternion();

// Cell tuple format: [ gx, gz, type, orient, y? ]
//   gx, gz   : integer grid coords
//   type     : 'track-straight' | 'track-corner' | 'track-bump' | 'track-finish'
//   orient   : Godot-orient index (0/10/16/22)
//   y        : optional integer elevation step (default 0)
//              Same (gx,gz) may appear multiple times at different y (bridges).
// Test track:
//   - West column climbs Y 0->3 (uphill), holds plateau (bridge-like over
//     ground), descends 3->0 (downhill).
//   - Corners + east column stay flat at Y=0.
export const TRACK_CELLS = [
	// Top edge — flat
	[ -3, -6, 'track-corner',   16, 0 ], // NW
	[ -2, -6, 'track-straight', 22, 0 ],
	[ -1, -6, 'track-straight', 22, 0 ],
	[  0, -6, 'track-corner',    0, 0 ], // NE
	// West column — climb, plateau (bridge-like), descend
	[ -3, -5, 'track-straight',  0, 0 ],
	[ -3, -4, 'track-straight',  0, 1 ], // uphill
	[ -3, -3, 'track-straight',  0, 2 ], // uphill
	[ -3, -2, 'track-straight',  0, 3 ], // peak entry
	[ -3, -1, 'track-straight',  0, 3 ], // plateau
	[ -3,  0, 'track-straight',  0, 3 ], // plateau (bridge-like)
	[ -3,  1, 'track-straight',  0, 2 ], // downhill
	[ -3,  2, 'track-straight',  0, 1 ], // downhill
	[ -3,  3, 'track-straight',  0, 0 ],
	[ -3,  4, 'track-straight',  0, 0 ],
	// East column with two S-chicanes — flat
	[  0, -5, 'track-straight',  0, 0 ],
	[  0, -4, 'track-corner',   22, 0 ],
	[ -1, -4, 'track-corner',   16, 0 ],
	[ -1, -3, 'track-straight',  0, 0 ],
	[ -1, -2, 'track-corner',   10, 0 ],
	[  0, -2, 'track-corner',    0, 0 ],
	[  0, -1, 'track-straight',  0, 0 ],
	[  0,  0, 'track-finish',    0, 0 ],
	[  0,  1, 'track-straight',  0, 0 ],
	[  0,  2, 'track-corner',   22, 0 ],
	[ -1,  2, 'track-corner',   16, 0 ],
	[ -1,  3, 'track-straight',  0, 0 ],
	[ -1,  4, 'track-corner',   10, 0 ],
	[  0,  4, 'track-corner',    0, 0 ],
	// Bottom edge — flat
	[ -3,  5, 'track-corner',   10, 0 ], // SW
	[ -2,  5, 'track-straight', 16, 0 ],
	[ -1,  5, 'track-straight', 16, 0 ],
	[  0,  5, 'track-corner',   22, 0 ], // SE
];

// Build a map: key = "gx,gz" -> array of cell Y values (handles bridges).
export function buildElevationMap( cells ) {

	const map = new Map();
	for ( const cell of cells ) {

		const gx = cell[ 0 ];
		const gz = cell[ 1 ];
		const y = cell[ 4 ] ?? 0;
		const key = gx + ',' + gz;
		const list = map.get( key );
		if ( list ) list.push( y );
		else map.set( key, [ y ] );

	}
	return map;

}

function pickNeighborY( elevMap, gx, gz, currentY ) {

	const list = elevMap.get( gx + ',' + gz );
	if ( ! list || list.length === 0 ) return null;
	let best = list[ 0 ];
	for ( const y of list ) {

		if ( Math.abs( y - currentY ) < Math.abs( best - currentY ) ) best = y;

	}
	return best;

}

// Compute placement + rotation for one cell. Used by Track piece placement,
// wall colliders, road colliders, bollards.
//
// Returns:
//   pieceLocalY : Y in trackGroup-local space where piece center should sit.
//                 (piece.position.y = pieceLocalY)
//   yawRad      : yaw around world Y (orient mapping)
//   pitch       : signed rotation around local X (after yaw). Negative = nose up.
//   cellY       : raw integer Y of this cell
//   yFwd        : Y of forward neighbor (= cellY for corners / no-neighbor)
export function computeCellTransform( cell, elevMap ) {

	const [ gx, gz, key, orient ] = cell;
	const cellY = cell[ 4 ] ?? 0;
	const yawDeg = ORIENT_DEG[ orient ] ?? 0;
	const yawRad = yawDeg * Math.PI / 180;

	// Corners + bumps stay flat — ramps live on straights only.
	if ( key === 'track-corner' || key === 'track-bump' ) {

		return {
			pieceLocalY: 0.5 + cellY * STEP_HEIGHT,
			yawRad,
			pitch: 0,
			cellY,
			yFwd: cellY,
		};

	}

	// Forward neighbor along orient direction. dx,dz rounded to {-1,0,+1}.
	const dx = Math.round( Math.sin( yawRad ) );
	const dz = Math.round( Math.cos( yawRad ) );
	const yFwd = pickNeighborY( elevMap, gx + dx, gz + dz, cellY ) ?? cellY;

	const pieceLocalY = 0.5 + ( ( cellY + yFwd ) / 2 ) * STEP_HEIGHT;
	const pitch = - Math.atan2( ( yFwd - cellY ) * STEP_HEIGHT, CELL_RAW );

	return { pieceLocalY, yawRad, pitch, cellY, yFwd };

}

// Build a THREE.Quaternion from yawRad + pitch. Yaw then pitch
// (post-multiply) so pitch axis stays as world X after pre-yaw,
// which keeps the road tilting nose-up along travel direction.
export function makeCellQuaternion( yawRad, pitch, outQuat ) {

	_yawQ.setFromAxisAngle( _axisY, yawRad );
	_pitchQ.setFromAxisAngle( _axisX, pitch );
	const q = outQuat || new THREE.Quaternion();
	q.multiplyQuaternions( _yawQ, _pitchQ );
	return q;

}

// Hand-placed decorations cleared — track was widened/lengthened and the
// hand-placed positions overlapped new track cells. The auto-fill code
// below (lines ~190+) populates forest + tents around the live track bounds,
// so an empty list still produces lush surroundings.
const DECO_CELLS = [
	// Legacy hand-placed entries removed when track was lengthened.
	// Auto-fill (~line 190) handles all decorations around the live track bounds.
];

const NPC_TRUCKS = [
	[ 'vehicle-truck-green',  -3.51, -0.01,  12.70,  98.0 ],
	[ 'vehicle-truck-purple', -23.78, -0.14, -13.56,   0.0 ],
	[ 'vehicle-truck-red',    -1.36, -0.15, -23.80, 155.9 ],
];

export function buildTrack( scene, models, customCells ) {

	const trackGroup = new THREE.Group();
	trackGroup.position.y = -0.5;

	const trackPieceGroup = new THREE.Group();
	const decoGroup = new THREE.Group();

	const cells = customCells || TRACK_CELLS;
	const elevMap = buildElevationMap( cells );

	for ( const cell of cells ) {

		const piece = placePiece( models, cell, elevMap );
		if ( piece ) trackPieceGroup.add( piece );

	}

	{

		const occupied = new Set();
		let minX = Infinity, maxX = - Infinity;
		let minZ = Infinity, maxZ = - Infinity;

		for ( const [ gx, gz ] of cells ) {

			occupied.add( gx + ',' + gz );
			minX = Math.min( minX, gx );
			maxX = Math.max( maxX, gx );
			minZ = Math.min( minZ, gz );
			maxZ = Math.max( maxZ, gz );

		}

		const emptyPositions = [];
		const forestPositions = [];
		const tentPositions = [];
		const buckets = {
			'decoration-empty': emptyPositions,
			'decoration-forest': forestPositions,
			'decoration-tents': tentPositions,
		};

		if ( ! customCells ) {

			for ( const [ gx, gz, key, orient ] of DECO_CELLS ) {

				occupied.add( gx + ',' + gz );
				minX = Math.min( minX, gx );
				maxX = Math.max( maxX, gx );
				minZ = Math.min( minZ, gz );
				maxZ = Math.max( maxZ, gz );

				const x = ( gx + 0.5 ) * CELL_RAW;
				const z = ( gz + 0.5 ) * CELL_RAW;
				const rotQ = ( ( ORIENT_DEG[ orient ] ?? 0 ) / 90 ) | 0;
				buckets[ key ]?.push( x, z, rotQ );

			}

		}

		const pad = 2;

		// Simple hash for deterministic pseudo-random placement
		function hash( gx, gz ) {

			let h = gx * 374761393 + gz * 668265263;
			h = ( h ^ ( h >> 13 ) ) * 1274126177;
			return ( h ^ ( h >> 16 ) ) >>> 0;

		}

		for ( let gz = minZ - pad; gz <= maxZ + pad; gz ++ ) {

			for ( let gx = minX - pad; gx <= maxX + pad; gx ++ ) {

				if ( occupied.has( gx + ',' + gz ) ) continue;

				const distX = gx < minX ? minX - gx : gx > maxX ? gx - maxX : 0;
				const distZ = gz < minZ ? minZ - gz : gz > maxZ ? gz - maxZ : 0;
				const dist = Math.max( distX, distZ );

				const x = ( gx + 0.5 ) * CELL_RAW;
				const z = ( gz + 0.5 ) * CELL_RAW;

				const h = hash( gx, gz );
				// Sparse tree placement — about 1/3 of perimeter cells get a
				// tree, rest are grass. Dense wall of pink looked like a
				// peach fog band; sparse trees read as individuals.
				if ( h % 3 === 0 ) forestPositions.push( x, z, h % 4 );
				else emptyPositions.push( x, z, 0 );

			}

		}

		function createInstances( src, positions ) {

			if ( positions.length === 0 || ! src ) return;

			const count = positions.length / 3;

			// Ensure child world matrices are up to date so we can bake them
			// into per-child cloned geometries. Procedural Group trees have
			// per-mesh local transforms that InstancedMesh would otherwise
			// drop (only geometry + material are used).
			src.updateMatrixWorld( true );

			src.traverse( ( child ) => {

				if ( ! child.isMesh ) return;

				const bakedGeom = child.geometry.clone();
				bakedGeom.applyMatrix4( child.matrixWorld );

				const inst = new THREE.InstancedMesh( bakedGeom, child.material, count );
				inst.castShadow = true;
				inst.receiveShadow = true;

				for ( let i = 0; i < count; i ++ ) {

					_dummy.position.set( positions[ i * 3 ], 0.5, positions[ i * 3 + 1 ] );
					_dummy.rotation.y = positions[ i * 3 + 2 ] * Math.PI / 2;
					_dummy.updateMatrix();
					inst.setMatrixAt( i, _dummy.matrix );

				}

				decoGroup.add( inst );

			} );

		}

		createInstances( models[ 'decoration-empty' ], emptyPositions );
		createInstances( models[ 'decoration-forest' ], forestPositions );
		createInstances( models[ 'decoration-tents' ], tentPositions );

	}

	trackGroup.add( trackPieceGroup );
	trackGroup.add( decoGroup );

	trackGroup.scale.setScalar( 0.75 );
	scene.add( trackGroup );

	trackGroup.updateMatrixWorld( true );

	trackGroup.traverse( ( child ) => {

		if ( child.isMesh ) {

			child.castShadow = true;
			child.receiveShadow = true;

		}

	} );

	if ( ! customCells ) {

		for ( const [ key, x, y, z, rotDeg ] of NPC_TRUCKS ) {

			const src = models[ key ];
			if ( ! src ) continue;

			const npc = src.clone();
			npc.position.set( x, y, z );
			npc.rotation.y = THREE.MathUtils.degToRad( rotDeg + 180 );
			npc.traverse( ( c ) => {

				if ( c.isMesh ) {

					c.castShadow = true;
					c.receiveShadow = true;

				}

			} );
			scene.add( npc );

		}

	}

}

export function placePiece( models, cell, elevMap ) {

	const [ gx, gz, key ] = cell;
	const src = models[ key ];
	if ( ! src ) return null;

	const piece = src.clone();

	const { pieceLocalY, yawRad, pitch } = computeCellTransform( cell, elevMap );

	piece.position.set( ( gx + 0.5 ) * CELL_RAW, pieceLocalY, ( gz + 0.5 ) * CELL_RAW );
	makeCellQuaternion( yawRad, pitch, piece.quaternion );

	return piece;

}

// ─── Track Codec ──────────────────────────────────────────

const TYPE_NAMES = [ 'track-straight', 'track-corner', 'track-bump', 'track-finish' ];
const TYPE_INDEX = {};
for ( let i = 0; i < TYPE_NAMES.length; i ++ ) TYPE_INDEX[ TYPE_NAMES[ i ] ] = i;

const ORIENT_TO_GODOT = [ 0, 16, 10, 22 ];
const GODOT_TO_ORIENT = { 0: 0, 16: 1, 10: 2, 22: 3 };

export { TYPE_NAMES };

// Codec layout:
//   v0 (legacy, 3 bytes/cell): [gx+128, gz+128, (typeIdx<<2)|orientIdx]
//   v1 (4 bytes/cell, with elevation): [gx+128, gz+128, (typeIdx<<2)|orientIdx, y+128]
// Encoder always writes v1 prefixed with '1'. Decoder detects prefix —
// legacy URLs without the prefix fall back to v0 (y defaults to 0).
export function encodeCells( cells ) {

	const bytes = new Uint8Array( cells.length * 4 );

	for ( let i = 0; i < cells.length; i ++ ) {

		const [ gx, gz, name, godotOrient ] = cells[ i ];
		const y = cells[ i ][ 4 ] ?? 0;
		const ti = TYPE_INDEX[ name ] ?? 0;
		const oi = GODOT_TO_ORIENT[ godotOrient ] ?? 0;

		bytes[ i * 4 ] = gx + 128;
		bytes[ i * 4 + 1 ] = gz + 128;
		bytes[ i * 4 + 2 ] = ( ti << 2 ) | oi;
		bytes[ i * 4 + 3 ] = ( y + 128 ) & 0xff;

	}

	return '1' + bytesToBase64url( bytes );

}

export function decodeCells( str ) {

	if ( str && str.charAt( 0 ) === '1' ) {

		const bytes = base64urlToBytes( str.slice( 1 ) );
		const cells = [];
		for ( let i = 0; i + 3 < bytes.length; i += 4 ) {

			const gx = bytes[ i ] - 128;
			const gz = bytes[ i + 1 ] - 128;
			const packed = bytes[ i + 2 ];
			const y = bytes[ i + 3 ] - 128;
			const ti = ( packed >> 2 ) & 0x03;
			const oi = packed & 0x03;
			cells.push( [ gx, gz, TYPE_NAMES[ ti ], ORIENT_TO_GODOT[ oi ], y ] );

		}
		return cells;

	}

	// Legacy v0 — no elevation byte.
	const bytes = base64urlToBytes( str );
	const cells = [];

	for ( let i = 0; i + 2 < bytes.length; i += 3 ) {

		const gx = bytes[ i ] - 128;
		const gz = bytes[ i + 1 ] - 128;
		const packed = bytes[ i + 2 ];
		const ti = ( packed >> 2 ) & 0x03;
		const oi = packed & 0x03;

		cells.push( [ gx, gz, TYPE_NAMES[ ti ], ORIENT_TO_GODOT[ oi ], 0 ] );

	}

	return cells;

}

export function computeSpawnPosition( cells ) {

	let cell = cells[ 0 ];

	for ( const c of cells ) {

		if ( c[ 2 ] === 'track-finish' ) {

			cell = c;
			break;

		}

	}

	if ( ! cell ) return { position: [ 3.5, 0.5, 5 ], angle: 0 };

	const gx = cell[ 0 ];
	const gz = cell[ 1 ];
	const cellY = cell[ 4 ] ?? 0;
	const x = ( gx + 0.5 ) * CELL_RAW * GRID_SCALE;
	const z = ( gz + 0.5 ) * CELL_RAW * GRID_SCALE;
	// Lift spawn so vehicle drops onto the elevated road slab, not into it.
	const y = 0.5 + cellY * STEP_HEIGHT * GRID_SCALE;

	const orient = cell[ 3 ];
	const angle = THREE.MathUtils.degToRad( ORIENT_DEG[ orient ] || 0 );

	return { position: [ x, y, z ], angle };

}

export function computeTrackBounds( cells ) {

	if ( ! cells || cells.length === 0 ) return { centerX: 0, centerZ: 0, halfWidth: 30, halfDepth: 30 };

	let minX = Infinity, maxX = - Infinity;
	let minZ = Infinity, maxZ = - Infinity;

	for ( const [ gx, gz ] of cells ) {

		minX = Math.min( minX, gx );
		maxX = Math.max( maxX, gx );
		minZ = Math.min( minZ, gz );
		maxZ = Math.max( maxZ, gz );

	}

	const S = CELL_RAW * GRID_SCALE;
	const centerX = ( minX + maxX + 1 ) / 2 * S;
	const centerZ = ( minZ + maxZ + 1 ) / 2 * S;
	const halfWidth = ( maxX - minX + 1 ) / 2 * S + S;
	const halfDepth = ( maxZ - minZ + 1 ) / 2 * S + S;

	return { centerX, centerZ, halfWidth, halfDepth };

}

function bytesToBase64url( bytes ) {

	let binary = '';
	for ( let i = 0; i < bytes.length; i ++ ) binary += String.fromCharCode( bytes[ i ] );

	return btoa( binary ).replace( /\+/g, '-' ).replace( /\//g, '_' ).replace( /=+$/, '' );

}

function base64urlToBytes( str ) {

	const base64 = str.replace( /-/g, '+' ).replace( /_/g, '/' );
	const binary = atob( base64 );
	const bytes = new Uint8Array( binary.length );
	for ( let i = 0; i < binary.length; i ++ ) bytes[ i ] = binary.charCodeAt( i );

	return bytes;

}
