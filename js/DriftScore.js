const DRIFT_THRESHOLD = 0.3;
const SCORE_SCALE = 100;
const CHAIN_GRACE_SECONDS = 1.5;
const CRASH_SPEED_DROP_RATIO = 0.3;
const BANNER_DURATION_SECONDS = 1.5;
const MIN_CHAIN_SCORE_TO_SAVE = 50;
const STORAGE_PREFIX = 'racing.driftScore.';

const STATE_IDLE = 0;
const STATE_DRIFTING = 1;
const STATE_GRACE = 2;

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
			#drift-banner {
				position: absolute;
				top: 50%;
				left: 50%;
				transform: translate(-50%, -50%);
				color: #ffd84a;
				font: 800 56px/1 -apple-system, BlinkMacSystemFont, sans-serif;
				font-variant-numeric: tabular-nums;
				text-shadow: 0 0 16px rgba(255,216,74,0.7), 0 4px 12px rgba(0,0,0,0.7);
				pointer-events: none;
				z-index: 11;
				opacity: 0;
				transition: opacity 0.3s, transform 0.3s;
				user-select: none;
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
			`<div class="best">BEST ${ Math.floor( this.bestScore ) }</div>`;
		document.body.appendChild( panel );

		const banner = document.createElement( 'div' );
		banner.id = 'drift-banner';
		document.body.appendChild( banner );

		this.panelEl = panel;
		this.chainEl = panel.querySelector( '.chain' );
		this.scoreEl = panel.querySelector( '.score' );
		this.bestEl = panel.querySelector( '.best' );
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
	}

	dispose() {
	}

}
