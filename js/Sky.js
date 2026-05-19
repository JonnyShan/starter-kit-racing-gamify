import * as THREE from 'three';

const SKY_TOP_COLOR = 0x4a7fc1;
const SKY_BOTTOM_COLOR = 0xc8e2ff;
const SKY_HORIZON_OFFSET = 0.3;
const SKY_RADIUS = 500;

const CLOUD_COUNT = 8;
const CLOUD_SIZE_MIN = 60;
const CLOUD_SIZE_MAX = 110;
const CLOUD_RING_RADIUS = 300;
const CLOUD_HEIGHT_MIN = 80;
const CLOUD_HEIGHT_MAX = 180;
const CLOUD_DRIFT_SPEED = 0.5;
const CLOUD_TINT = 0xfffaf0;

export class Sky {

	constructor( scene ) {

		this.scene = scene;
		this.skydome = this._buildSkydome();
		this.cloudGroup = this._buildCloudField();

		scene.add( this.skydome );
		scene.add( this.cloudGroup );

	}

	_buildSkydome() {

		const geometry = new THREE.IcosahedronGeometry( SKY_RADIUS, 4 );

		const material = new THREE.ShaderMaterial( {
			side: THREE.BackSide,
			depthWrite: false,
			fog: false,
			uniforms: {
				topColor: { value: new THREE.Color( SKY_TOP_COLOR ) },
				bottomColor: { value: new THREE.Color( SKY_BOTTOM_COLOR ) },
				offset: { value: SKY_HORIZON_OFFSET },
				radius: { value: SKY_RADIUS },
			},
			vertexShader: `
				varying vec3 vWorldPos;
				void main() {
					vec4 wp = modelMatrix * vec4( position, 1.0 );
					vWorldPos = wp.xyz;
					gl_Position = projectionMatrix * viewMatrix * wp;
				}
			`,
			fragmentShader: `
				uniform vec3 topColor;
				uniform vec3 bottomColor;
				uniform float offset;
				uniform float radius;
				varying vec3 vWorldPos;
				void main() {
					float t = clamp( vWorldPos.y / radius + offset, 0.0, 1.0 );
					t = smoothstep( 0.0, 1.0, t );
					gl_FragColor = vec4( mix( bottomColor, topColor, t ), 1.0 );
				}
			`,
		} );

		const mesh = new THREE.Mesh( geometry, material );
		mesh.frustumCulled = false;
		mesh.renderOrder = - 10;
		return mesh;

	}

	_makeCloudTexture() {

		const size = 256;
		const canvas = document.createElement( 'canvas' );
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext( '2d' );

		const blobs = 14;
		const cx = size * 0.5;
		const cy = size * 0.55;
		for ( let i = 0; i < blobs; i ++ ) {

			const ang = Math.random() * Math.PI * 2;
			const dist = Math.random() * size * 0.28;
			const x = cx + Math.cos( ang ) * dist;
			const y = cy + Math.sin( ang ) * dist * 0.5;
			const r = size * ( 0.18 + Math.random() * 0.18 );
			const grad = ctx.createRadialGradient( x, y, 0, x, y, r );
			grad.addColorStop( 0, 'rgba(255,255,255,0.85)' );
			grad.addColorStop( 0.5, 'rgba(255,255,255,0.45)' );
			grad.addColorStop( 1, 'rgba(255,255,255,0)' );
			ctx.fillStyle = grad;
			ctx.fillRect( 0, 0, size, size );

		}

		const tex = new THREE.CanvasTexture( canvas );
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.anisotropy = 4;
		return tex;

	}

	_buildCloudField() {

		const texture = this._makeCloudTexture();
		const material = new THREE.SpriteMaterial( {
			map: texture,
			color: CLOUD_TINT,
			transparent: true,
			depthWrite: false,
			fog: false,
		} );

		const group = new THREE.Group();

		for ( let i = 0; i < CLOUD_COUNT; i ++ ) {

			const sprite = new THREE.Sprite( material );
			const angle = ( i / CLOUD_COUNT ) * Math.PI * 2 + Math.random() * 0.4;
			const radius = CLOUD_RING_RADIUS * ( 0.7 + Math.random() * 0.6 );
			sprite.position.set(
				Math.cos( angle ) * radius,
				CLOUD_HEIGHT_MIN + Math.random() * ( CLOUD_HEIGHT_MAX - CLOUD_HEIGHT_MIN ),
				Math.sin( angle ) * radius,
			);
			const size = CLOUD_SIZE_MIN + Math.random() * ( CLOUD_SIZE_MAX - CLOUD_SIZE_MIN );
			sprite.scale.set( size, size * 0.5, 1 );
			group.add( sprite );

		}

		return group;

	}

	update( dt, cameraPosition ) {

		if ( ! this.cloudGroup ) return;

		const wrapRange = CLOUD_RING_RADIUS * 2;
		const halfWrap = wrapRange / 2;
		const camX = cameraPosition.x;
		const camZ = cameraPosition.z;

		for ( const cloud of this.cloudGroup.children ) {

			cloud.position.x += dt * CLOUD_DRIFT_SPEED;

			const dx = cloud.position.x - camX;
			if ( dx > halfWrap ) cloud.position.x -= wrapRange;
			else if ( dx < - halfWrap ) cloud.position.x += wrapRange;

			const dz = cloud.position.z - camZ;
			if ( dz > halfWrap ) cloud.position.z -= wrapRange;
			else if ( dz < - halfWrap ) cloud.position.z += wrapRange;

		}

	}

	dispose() {
	}

}
