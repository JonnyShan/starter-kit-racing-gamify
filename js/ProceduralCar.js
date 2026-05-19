import * as THREE from 'three';

const BODY_COLOR = 0xeef0f3;       // off-white panel
const ACCENT_COLOR = 0x2c3038;     // black mid-body stripe / lower
const ROOF_COLOR = 0xeef0f3;
const WHEEL_COLOR = 0x141416;      // tyre
const RIM_COLOR = 0xb6bcc4;        // alloy rim face
const RIM_DARK = 0x32363c;         // rim recess
const HEADLIGHT_COLOR = 0xfff4d2;
const TAILLIGHT_COLOR = 0xff3a3a;
const WINDOW_COLOR = 0x0e1626;
const MIRROR_COLOR = 0xeef0f3;

const BODY_LENGTH = 2.1;
const BODY_WIDTH = 0.92;
const BODY_LOWER_HEIGHT = 0.18; // lower black skirt band
const BODY_UPPER_HEIGHT = 0.28; // main panel above the skirt

const HOOD_LENGTH = 0.7;
const HOOD_HEIGHT = 0.16;        // shorter than cabin -> slope effect
const HOOD_DROP_FRONT = 0.06;    // front edge tapers down

const CABIN_LENGTH = 0.95;
const CABIN_HEIGHT = 0.34;
const CABIN_WIDTH = 0.88;
const CABIN_Z = - 0.05;           // slightly toward rear

const FASTBACK_LENGTH = 0.45;     // rear sloped roof
const FASTBACK_HEIGHT = 0.30;

const TRUNK_LENGTH = 0.50;
const TRUNK_HEIGHT = 0.20;

const WHEEL_RADIUS = 0.22;
const WHEEL_WIDTH = 0.14;
const WHEEL_INSET = 0.04;         // each wheel slightly tucked inside body

const HEADLIGHT_W = 0.20;
const HEADLIGHT_H = 0.10;
const TAILLIGHT_W = 0.24;
const TAILLIGHT_H = 0.09;

const MIRROR_W = 0.07;
const MIRROR_H = 0.06;
const MIRROR_L = 0.10;

const SPOILER_W = 0.85;
const SPOILER_H = 0.05;
const SPOILER_L = 0.10;

const BUMPER_H = 0.10;
const BUMPER_L = 0.10;

// Y reference: tires touch ground at y=0; wheel centre at WHEEL_RADIUS.
const BODY_BASE_Y = WHEEL_RADIUS * 0.78;   // sit body just above wheel bottoms
const LOWER_Y = BODY_BASE_Y + BODY_LOWER_HEIGHT / 2;
const UPPER_Y = BODY_BASE_Y + BODY_LOWER_HEIGHT + BODY_UPPER_HEIGHT / 2;
const HOOD_Y = BODY_BASE_Y + BODY_LOWER_HEIGHT + BODY_UPPER_HEIGHT / 2;
const CABIN_Y = BODY_BASE_Y + BODY_LOWER_HEIGHT + BODY_UPPER_HEIGHT + CABIN_HEIGHT / 2;

function addBox( parent, w, h, l, mat, x, y, z, rotY, rotX ) {

	const mesh = new THREE.Mesh( new THREE.BoxGeometry( w, h, l ), mat );
	mesh.position.set( x, y, z );
	if ( rotY ) mesh.rotation.y = rotY;
	if ( rotX ) mesh.rotation.x = rotX;
	mesh.castShadow = true;
	return parent.add( mesh ), mesh;

}

