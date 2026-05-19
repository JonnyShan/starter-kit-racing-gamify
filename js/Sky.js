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
		this.skydome = null;
		this.cloudGroup = null;

	}

	update( dt, cameraPosition ) {
	}

	dispose() {
	}

}
