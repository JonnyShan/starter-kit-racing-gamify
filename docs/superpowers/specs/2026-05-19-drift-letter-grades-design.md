# Drift Letter Grades — Design

**Date:** 2026-05-19
**Scope:** Add S/A/B/C/D letter grade above the points number on the drift-finalize banner.

## Problem

Banner currently shows raw `{N} POINTS!`. Players don't know if 1247 is good or amateur. Letter grades give instant feedback and a target to chase.

## Non-goals

- Per-corner grade
- Multi-grade rank (gold A+, A, A-)
- Letter persistence / best-grade-ever
- Sound effect per grade

## Design

### Grade table (top of `js/DriftScore.js`)

```javascript
const GRADES = [
	{ score: 5000, letter: 'S', color: '#ff6ec7' },
	{ score: 2500, letter: 'A', color: '#ffd84a' },
	{ score: 1000, letter: 'B', color: '#67e0ff' },
	{ score: 500,  letter: 'C', color: '#a3ff8b' },
	{ score: 0,    letter: 'D', color: '#cccccc' },
];
```

Sorted high-to-low. Helper:

```javascript
function gradeFor( score ) {
	for ( const g of GRADES ) if ( score >= g.score ) return g;
	return GRADES[ GRADES.length - 1 ];
}
```

### Banner DOM change

Current banner: single `<div id="drift-banner">{N} POINTS!</div>`.

New: two stacked rows inside the same banner.

```html
<div id="drift-banner">
	<div class="letter">S</div>
	<div class="points">1234 POINTS</div>
</div>
```

### CSS update

Replace the existing `#drift-banner` block in `_buildUI` CSS. Letter is dominant (huge, colored per grade), points line is smaller below.

```css
#drift-banner {
	/* position/transform/transition unchanged */
	font-family: -apple-system, BlinkMacSystemFont, sans-serif;
	text-align: center;
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
```

The letter uses `currentColor` for its glow; that color is set inline per-grade.

### _showBanner rewrite

```javascript
_showBanner( score ) {

	const grade = gradeFor( score );

	this.bannerEl.innerHTML =
		`<div class="letter" style="color: ${ grade.color }">${ grade.letter }</div>` +
		`<div class="points">${ Math.floor( score ) } POINTS</div>`;
	this.bannerEl.classList.add( 'show' );
	this.bannerTimer = BANNER_DURATION_SECONDS;

}
```

### Banner build

In `_buildUI`, the banner is currently created as an empty `<div id="drift-banner"></div>`. No change needed — content is set imperatively in `_showBanner`.

## Files touched

- Modify: `js/DriftScore.js` only — add `GRADES`, `gradeFor`, CSS update, `_showBanner` rewrite.

## Acceptance criteria

1. ☐ Run a tiny chain (~100 points) → banner shows giant grey **D** above `100 POINTS`.
2. ☐ Score ≥ 500 → **C** in light green.
3. ☐ Score ≥ 1000 → **B** in cyan.
4. ☐ Score ≥ 2500 → **A** in yellow.
5. ☐ Score ≥ 5000 → **S** in pink.
6. ☐ Banner still fades out after 1.5 s.
7. ☐ FPS 60.
8. ☐ All other features unchanged.

## Tuning

- Threshold scores wrong → adjust the `GRADES` array.
- Letter too big/small → `font: 900 96px` size.
- Glow too soft → bump second text-shadow opacity.

## Out of scope

- Grade-specific sounds
- Best-grade persistence
- Per-corner grading
