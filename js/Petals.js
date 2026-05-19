import * as THREE from 'three';

const PETAL_COUNT = 200;
const PETAL_FALL_SPEED = 1.5;
const PETAL_SWAY_AMPLITUDE = 0.3;
const PETAL_SIZE = 0.4;
const PETAL_FIELD_RADIUS = 30;
const PETAL_TOP_Y = 25;
const PETAL_BOTTOM_Y = 0;
const PETAL_COLOR = 0xffb7c5;

function makePetalTexture() {

	const size = 64;
	const canvas = document.createElement( 'canvas' );
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext( '2d' );

	const cx = size / 2;
	const cy = size / 2;
	const rx = 18;
	const ry = 12;

	const grad = ctx.createRadialGradient( cx, cy, 0, cx, cy, rx );
	grad.addColorStop( 0, 'rgba(255,255,255,1)' );
	grad.addColorStop( 0.6, 'rgba(255,255,255,0.7)' );
	grad.addColorStop( 1, 'rgba(255,255,255,0)' );

	ctx.fillStyle = grad;
	ctx.beginPath();
	ctx.ellipse( cx, cy, rx, ry, 0, 0, Math.PI * 2 );
	ctx.fill();

	const tex = new THREE.CanvasTexture( canvas );
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 4;
	return tex;

}

export class Petals {

	constructor( scene ) {

		this.scene = scene;
		this._time = 0;

		this.positions = new Float32Array( PETAL_COUNT * 3 );
		this.phases = new Float32Array( PETAL_COUNT );

		for ( let i = 0; i < PETAL_COUNT; i ++ ) {

			this.positions[ i * 3 + 0 ] = ( Math.random() - 0.5 ) * 2 * PETAL_FIELD_RADIUS;
			this.positions[ i * 3 + 1 ] = PETAL_BOTTOM_Y + Math.random() * ( PETAL_TOP_Y - PETAL_BOTTOM_Y );
			this.positions[ i * 3 + 2 ] = ( Math.random() - 0.5 ) * 2 * PETAL_FIELD_RADIUS;
			this.phases[ i ] = Math.random() * Math.PI * 2;

		}

		const geometry = new THREE.BufferGeometry();
		this.posAttr = new THREE.BufferAttribute( this.positions, 3 );
		this.posAttr.setUsage( THREE.DynamicDrawUsage );
		geometry.setAttribute( 'position', this.posAttr );

		const material = new THREE.PointsMaterial( {
			map: makePetalTexture(),
			color: PETAL_COLOR,
			size: PETAL_SIZE,
			sizeAttenuation: true,
			transparent: true,
			depthWrite: false,
		} );

		this.points = new THREE.Points( geometry, material );
		this.points.frustumCulled = false;
		scene.add( this.points );

	}

	update( dt, cameraPosition ) {

		this._time += dt;
		const camX = cameraPosition.x;
		const camZ = cameraPosition.z;
		const pos = this.positions;

		for ( let i = 0; i < PETAL_COUNT; i ++ ) {

			const o = i * 3;

			pos[ o + 1 ] -= dt * PETAL_FALL_SPEED;
			pos[ o + 0 ] += Math.sin( this._time + this.phases[ i ] ) * dt * PETAL_SWAY_AMPLITUDE;

			const dx = pos[ o + 0 ] - camX;
			const dz = pos[ o + 2 ] - camZ;

			if ( pos[ o + 1 ] < PETAL_BOTTOM_Y ||
				dx > PETAL_FIELD_RADIUS || dx < - PETAL_FIELD_RADIUS ||
				dz > PETAL_FIELD_RADIUS || dz < - PETAL_FIELD_RADIUS ) {

				pos[ o + 0 ] = camX + ( Math.random() - 0.5 ) * 2 * PETAL_FIELD_RADIUS;
				pos[ o + 1 ] = PETAL_TOP_Y + Math.random() * 5;
				pos[ o + 2 ] = camZ + ( Math.random() - 0.5 ) * 2 * PETAL_FIELD_RADIUS;

			}

		}

		this.posAttr.needsUpdate = true;

	}

	dispose() {

		if ( this.points ) {

			this.scene.remove( this.points );
			this.points.geometry.dispose();
			this.points.material.map.dispose();
			this.points.material.dispose();
			this.points = null;

		}

	}

}
