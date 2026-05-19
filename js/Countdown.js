const STAGES = [
	{ text: '3',   duration: 1.0, color: '#ffffff' },
	{ text: '2',   duration: 1.0, color: '#ffd84a' },
	{ text: '1',   duration: 1.0, color: '#ff8c4a' },
	{ text: 'GO!', duration: 0.6, color: '#5af168' },
];

const FADE_OUT_MS = 300;

export class Countdown {

	constructor() {

		this.phase = 0;
		this.phaseTimer = 0;
		this.done = false;

		const style = document.createElement( 'style' );
		style.textContent = `
			#countdown {
				position: fixed;
				top: 50%;
				left: 50%;
				transform: translate(-50%, -50%) scale(1);
				color: #ffffff;
				font: 900 220px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
				text-shadow: 0 0 40px currentColor, 0 8px 24px rgba(0,0,0,0.8);
				pointer-events: none;
				z-index: 20;
				user-select: none;
				letter-spacing: -0.02em;
				transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s;
				will-change: transform, opacity;
			}
		`;
		document.head.appendChild( style );

		const el = document.createElement( 'div' );
		el.id = 'countdown';
		el.textContent = STAGES[ 0 ].text;
		el.style.color = STAGES[ 0 ].color;
		document.body.appendChild( el );
		this.el = el;

		this._pop();

	}

	_pop() {

		if ( ! this.el ) return;
		this.el.style.transform = 'translate(-50%, -50%) scale(1.3)';
		requestAnimationFrame( () => {
			if ( this.el ) this.el.style.transform = 'translate(-50%, -50%) scale(1)';
		} );

	}

	update( dt ) {

		if ( this.done || ! this.el ) return;

		this.phaseTimer += dt;
		const current = STAGES[ this.phase ];

		if ( this.phaseTimer >= current.duration ) {

			this.phase += 1;
			this.phaseTimer = 0;

			if ( this.phase >= STAGES.length ) {

				this.done = true;
				this.el.style.opacity = '0';
				setTimeout( () => {
					if ( this.el ) {
						this.el.remove();
						this.el = null;
					}
				}, FADE_OUT_MS + 100 );
				return;

			}

			const next = STAGES[ this.phase ];
			this.el.textContent = next.text;
			this.el.style.color = next.color;
			this._pop();

		}

	}

	dispose() {

		if ( this.el ) {

			this.el.remove();
			this.el = null;

		}

	}

}
