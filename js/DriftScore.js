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
