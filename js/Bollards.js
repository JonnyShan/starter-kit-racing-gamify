import * as THREE from 'three';
import { CELL_RAW, GRID_SCALE, ORIENT_DEG, STEP_HEIGHT } from './Track.js';

const BOLLARD_RADIUS = 0.12;
const BOLLARD_HEIGHT = 1.0;
const BOLLARDS_PER_CORNER = 5;
const BOLLARD_OFFSET = 0.5;
const BOLLARD_BASE_LIFT = 0.05;
const BOLLARD_ANGLES_DEG = [ 5, 25, 45, 65, 85 ];
const STRIPE_RED = '#c43a2c';
const STRIPE_WHITE = '#ffffff';

function makeStripeTexture() {

	const w = 32;
	const h = 128;
	const canvas = document.createElement( 'canvas' );
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext( '2d' );

	ctx.fillStyle = STRIPE_RED;
	ctx.fillRect( 0, 0, w, h );

	ctx.fillStyle = STRIPE_WHITE;
	const bands = [ 18, 60, 100 ];
	const bandHeight = 12;
	for ( const y of bands ) ctx.fillRect( 0, y, w, bandHeight );

	const tex = new THREE.CanvasTexture( canvas );
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 4;
	return tex;

}

export function buildBollards( scene, cells ) {

	const corners = cells.filter( ( c ) => c[ 2 ] === 'track-corner' );
	if ( corners.length === 0 ) return null;

	const stripeTex = makeStripeTexture();
	const material = new THREE.MeshLambertMaterial( { map: stripeTex } );
	const geometry = new THREE.CylinderGeometry( BOLLARD_RADIUS, BOLLARD_RADIUS, BOLLARD_HEIGHT, 12 );

	const count = corners.length * BOLLARDS_PER_CORNER;
	const inst = new THREE.InstancedMesh( geometry, material, count );
	inst.castShadow = true;
	inst.receiveShadow = false;

	const dummy = new THREE.Object3D();
	const cellWorld = CELL_RAW * GRID_SCALE;
	const cellHalfWorld = cellWorld / 2;
	const outerRadius = ( 2 * ( CELL_RAW / 2 ) - 0.25 ) * GRID_SCALE;
	const placeRadius = outerRadius - BOLLARD_OFFSET;
	const trackYBase = - 0.5 + BOLLARD_HEIGHT / 2 + BOLLARD_BASE_LIFT;

	let idx = 0;
	for ( const cell of corners ) {

		const [ gx, gz, _, orient ] = cell;
		const cellY = cell[ 4 ] ?? 0;
		// Corners stay flat — lift bollards by integer-step elevation only.
		const trackY = trackYBase + cellY * STEP_HEIGHT * GRID_SCALE;

		const cellCenterX = ( gx + 0.5 ) * cellWorld;
		const cellCenterZ = ( gz + 0.5 ) * cellWorld;
		const orientDeg = ORIENT_DEG[ orient ] ?? 0;
		const orientRad = orientDeg * Math.PI / 180;

		const arcLocalX = - cellHalfWorld;
		const arcLocalZ = + cellHalfWorld;
		const cos = Math.cos( orientRad );
		const sin = Math.sin( orientRad );
		const arcWorldX = cellCenterX + arcLocalX * cos - arcLocalZ * sin;
		const arcWorldZ = cellCenterZ + arcLocalX * sin + arcLocalZ * cos;

		for ( const ang of BOLLARD_ANGLES_DEG ) {

			const a = ang * Math.PI / 180 + orientRad;
			const x = arcWorldX + placeRadius * Math.cos( a );
			const z = arcWorldZ - placeRadius * Math.sin( a );
			dummy.position.set( x, trackY, z );
			dummy.rotation.set( 0, 0, 0 );
			dummy.updateMatrix();
			inst.setMatrixAt( idx, dummy.matrix );
			idx += 1;

		}

	}

	inst.instanceMatrix.needsUpdate = true;
	scene.add( inst );
	return inst;

}
