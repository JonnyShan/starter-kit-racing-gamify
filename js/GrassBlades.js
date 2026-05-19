import * as THREE from 'three';

const BLADE_COUNT = 1200;
const BLADE_WIDTH = 0.18;
const BLADE_HEIGHT = 0.55;
const BLADE_COLOR = 0x70a942;
const BLADE_COLOR_VARIATION = 0.18; // up to ±18% on V channel
const TRACK_AVOID_PADDING = 1.0;    // metres clear of track edge

const _color = new THREE.Color();
const _hsl = { h: 0, s: 0, l: 0 };
const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();

function makeBladeTexture() {

	const w = 64;
	const h = 128;
	const canvas = document.createElement( 'canvas' );
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext( '2d' );

	// Gradient blade: bright tip, slightly darker base, alpha-fades on outer edge.
	const grad = ctx.createLinearGradient( 0, 0, 0, h );
	grad.addColorStop( 0, 'rgba(180, 220, 130, 1.0)' );
	grad.addColorStop( 0.7, 'rgba(105, 165, 70, 0.95)' );
	grad.addColorStop( 1, 'rgba(60, 115, 40, 0.0)' );

	ctx.fillStyle = grad;
	ctx.beginPath();
	ctx.moveTo( w * 0.5, 0 );
	ctx.bezierCurveTo( w * 0.85, h * 0.4, w * 0.7, h * 0.85, w * 0.55, h );
	ctx.lineTo( w * 0.45, h );
	ctx.bezierCurveTo( w * 0.3, h * 0.85, w * 0.15, h * 0.4, w * 0.5, 0 );
	ctx.closePath();
	ctx.fill();

	const tex = new THREE.CanvasTexture( canvas );
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 4;
	return tex;

}

export class GrassBlades {

	constructor( scene, trackBounds, trackCells ) {

		this.scene = scene;

		const geometry = new THREE.PlaneGeometry( BLADE_WIDTH, BLADE_HEIGHT );
		geometry.translate( 0, BLADE_HEIGHT / 2, 0 );

		const material = new THREE.MeshLambertMaterial( {
			map: makeBladeTexture(),
			color: BLADE_COLOR,
			transparent: true,
			alphaTest: 0.4,
			side: THREE.DoubleSide,
			depthWrite: false,
		} );

		this.mesh = new THREE.InstancedMesh( geometry, material, BLADE_COUNT );
		this.mesh.frustumCulled = false;
		this.mesh.receiveShadow = false;

		const occupied = new Set();
		const trackCellSize = 7.4925; // CELL_RAW * GRID_SCALE
		for ( const cell of trackCells ) {

			const [ gx, gz ] = cell;
			occupied.add( gx + ',' + gz );

		}

		const minX = trackBounds.centerX - trackBounds.halfWidth - 16;
		const maxX = trackBounds.centerX + trackBounds.halfWidth + 16;
		const minZ = trackBounds.centerZ - trackBounds.halfDepth - 16;
		const maxZ = trackBounds.centerZ + trackBounds.halfDepth + 16;

		let placed = 0;
		const maxAttempts = BLADE_COUNT * 6;
		let attempts = 0;

		while ( placed < BLADE_COUNT && attempts < maxAttempts ) {

			attempts ++;
			const x = minX + Math.random() * ( maxX - minX );
			const z = minZ + Math.random() * ( maxZ - minZ );

			const gx = Math.floor( x / trackCellSize );
			const gz = Math.floor( z / trackCellSize );

			if ( occupied.has( gx + ',' + gz ) ) continue;

			// Cell-local fraction (0..1 inside the cell)
			const fx = ( x / trackCellSize ) - gx;
			const fz = ( z / trackCellSize ) - gz;
			const edgeMargin = TRACK_AVOID_PADDING / trackCellSize;

			// Skip a tight margin around any cell adjacent to a track cell so we
			// don't put blades through the asphalt edges.
			const neighborOnTrack =
				occupied.has( ( gx + 1 ) + ',' + gz ) ||
				occupied.has( ( gx - 1 ) + ',' + gz ) ||
				occupied.has( gx + ',' + ( gz + 1 ) ) ||
				occupied.has( gx + ',' + ( gz - 1 ) );

			if ( neighborOnTrack ) {

				if ( occupied.has( ( gx + 1 ) + ',' + gz ) && fx > 1 - edgeMargin ) continue;
				if ( occupied.has( ( gx - 1 ) + ',' + gz ) && fx < edgeMargin ) continue;
				if ( occupied.has( gx + ',' + ( gz + 1 ) ) && fz > 1 - edgeMargin ) continue;
				if ( occupied.has( gx + ',' + ( gz - 1 ) ) && fz < edgeMargin ) continue;

			}

			_position.set( x, 0, z );
			_euler.set( 0, Math.random() * Math.PI * 2, 0 );
			_quaternion.setFromEuler( _euler );
			const sizeJitter = 0.7 + Math.random() * 0.6;
			_scale.set( 1, sizeJitter, 1 );
			_matrix.compose( _position, _quaternion, _scale );
			this.mesh.setMatrixAt( placed, _matrix );

			// Per-instance color variation
			_color.setHex( BLADE_COLOR );
			_color.getHSL( _hsl );
			_hsl.l = THREE.MathUtils.clamp(
				_hsl.l + ( Math.random() - 0.5 ) * BLADE_COLOR_VARIATION,
				0, 1,
			);
			_color.setHSL( _hsl.h, _hsl.s, _hsl.l );
			this.mesh.setColorAt( placed, _color );

			placed ++;

		}

		this.mesh.count = placed;
		this.mesh.instanceMatrix.needsUpdate = true;
		if ( this.mesh.instanceColor ) this.mesh.instanceColor.needsUpdate = true;

		scene.add( this.mesh );

	}

	dispose() {

		if ( this.mesh ) {

			this.scene.remove( this.mesh );
			this.mesh.geometry.dispose();
			this.mesh.material.map.dispose();
			this.mesh.material.dispose();
			this.mesh = null;

		}

	}

}
