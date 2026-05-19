const SPEED_LINE_COUNT = 24;
const SPEED_LINE_INNER = 25;
const SPEED_LINE_OUTER = 110;
const SPEED_LINE_WIDTH = 0.7;
const SPEED_LINE_COLOR = '#ffffff';
const SPEED_THRESHOLD = 0.5;
const DRIFT_THRESHOLD = 0.4;
const MAX_OPACITY = 0.6;
const MAX_SPEED_REF = 1.5;
const DRIFT_MAX_REF = 2.0;
const LERP_RATE = 8;

const SVG_NS = 'http://www.w3.org/2000/svg';

export class SpeedLines {

	constructor( vehicle ) {

		this.vehicle = vehicle;
		this.currentOpacity = 0;

		const svg = document.createElementNS( SVG_NS, 'svg' );
		svg.setAttribute( 'width', '100%' );
		svg.setAttribute( 'height', '100%' );
		svg.setAttribute( 'viewBox', '0 0 100 100' );
		svg.setAttribute( 'preserveAspectRatio', 'none' );
		svg.style.position = 'fixed';
		svg.style.inset = '0';
		svg.style.pointerEvents = 'none';
		svg.style.zIndex = '5';
		svg.style.opacity = '0';
		svg.style.mixBlendMode = 'screen';

		for ( let i = 0; i < SPEED_LINE_COUNT; i ++ ) {

			const angle = ( i / SPEED_LINE_COUNT ) * Math.PI * 2;
			const x1 = 50 + Math.cos( angle ) * SPEED_LINE_INNER;
			const y1 = 50 + Math.sin( angle ) * SPEED_LINE_INNER;
			const x2 = 50 + Math.cos( angle ) * SPEED_LINE_OUTER;
			const y2 = 50 + Math.sin( angle ) * SPEED_LINE_OUTER;

			const line = document.createElementNS( SVG_NS, 'line' );
			line.setAttribute( 'x1', x1 );
			line.setAttribute( 'y1', y1 );
			line.setAttribute( 'x2', x2 );
			line.setAttribute( 'y2', y2 );
			line.setAttribute( 'stroke', SPEED_LINE_COLOR );
			line.setAttribute( 'stroke-width', SPEED_LINE_WIDTH );
			line.setAttribute( 'stroke-linecap', 'round' );
			svg.appendChild( line );

		}

		document.body.appendChild( svg );
		this.svg = svg;

	}

	update( dt ) {

		const speedFrac = Math.min( Math.abs( this.vehicle.linearSpeed ) / MAX_SPEED_REF, 1 );
		const driftFrac = Math.min( this.vehicle.driftIntensity / DRIFT_MAX_REF, 1 );
		const active = speedFrac > SPEED_THRESHOLD && driftFrac > DRIFT_THRESHOLD;

		const target = active ? driftFrac * speedFrac * MAX_OPACITY : 0;
		this.currentOpacity += ( target - this.currentOpacity ) * Math.min( dt * LERP_RATE, 1 );
		this.svg.style.opacity = this.currentOpacity;

	}

	dispose() {

		if ( this.svg ) {

			this.svg.remove();
			this.svg = null;

		}

	}

}
