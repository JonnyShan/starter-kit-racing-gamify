const DRIFT_THRESHOLD = 0.3;
const SCORE_SCALE = 100;
const CHAIN_GRACE_SECONDS = 1.5;
const CRASH_SPEED_DROP_RATIO = 0.3;
const BANNER_DURATION_SECONDS = 1.5;
const MIN_CHAIN_SCORE_TO_SAVE = 50;
const DONUT_ANGLE = Math.PI * 2;
const DONUT_TOAST_SECONDS = 1.2;
const STORAGE_PREFIX = 'racing.driftScore.';

const STATE_IDLE = 0;
const STATE_DRIFTING = 1;
const STATE_GRACE = 2;

const GRADES = [
	{ score: 5000, letter: 'S', color: '#ff6ec7' },
	{ score: 2500, letter: 'A', color: '#ffd84a' },
	{ score: 1000, letter: 'B', color: '#67e0ff' },
	{ score: 500,  letter: 'C', color: '#a3ff8b' },
	{ score: 0,    letter: 'D', color: '#cccccc' },
];

function gradeFor( score ) {

	for ( const g of GRADES ) if ( score >= g.score ) return g;
	return GRADES[ GRADES.length - 1 ];

}

export class DriftScore {

	constructor( trackId ) {

		this.storageKey = STORAGE_PREFIX + ( trackId || 'default' );

		this.state = STATE_IDLE;
		this.liveScore = 0;
		this.chainScore = 0;
		this.chainMult = 1;
		this.graceTimer = 0;
		this.bannerTimer = 0;
		this.prevSpeed = 0;
		this.driftYawAccum = 0;
		this.donutToastTimer = 0;
		this.bestScore = this._loadBest();

		this._buildUI();

	}

	_buildUI() {

		const style = document.createElement( 'style' );
		style.textContent = `
			#drift-score {
				position: absolute;
				top: 80px;
				left: 50%;
				transform: translateX(-50%);
				color: #fff;
				font: 600 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
				text-align: center;
				background: rgba(0,0,0,0.4);
				padding: 6px 14px;
				border-radius: 8px;
				pointer-events: none;
				z-index: 10;
				letter-spacing: 0.04em;
				backdrop-filter: blur(8px);
				-webkit-backdrop-filter: blur(8px);
				user-select: none;
			}
			#drift-score .chain { opacity: 0; letter-spacing: 0.1em; height: 14px; transition: opacity 0.2s; }
			#drift-score.chaining .chain { opacity: 1; }
			#drift-score .score {
				font: 700 22px/1.1 -apple-system, BlinkMacSystemFont, sans-serif;
				font-variant-numeric: tabular-nums;
				color: #ffd84a;
				text-shadow: 0 0 6px rgba(255,216,74,0.5);
				margin: 2px 0;
			}
			#drift-score.idle .score { color: #888; text-shadow: none; }
			#drift-score .best { opacity: 0.6; font-size: 10px; letter-spacing: 0.08em; }
			#drift-score .donut {
				font: 800 14px/1 -apple-system, BlinkMacSystemFont, sans-serif;
				color: #ff6ec7;
				text-shadow: 0 0 8px rgba(255, 110, 199, 0.7);
				letter-spacing: 0.12em;
				margin-top: 2px;
				opacity: 0;
				transition: opacity 0.3s;
			}
			#drift-score .donut.show { opacity: 1; }
			#drift-banner {
				position: absolute;
				top: 50%;
				left: 50%;
				transform: translate(-50%, -50%);
				font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
				text-align: center;
				pointer-events: none;
				z-index: 11;
				opacity: 0;
				transition: opacity 0.3s, transform 0.3s;
				user-select: none;
			}
			#drift-banner .letter {
				font: 900 96px/1 -apple-system, BlinkMacSystemFont, sans-serif;
				text-shadow: 0 0 24px currentColor, 0 4px 16px rgba(0,0,0,0.7);
				letter-spacing: -0.02em;
			}
			#drift-banner .points {
				font: 700 24px/1 -apple-system, BlinkMacSystemFont, sans-serif;
				font-variant-numeric: tabular-nums;
				color: #fff;
				text-shadow: 0 2px 8px rgba(0,0,0,0.7);
				margin-top: 4px;
				letter-spacing: 0.08em;
			}
			#drift-banner.show { opacity: 1; transform: translate(-50%, -60%); }
		`;
		document.head.appendChild( style );

		const panel = document.createElement( 'div' );
		panel.id = 'drift-score';
		panel.classList.add( 'idle' );
		panel.innerHTML =
			'<div class="chain">CHAIN x1</div>' +
			'<div class="score">0</div>' +
			`<div class="best">BEST ${ Math.floor( this.bestScore ) }</div>` +
			'<div class="donut">DONUT!</div>';
		document.body.appendChild( panel );

		const banner = document.createElement( 'div' );
		banner.id = 'drift-banner';
		document.body.appendChild( banner );

		this.panelEl = panel;
		this.chainEl = panel.querySelector( '.chain' );
		this.scoreEl = panel.querySelector( '.score' );
		this.bestEl = panel.querySelector( '.best' );
		this.donutEl = panel.querySelector( '.donut' );
		this.bannerEl = banner;

	}

