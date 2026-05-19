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
		this.cloudGroup = null;

		scene.add( this.skydome );

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

	update( dt, cameraPosition ) {
	}

	dispose() {
	}

}
