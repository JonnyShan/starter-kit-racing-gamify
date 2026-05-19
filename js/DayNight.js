import * as THREE from 'three';

const TRANSITION_SECONDS = 1.5;

const DAY = {
	bg: 0xc8e2ff,
	fog: 0xc8e2ff,
	dirColor: 0xfffaf0,
	dirIntensity: 4,
	hemiSky: 0xa3d4ff,
	hemiGround: 0x6fa84a,
	hemiIntensity: 1.8,
	exposure: 1.05,
	skyTop: 0x4a7fc1,
	skyBottom: 0xc8e2ff,
};

const NIGHT = {
	bg: 0x0d1426,
	fog: 0x0d1426,
	dirColor: 0x5c7eb8,
	dirIntensity: 0.5,
	hemiSky: 0x1a2540,
	hemiGround: 0x0a1518,
	hemiIntensity: 0.3,
	exposure: 0.85,
	skyTop: 0x0a1428,
	skyBottom: 0x1f2d4a,
};

export class DayNight {

	constructor( { scene, renderer, dirLight, hemiLight, sky } ) {

		this.scene = scene;
		this.renderer = renderer;
		this.dirLight = dirLight;
		this.hemiLight = hemiLight;
		this.sky = sky;

		this.dayMode = true;
		this.t = 1;
		this.from = this._snapshotPreset( DAY );
		this.to = this._snapshotPreset( DAY );

		this._onKey = ( e ) => {
			if ( e.code === 'KeyN' ) this._toggle();
		};
		window.addEventListener( 'keydown', this._onKey );

	}

	_snapshotPreset( preset ) {

		return {
			bg: new THREE.Color( preset.bg ),
			fog: new THREE.Color( preset.fog ),
			dirColor: new THREE.Color( preset.dirColor ),
			dirIntensity: preset.dirIntensity,
			hemiSky: new THREE.Color( preset.hemiSky ),
			hemiGround: new THREE.Color( preset.hemiGround ),
			hemiIntensity: preset.hemiIntensity,
			exposure: preset.exposure,
			skyTop: new THREE.Color( preset.skyTop ),
			skyBottom: new THREE.Color( preset.skyBottom ),
		};

	}

	_toggle() {

		this.from = {
			bg: this.scene.background.clone(),
			fog: this.scene.fog.color.clone(),
			dirColor: this.dirLight.color.clone(),
			dirIntensity: this.dirLight.intensity,
			hemiSky: this.hemiLight.color.clone(),
			hemiGround: this.hemiLight.groundColor.clone(),
			hemiIntensity: this.hemiLight.intensity,
			exposure: this.renderer.toneMappingExposure,
			skyTop: this.sky.skydome.material.uniforms.topColor.value.clone(),
			skyBottom: this.sky.skydome.material.uniforms.bottomColor.value.clone(),
		};
		this.dayMode = ! this.dayMode;
		this.to = this._snapshotPreset( this.dayMode ? DAY : NIGHT );
		this.t = 0;

	}

	update( dt ) {

		if ( this.t >= 1 ) return;

		this.t = Math.min( 1, this.t + dt / TRANSITION_SECONDS );
		const e = this.t;
		const f = this.from;
		const to = this.to;

		this.scene.background.lerpColors( f.bg, to.bg, e );
		this.scene.fog.color.lerpColors( f.fog, to.fog, e );

		this.dirLight.color.lerpColors( f.dirColor, to.dirColor, e );
		this.dirLight.intensity = f.dirIntensity + ( to.dirIntensity - f.dirIntensity ) * e;

		this.hemiLight.color.lerpColors( f.hemiSky, to.hemiSky, e );
		this.hemiLight.groundColor.lerpColors( f.hemiGround, to.hemiGround, e );
		this.hemiLight.intensity = f.hemiIntensity + ( to.hemiIntensity - f.hemiIntensity ) * e;

		this.renderer.toneMappingExposure = f.exposure + ( to.exposure - f.exposure ) * e;

		const skyTop = this.sky.skydome.material.uniforms.topColor.value;
		const skyBottom = this.sky.skydome.material.uniforms.bottomColor.value;
		skyTop.lerpColors( f.skyTop, to.skyTop, e );
		skyBottom.lerpColors( f.skyBottom, to.skyBottom, e );

	}

	dispose() {

		window.removeEventListener( 'keydown', this._onKey );

	}

}