	_loadBest() {

		try {
			const v = localStorage.getItem( this.storageKey );
			const n = v !== null ? Number( v ) : 0;
			return Number.isFinite( n ) ? n : 0;
		} catch {
			return 0;
		}

	}

	_saveBest() {

		try {
			localStorage.setItem( this.storageKey, String( Math.floor( this.bestScore ) ) );
		} catch {}

	}

	update( dt, vehicle ) {

		const speed = Math.abs( vehicle.linearSpeed );
		const intensity = vehicle.driftIntensity;
		const isDrifting = intensity > DRIFT_THRESHOLD;

		const speedDropped = this.prevSpeed > 0.3 && speed < this.prevSpeed * CRASH_SPEED_DROP_RATIO;
		if ( speedDropped && this.state !== STATE_IDLE ) {

			this.liveScore = 0;
			this.chainScore = 0;
			this.chainMult = 1;
			this.driftYawAccum = 0;
			this.state = STATE_IDLE;

		}

		if ( this.state === STATE_IDLE ) {

			if ( isDrifting ) this.state = STATE_DRIFTING;

		} else if ( this.state === STATE_DRIFTING ) {

			const slipAbs = Math.abs( Math.atan2( vehicle.lateralSpeed, vehicle.linearSpeed ) );
			this.liveScore += slipAbs * speed * dt * SCORE_SCALE;

			this.driftYawAccum += vehicle.angularSpeed * dt;
			if ( Math.abs( this.driftYawAccum ) >= DONUT_ANGLE ) {

				this.chainMult += 1;
				this._showDonutToast();
				this.driftYawAccum = 0;

			}

			if ( ! isDrifting ) {

				this.chainScore += this.liveScore * this.chainMult;
				this.chainMult += 1;
				this.liveScore = 0;
				this.graceTimer = 0;
				this.driftYawAccum = 0;
				this.state = STATE_GRACE;

			}

		} else if ( this.state === STATE_GRACE ) {

			this.graceTimer += dt;

			if ( isDrifting ) {

				this.state = STATE_DRIFTING;

			} else if ( this.graceTimer >= CHAIN_GRACE_SECONDS ) {

				this._finalizeChain();
				this.state = STATE_IDLE;

			}

		}

		this._render( dt );
		this.prevSpeed = speed;

	}

	_finalizeChain() {

		const final = this.chainScore;
		if ( final >= MIN_CHAIN_SCORE_TO_SAVE && final > this.bestScore ) {

			this.bestScore = final;
			this._saveBest();

		}
		if ( final >= MIN_CHAIN_SCORE_TO_SAVE ) {

			this._showBanner( final );

		}
		this.chainScore = 0;
		this.liveScore = 0;
		this.chainMult = 1;
		this.driftYawAccum = 0;

	}

	_showDonutToast() {

		this.donutEl.classList.add( 'show' );
		this.donutToastTimer = DONUT_TOAST_SECONDS;

	}

	_showBanner( score ) {

		const grade = gradeFor( score );

		this.bannerEl.innerHTML =
			`<div class="letter" style="color: ${ grade.color }">${ grade.letter }</div>` +
			`<div class="points">${ Math.floor( score ) } POINTS</div>`;
		this.bannerEl.classList.add( 'show' );
		this.bannerTimer = BANNER_DURATION_SECONDS;

	}

	_render( dt ) {

		const total = Math.floor( this.liveScore + this.chainScore );
		this.scoreEl.textContent = total;

		if ( this.state === STATE_IDLE ) {

			this.panelEl.classList.add( 'idle' );
			this.panelEl.classList.remove( 'chaining' );

		} else {

			this.panelEl.classList.remove( 'idle' );
			if ( this.chainMult > 1 ) {

				this.chainEl.textContent = `CHAIN x${ this.chainMult }`;
				this.panelEl.classList.add( 'chaining' );

			} else {

				this.panelEl.classList.remove( 'chaining' );

			}

		}

		this.bestEl.textContent = `BEST ${ Math.floor( this.bestScore ) }`;

		if ( this.bannerTimer > 0 ) {

			this.bannerTimer -= dt;
			if ( this.bannerTimer <= 0 ) this.bannerEl.classList.remove( 'show' );

		}

		if ( this.donutToastTimer > 0 ) {

			this.donutToastTimer -= dt;
			if ( this.donutToastTimer <= 0 ) this.donutEl.classList.remove( 'show' );

		}

	}

	dispose() {

		if ( this.panelEl ) this.panelEl.remove();
		if ( this.bannerEl ) this.bannerEl.remove();
		this.panelEl = null;
		this.bannerEl = null;

	}

}
