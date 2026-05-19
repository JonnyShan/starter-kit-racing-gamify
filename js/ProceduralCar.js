import * as THREE from 'three';

const BODY_COLOR = 0xe6e8eb;
const ROOF_COLOR = 0xe6e8eb;
const WHEEL_COLOR = 0x1a1a1a;
const RIM_COLOR = 0xb0b4ba;
const HEADLIGHT_COLOR = 0xfffaf0;
const TAILLIGHT_COLOR = 0xff4444;
const WINDOW_COLOR = 0x10182a;
const BUMPER_COLOR = 0x2c3038;

const BODY_LENGTH = 2.0;
const BODY_WIDTH = 0.9;
const BODY_HEIGHT = 0.35;
const HOOD_TAPER = 0.10; // front + rear taper height for AE86 wedge shape

const ROOF_LENGTH = 0.9;
const ROOF_WIDTH = 0.82;
const ROOF_HEIGHT = 0.3;
const ROOF_Z_OFFSET = -0.15; // pushed slightly rearward

const WHEEL_RADIUS = 0.18;
const WHEEL_WIDTH = 0.14;
const WHEEL_AXLE_INSET = 0.45; // distance from car centerline to axle origin along Z

const HEADLIGHT_W = 0.18;
const HEADLIGHT_H = 0.10;
const TAILLIGHT_W = 0.22;
const TAILLIGHT_H = 0.10;

const BODY_Y = WHEEL_RADIUS + BODY_HEIGHT / 2;
const ROOF_Y = WHEEL_RADIUS + BODY_HEIGHT + ROOF_HEIGHT / 2 - 0.05;

