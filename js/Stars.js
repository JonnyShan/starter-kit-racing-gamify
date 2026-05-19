import * as THREE from 'three';

const STAR_COUNT = 400;
const STAR_RADIUS = 480;
const STAR_MIN_Y_FRACTION = 0.15;
const STAR_SIZE = 1.2;
const MOON_HEIGHT = 200;
const MOON_OFFSET_X = -300;
const MOON_OFFSET_Z = -200;
const MOON_SIZE = 40;
const HEMI_DAY = 1.8;
const HEMI_NIGHT = 0.3;

function makeMoonTexture() {

	const size = 128;
	const canvas = document.createElement( 'canvas' );
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext( '2d' );

	const cx = size / 2;
	const cy = size / 2;
	const grad = ctx.createRadialGradient( cx, cy, 0, cx, cy, size / 2 );
	grad.addColorStop( 0, 'rgba(255,250,220,1)' );
	grad.addColorStop( 0.4, 'rgba(255,245,200,0.95)' );
	grad.addColorStop( 0.7, 'rgba(255,240,180,0.4)' );
	grad.addColorStop( 1, 'rgba(255,240,180,0)' );

	ctx.fillStyle = grad;
	ctx.fillRect( 0, 0, size, size );

	const tex = new THREE.CanvasTexture( canvas );
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 4;
	return tex;

}

export class Stars {

	constructor( scene, hemiLight ) {

		this.scene = scene;
		this.hemiLight = hemiLight;

		this.stars = this._buildStars();
		scene.add( this.stars );

		this.moon = this._buildMoon();
		scene.add( this.moon );

	}

	_buildStars() {

		const positions = new Float32Array( STAR_COUNT * 3 );
		for ( let i = 0; i < STAR_COUNT; i ++ ) {

			let x, y, z, len;
			do {
				x = Math.random() * 2 - 1;
				y = Math.random();
				z = Math.random() * 2 - 1;
				len = Math.sqrt( x * x + y * y + z * z );
			} while ( len < 0.001 || y / len < STAR_MIN_Y_FRACTION );

			positions[ i * 3 + 0 ] = ( x / len ) * STAR_RADIUS;
			positions[ i * 3 + 1 ] = ( y / len ) * STAR_RADIUS;
			positions[ i * 3 + 2 ] = ( z / len ) * STAR_RADIUS;

		}

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );

		const material = new THREE.PointsMaterial( {
			color: 0xffffff,
			size: STAR_SIZE,
			sizeAttenuation: false,
			transparent: true,
			opacity: 0,
			depthWrite: false,
			fog: false,
		} );

		const points = new THREE.Points( geometry, material );
		points.frustumCulled = false;
		points.renderOrder = - 5;
		return points;

	}

	_buildMoon() {

		const material = new THREE.SpriteMaterial( {
			map: makeMoonTexture(),
			transparent: true,
			opacity: 0,
			depthWrite: false,
			fog: false,
		} );

		const sprite = new THREE.Sprite( material );
		sprite.position.set( MOON_OFFSET_X, MOON_HEIGHT, MOON_OFFSET_Z );
		sprite.scale.set( MOON_SIZE, MOON_SIZE, 1 );
		sprite.renderOrder = - 4;
		return sprite;

	}

	update( dt ) {

		const opacity = THREE.MathUtils.clamp(
			1 - ( this.hemiLight.intensity - HEMI_NIGHT ) / ( HEMI_DAY - HEMI_NIGHT ),
			0, 1
		);

		this.stars.material.opacity = opacity;
		this.moon.material.opacity = opacity;

	}

	dispose() {

		if ( this.stars ) {

			this.scene.remove( this.stars );
			this.stars.geometry.dispose();
			this.stars.material.dispose();
			this.stars = null;

		}

		if ( this.moon ) {

			this.scene.remove( this.moon );
			this.moon.material.map.dispose();
			this.moon.material.dispose();
			this.moon = null;

		}

	}

}
