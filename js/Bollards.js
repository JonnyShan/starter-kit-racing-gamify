import * as THREE from 'three';
import { CELL_RAW, GRID_SCALE, ORIENT_DEG } from './Track.js';

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

	return null;

}