export function buildProceduralCar() {

	const root = new THREE.Group();
	root.name = 'vehicle-procedural';

	const bodyGroup = new THREE.Group();
	bodyGroup.name = 'body';

	const bodyMat = new THREE.MeshLambertMaterial( { color: BODY_COLOR } );
	const roofMat = new THREE.MeshLambertMaterial( { color: ROOF_COLOR } );
	const windowMat = new THREE.MeshLambertMaterial( { color: WINDOW_COLOR } );
	const headlightMat = new THREE.MeshBasicMaterial( { color: HEADLIGHT_COLOR } );
	const taillightMat = new THREE.MeshBasicMaterial( { color: TAILLIGHT_COLOR } );
	const bumperMat = new THREE.MeshLambertMaterial( { color: BUMPER_COLOR } );
	const wheelMat = new THREE.MeshLambertMaterial( { color: WHEEL_COLOR } );
	const rimMat = new THREE.MeshLambertMaterial( { color: RIM_COLOR } );

	// Main body box
	const body = new THREE.Mesh(
		new THREE.BoxGeometry( BODY_WIDTH, BODY_HEIGHT, BODY_LENGTH ),
		bodyMat,
	);
	body.position.y = BODY_Y;
	body.castShadow = true;
	body.receiveShadow = true;
	bodyGroup.add( body );

	// Front hood (slight wedge taper down)
	const hood = new THREE.Mesh(
		new THREE.BoxGeometry( BODY_WIDTH * 0.95, BODY_HEIGHT * 0.6, BODY_LENGTH * 0.28 ),
		bodyMat,
	);
	hood.position.set( 0, BODY_Y - HOOD_TAPER * 0.4, BODY_LENGTH * 0.32 );
	hood.castShadow = true;
	bodyGroup.add( hood );

	// Rear deck (slight taper)
	const rear = new THREE.Mesh(
		new THREE.BoxGeometry( BODY_WIDTH * 0.95, BODY_HEIGHT * 0.7, BODY_LENGTH * 0.22 ),
		bodyMat,
	);
	rear.position.set( 0, BODY_Y - HOOD_TAPER * 0.3, - BODY_LENGTH * 0.36 );
	rear.castShadow = true;
	bodyGroup.add( rear );

	// Roof
	const roof = new THREE.Mesh(
		new THREE.BoxGeometry( ROOF_WIDTH, ROOF_HEIGHT, ROOF_LENGTH ),
		roofMat,
	);
	roof.position.set( 0, ROOF_Y, ROOF_Z_OFFSET );
	roof.castShadow = true;
	bodyGroup.add( roof );

	// Windshield slope (a flatter wedge in front of roof)
	const windshield = new THREE.Mesh(
		new THREE.BoxGeometry( ROOF_WIDTH * 0.98, ROOF_HEIGHT * 0.9, 0.04 ),
		windowMat,
	);
	windshield.position.set( 0, ROOF_Y, ROOF_Z_OFFSET + ROOF_LENGTH / 2 + 0.005 );
	bodyGroup.add( windshield );

	// Rear window
	const rearWin = new THREE.Mesh(
		new THREE.BoxGeometry( ROOF_WIDTH * 0.95, ROOF_HEIGHT * 0.85, 0.04 ),
		windowMat,
	);
	rearWin.position.set( 0, ROOF_Y, ROOF_Z_OFFSET - ROOF_LENGTH / 2 - 0.005 );
	bodyGroup.add( rearWin );

	// Side windows (left + right thin panels)
	const sideWinGeom = new THREE.BoxGeometry( 0.04, ROOF_HEIGHT * 0.7, ROOF_LENGTH * 0.85 );
	for ( const xSign of [ - 1, 1 ] ) {

		const sideWin = new THREE.Mesh( sideWinGeom, windowMat );
		sideWin.position.set( xSign * ( ROOF_WIDTH / 2 + 0.005 ), ROOF_Y + 0.02, ROOF_Z_OFFSET );
		bodyGroup.add( sideWin );

	}

	// Headlights
	for ( const xSign of [ - 1, 1 ] ) {

		const hl = new THREE.Mesh(
			new THREE.BoxGeometry( HEADLIGHT_W, HEADLIGHT_H, 0.06 ),
			headlightMat,
		);
		hl.position.set( xSign * 0.28, BODY_Y + 0.02, BODY_LENGTH / 2 + 0.02 );
		bodyGroup.add( hl );

	}

	// Taillights
	for ( const xSign of [ - 1, 1 ] ) {

		const tl = new THREE.Mesh(
			new THREE.BoxGeometry( TAILLIGHT_W, TAILLIGHT_H, 0.06 ),
			taillightMat,
		);
		tl.position.set( xSign * 0.28, BODY_Y + 0.02, - BODY_LENGTH / 2 - 0.02 );
		bodyGroup.add( tl );

	}

	// Front + rear bumpers
	const frontBumper = new THREE.Mesh(
		new THREE.BoxGeometry( BODY_WIDTH * 1.02, 0.12, 0.08 ),
		bumperMat,
	);
	frontBumper.position.set( 0, WHEEL_RADIUS + 0.08, BODY_LENGTH / 2 + 0.04 );
	bodyGroup.add( frontBumper );

	const rearBumper = new THREE.Mesh(
		new THREE.BoxGeometry( BODY_WIDTH * 1.02, 0.12, 0.08 ),
		bumperMat,
	);
	rearBumper.position.set( 0, WHEEL_RADIUS + 0.08, - BODY_LENGTH / 2 - 0.04 );
	bodyGroup.add( rearBumper );

	root.add( bodyGroup );

	// Wheels — cylinder geom rotated so axis is along X (lateral). Rotation.x
	// then spins (rolls) the wheel, rotation.y steers it.
	const wheelGeom = new THREE.CylinderGeometry( WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 18 );
	wheelGeom.rotateZ( Math.PI / 2 );

	const rimGeom = new THREE.CylinderGeometry( WHEEL_RADIUS * 0.55, WHEEL_RADIUS * 0.55, WHEEL_WIDTH * 1.02, 12 );
	rimGeom.rotateZ( Math.PI / 2 );

	const wheelXOuter = BODY_WIDTH / 2 + WHEEL_WIDTH / 2 - 0.06;
	const wheelZ = WHEEL_AXLE_INSET + BODY_LENGTH / 2 - 0.7;

	const wheelDefs = [
		{ name: 'wheel-front-left',  x: - wheelXOuter, z:  wheelZ },
		{ name: 'wheel-front-right', x:   wheelXOuter, z:  wheelZ },
		{ name: 'wheel-back-left',   x: - wheelXOuter, z: - wheelZ },
		{ name: 'wheel-back-right',  x:   wheelXOuter, z: - wheelZ },
	];

	for ( const def of wheelDefs ) {

		const wheel = new THREE.Mesh( wheelGeom, wheelMat );
		wheel.name = def.name;
		wheel.position.set( def.x, WHEEL_RADIUS, def.z );
		wheel.castShadow = true;

		const rim = new THREE.Mesh( rimGeom, rimMat );
		rim.position.set( 0, 0, 0 );
		// Slightly outward so rim sits flush against tire's outer face.
		rim.position.x = ( def.x > 0 ? 1 : - 1 ) * 0.001;
		wheel.add( rim );

		root.add( wheel );

	}

	return root;

}