export function buildProceduralCar() {

	const root = new THREE.Group();
	root.name = 'vehicle-procedural';

	const bodyGroup = new THREE.Group();
	bodyGroup.name = 'body';

	const bodyMat = new THREE.MeshLambertMaterial( { color: BODY_COLOR } );
	const accentMat = new THREE.MeshLambertMaterial( { color: ACCENT_COLOR } );
	const roofMat = new THREE.MeshLambertMaterial( { color: ROOF_COLOR } );
	const windowMat = new THREE.MeshLambertMaterial( { color: WINDOW_COLOR } );
	const headlightMat = new THREE.MeshBasicMaterial( { color: HEADLIGHT_COLOR } );
	const taillightMat = new THREE.MeshBasicMaterial( { color: TAILLIGHT_COLOR } );
	const mirrorMat = new THREE.MeshLambertMaterial( { color: MIRROR_COLOR } );

	// Lower black skirt (looks like the body's lower line accent on AE86)
	addBox( bodyGroup, BODY_WIDTH, BODY_LOWER_HEIGHT, BODY_LENGTH, accentMat, 0, LOWER_Y, 0 );

	// Main upper body panel
	addBox( bodyGroup, BODY_WIDTH, BODY_UPPER_HEIGHT, BODY_LENGTH * 0.95, bodyMat, 0, UPPER_Y, 0 );

	// Hood (front section, slightly lower than upper body)
	const hood = addBox(
		bodyGroup,
		BODY_WIDTH * 0.95, HOOD_HEIGHT, HOOD_LENGTH, bodyMat,
		0, HOOD_Y, BODY_LENGTH / 2 - HOOD_LENGTH / 2 - 0.02,
	);
	hood.geometry.translate( 0, 0, 0 );
	// Tilt hood slightly so the front edge sits lower (AE86 wedge)
	hood.rotation.x = - HOOD_DROP_FRONT / HOOD_LENGTH;

	// Cabin (with windows)
	addBox(
		bodyGroup,
		CABIN_WIDTH, CABIN_HEIGHT, CABIN_LENGTH, roofMat,
		0, CABIN_Y, CABIN_Z,
	);

	// Fastback wedge (rear-sloped roof). Use a slightly tilted box approximating
	// a triangular prism — the front-bottom face hugs the cabin, the rear sits
	// low onto the trunk.
	const fastback = new THREE.Mesh(
		new THREE.BoxGeometry( CABIN_WIDTH * 0.98, FASTBACK_HEIGHT, FASTBACK_LENGTH ),
		roofMat,
	);
	fastback.position.set( 0, CABIN_Y - FASTBACK_HEIGHT * 0.15, CABIN_Z - CABIN_LENGTH / 2 - FASTBACK_LENGTH / 2 + 0.02 );
	fastback.rotation.x = - 0.35;
	fastback.castShadow = true;
	bodyGroup.add( fastback );

	// Trunk lid (flat top behind fastback)
	addBox(
		bodyGroup,
		BODY_WIDTH * 0.95, TRUNK_HEIGHT, TRUNK_LENGTH, bodyMat,
		0, HOOD_Y + 0.02, - BODY_LENGTH / 2 + TRUNK_LENGTH / 2 + 0.02,
	);

	// Spoiler stub at rear of trunk
	addBox(
		bodyGroup,
		SPOILER_W, SPOILER_H, SPOILER_L, accentMat,
		0, HOOD_Y + TRUNK_HEIGHT / 2 + SPOILER_H / 2, - BODY_LENGTH / 2 + SPOILER_L / 2 + 0.05,
	);

	// Windshield (front of cabin, sloped)
	const windshield = new THREE.Mesh(
		new THREE.BoxGeometry( CABIN_WIDTH * 0.96, CABIN_HEIGHT * 0.85, 0.04 ),
		windowMat,
	);
	windshield.position.set( 0, CABIN_Y + 0.01, CABIN_Z + CABIN_LENGTH / 2 + 0.01 );
	windshield.rotation.x = 0.32;
	bodyGroup.add( windshield );

	// Rear window (matches fastback slope)
	const rearWin = new THREE.Mesh(
		new THREE.BoxGeometry( CABIN_WIDTH * 0.94, FASTBACK_HEIGHT * 1.05, 0.04 ),
		windowMat,
	);
	rearWin.position.set( 0, CABIN_Y - FASTBACK_HEIGHT * 0.12, CABIN_Z - CABIN_LENGTH / 2 - FASTBACK_LENGTH / 2 + 0.01 );
	rearWin.rotation.x = - 0.36;
	bodyGroup.add( rearWin );

	// Side windows
	const sideWinGeom = new THREE.BoxGeometry( 0.04, CABIN_HEIGHT * 0.62, CABIN_LENGTH * 0.85 );
	for ( const xSign of [ - 1, 1 ] ) {

		const sideWin = new THREE.Mesh( sideWinGeom, windowMat );
		sideWin.position.set( xSign * ( CABIN_WIDTH / 2 + 0.005 ), CABIN_Y + 0.02, CABIN_Z );
		bodyGroup.add( sideWin );

	}

	// Headlights (recessed slightly with a black surround box)
	for ( const xSign of [ - 1, 1 ] ) {

		const surround = new THREE.Mesh(
			new THREE.BoxGeometry( HEADLIGHT_W + 0.04, HEADLIGHT_H + 0.04, 0.06 ),
			accentMat,
		);
		surround.position.set( xSign * 0.28, UPPER_Y, BODY_LENGTH / 2 + 0.015 );
		bodyGroup.add( surround );

		const hl = new THREE.Mesh(
			new THREE.BoxGeometry( HEADLIGHT_W, HEADLIGHT_H, 0.08 ),
			headlightMat,
		);
		hl.position.set( xSign * 0.28, UPPER_Y, BODY_LENGTH / 2 + 0.04 );
		bodyGroup.add( hl );

	}

	// Taillights (red, wider)
	for ( const xSign of [ - 1, 1 ] ) {

		const tl = new THREE.Mesh(
			new THREE.BoxGeometry( TAILLIGHT_W, TAILLIGHT_H, 0.06 ),
			taillightMat,
		);
		tl.position.set( xSign * 0.24, UPPER_Y, - BODY_LENGTH / 2 - 0.04 );
		bodyGroup.add( tl );

	}

	// Front + rear bumpers (black band wrapping)
	addBox(
		bodyGroup, BODY_WIDTH * 1.03, BUMPER_H, BUMPER_L, accentMat,
		0, BODY_BASE_Y + BUMPER_H / 2, BODY_LENGTH / 2 + BUMPER_L / 2,
	);
	addBox(
		bodyGroup, BODY_WIDTH * 1.03, BUMPER_H, BUMPER_L, accentMat,
		0, BODY_BASE_Y + BUMPER_H / 2, - BODY_LENGTH / 2 - BUMPER_L / 2,
	);

	// Side mirrors
	for ( const xSign of [ - 1, 1 ] ) {

		const mirror = new THREE.Mesh(
			new THREE.BoxGeometry( MIRROR_W, MIRROR_H, MIRROR_L ),
			mirrorMat,
		);
		mirror.position.set(
			xSign * ( CABIN_WIDTH / 2 + MIRROR_W / 2 + 0.005 ),
			CABIN_Y - CABIN_HEIGHT * 0.12,
			CABIN_Z + CABIN_LENGTH / 2 - MIRROR_L / 2,
		);
		bodyGroup.add( mirror );

	}

	root.add( bodyGroup );

	// Wheels with rim recess
	const tireGeom = new THREE.CylinderGeometry( WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 18 );
	tireGeom.rotateZ( Math.PI / 2 );

	const rimFaceGeom = new THREE.CylinderGeometry( WHEEL_RADIUS * 0.72, WHEEL_RADIUS * 0.72, WHEEL_WIDTH * 1.03, 14 );
	rimFaceGeom.rotateZ( Math.PI / 2 );

	const rimRecessGeom = new THREE.CylinderGeometry( WHEEL_RADIUS * 0.5, WHEEL_RADIUS * 0.5, WHEEL_WIDTH * 1.04, 12 );
	rimRecessGeom.rotateZ( Math.PI / 2 );

	const tireMat = new THREE.MeshLambertMaterial( { color: WHEEL_COLOR } );
	const rimMat = new THREE.MeshLambertMaterial( { color: RIM_COLOR } );
	const rimDarkMat = new THREE.MeshLambertMaterial( { color: RIM_DARK } );

	const wheelX = BODY_WIDTH / 2 + WHEEL_WIDTH / 2 - WHEEL_INSET;
	const wheelZFront = BODY_LENGTH / 2 - 0.55;
	const wheelZBack = - ( BODY_LENGTH / 2 - 0.45 );

	const wheelDefs = [
		{ name: 'wheel-front-left',  x: - wheelX, z: wheelZFront },
		{ name: 'wheel-front-right', x:   wheelX, z: wheelZFront },
		{ name: 'wheel-back-left',   x: - wheelX, z: wheelZBack },
		{ name: 'wheel-back-right',  x:   wheelX, z: wheelZBack },
	];

	for ( const def of wheelDefs ) {

		const wheel = new THREE.Mesh( tireGeom, tireMat );
		wheel.name = def.name;
		wheel.position.set( def.x, WHEEL_RADIUS, def.z );
		wheel.castShadow = true;

		const rim = new THREE.Mesh( rimFaceGeom, rimMat );
		wheel.add( rim );

		const recess = new THREE.Mesh( rimRecessGeom, rimDarkMat );
		wheel.add( recess );

		root.add( wheel );

	}

	return root;

}
