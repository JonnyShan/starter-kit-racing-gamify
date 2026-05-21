import * as THREE from 'three';
import { CELL_RAW, GRID_SCALE, STEP_HEIGHT } from './Track.js';

// Black-and-white checkered banner spanning the road at the last cell.
// Detects when the vehicle crosses, displays elapsed time + final message.

const POLE_HEIGHT = 5.0;
const POLE_RADIUS = 0.15;
const POLE_COLOR = 0x222222;
const BANNER_WIDTH = 12.0;
const BANNER_HEIGHT = 1.2;

function makeCheckerTexture() {

	const w = 64, h = 8;
	const c = document.createElement( 'canvas' );
	c.width = w; c.height = h;
	const ctx = c.getContext( '2d' );
	const cells = 8;
	const cw = w / cells;
	const ch = h / 1;
	for ( let i = 0; i < cells; i ++ ) {

		ctx.fillStyle = ( i % 2 === 0 ) ? '#000000' : '#ffffff';
		ctx.fillRect( i * cw, 0, cw, ch );

	}
	const tex = new THREE.CanvasTexture( c );
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.magFilter = THREE.NearestFilter;
	tex.minFilter = THREE.NearestFilter;
	return tex;

}

export class FinishLine {

	constructor( scene, cells ) {

		this.finished = false;
		this.startTime = 0;
		this.finishTime = 0;

		if ( ! cells || cells.length === 0 ) {

			this.lastCell = null;
			return;

		}

		this.lastCell = cells[ cells.length - 1 ];

		const [ gx, gz ] = this.lastCell;
		const cellY = this.lastCell[ 4 ] ?? 0;
		const cellW = CELL_RAW * GRID_SCALE;
		const cx = ( gx + 0.5 ) * cellW;
		const cz = ( gz + 0.5 ) * cellW;
		const baseY = - 0.5 + ( 0.5 + cellY * STEP_HEIGHT ) * GRID_SCALE;

		// Threshold: trigger when vehicle Z >= banner Z minus a small lead.
		this.triggerZ = cz - cellW * 0.4;

		const group = new THREE.Group();
		group.position.set( cx, baseY, cz );

		const poleMat = new THREE.MeshLambertMaterial( { color: POLE_COLOR } );
		const poleGeom = new THREE.CylinderGeometry( POLE_RADIUS, POLE_RADIUS, POLE_HEIGHT, 8 );

		const leftPole = new THREE.Mesh( poleGeom, poleMat );
		leftPole.position.set( - BANNER_WIDTH / 2, POLE_HEIGHT / 2, 0 );
		leftPole.castShadow = true;
		group.add( leftPole );

		const rightPole = new THREE.Mesh( poleGeom, poleMat );
		rightPole.position.set( + BANNER_WIDTH / 2, POLE_HEIGHT / 2, 0 );
		rightPole.castShadow = true;
		group.add( rightPole );

		const bannerGeom = new THREE.PlaneGeometry( BANNER_WIDTH, BANNER_HEIGHT );
		const bannerMat = new THREE.MeshLambertMaterial( {
			map: makeCheckerTexture(),
			side: THREE.DoubleSide,
		} );
		const banner = new THREE.Mesh( bannerGeom, bannerMat );
		banner.position.y = POLE_HEIGHT - BANNER_HEIGHT / 2;
		group.add( banner );

		scene.add( group );

		this.buildUI();

	}

	buildUI() {

		const style = document.createElement( 'style' );
		style.textContent = `
			#finish-overlay {
				position: fixed;
				inset: 0;
				display: flex;
				align-items: center;
				justify-content: center;
				background: rgba(0,0,0,0.55);
				color: #fff;
				font: 600 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
				z-index: 30;
				opacity: 0;
				pointer-events: none;
				transition: opacity 0.4s ease-out;
			}
			#finish-overlay.show { opacity: 1; pointer-events: auto; }
			#finish-overlay .card {
				background: rgba(20,20,28,0.92);
				border-radius: 14px;
				padding: 28px 40px;
				text-align: center;
				min-width: 280px;
				backdrop-filter: blur(10px);
				-webkit-backdrop-filter: blur(10px);
			}
			#finish-overlay h2 { margin: 0 0 12px; font-size: 22px; letter-spacing: 0.1em; }
			#finish-overlay .time { font: 800 56px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums; margin: 8px 0 18px; color: #5af168; }
			#finish-overlay button { font: 600 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 10px 22px; border: none; border-radius: 999px; background: #5af168; color: #08110a; cursor: pointer; }
		`;
		document.head.appendChild( style );

		const overlay = document.createElement( 'div' );
		overlay.id = 'finish-overlay';
		overlay.innerHTML = `
			<div class="card">
				<h2>FINISH</h2>
				<div class="time">0:00.00</div>
				<button>RESTART</button>
			</div>
		`;
		document.body.appendChild( overlay );

		this.overlay = overlay;
		this.timeEl = overlay.querySelector( '.time' );
		overlay.querySelector( 'button' ).addEventListener( 'click', () => location.reload() );

	}

	update( dt, spherePos, hasInput ) {

		if ( ! this.lastCell ) return;

		if ( ! this.startTime && hasInput ) this.startTime = performance.now();

		if ( this.finished ) return;

		// Compare Z to last-cell Z; user drives south (+Z) on the linear
		// track, so reaching triggerZ means they're at the banner.
		if ( this.startTime && spherePos.z >= this.triggerZ ) {

			this.finished = true;
			this.finishTime = ( performance.now() - this.startTime ) / 1000;
			this._show();

		}

	}

	_show() {

		if ( ! this.overlay ) return;

		const m = Math.floor( this.finishTime / 60 );
		const s = this.finishTime - m * 60;
		const str = `${ m }:${ s.toFixed( 2 ).padStart( 5, '0' ) }`;
		this.timeEl.textContent = str;
		this.overlay.classList.add( 'show' );

	}

}
