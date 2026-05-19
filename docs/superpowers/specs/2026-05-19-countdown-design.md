# 3-2-1-GO Countdown — Design

**Date:** 2026-05-19
**Scope:** Big centered "3", "2", "1", "GO!" sequence on game load. Pure visual; does not gate input. Auto-disappears.

## Problem

Game cold-starts with no signal that the lap clock will begin on first input. Adds no friction but feels less arcade-y than the genre expects. A short countdown sets the mood.

## Non-goals

- Gate input until GO (lap-timer already starts on first input regardless — keep it that way)
- Countdown sound effects
- Skip-button
- Per-track reset countdown (only on initial load)
- Persisted "skip intro" preference

## Design

### Module `js/Countdown.js`

```javascript
new Countdown()
update( dt )
dispose()
```

Constructor:
- Builds a fixed-position centered DOM element.
- Sets initial content "3" and visible.
- Internal state: `phase = 0` (index into stages array), `phaseTimer = 0`.

```javascript
const STAGES = [
	{ text: '3',  duration: 1.0, color: '#ffffff' },
	{ text: '2',  duration: 1.0, color: '#ffd84a' },
	{ text: '1',  duration: 1.0, color: '#ff8c4a' },
	{ text: 'GO!', duration: 0.6, color: '#5af168' },
];
```

`update(dt)`:
- If `this.done` → return early.
- `this.phaseTimer += dt`.
- If `phaseTimer >= STAGES[phase].duration`:
  - Advance phase, reset timer.
  - If phase >= STAGES.length → set `done = true`, fade out, remove DOM.
  - Else update text + color.

### DOM

```html
<div id="countdown">3</div>
```

CSS:
```css
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
#countdown.pop {
	transform: translate(-50%, -50%) scale(1.3);
}
```

Each stage change triggers a `.pop` class toggle for a beat-pop animation.

JS to trigger pop: when phase advances, add `.pop`, then `setTimeout(0, removeClass)` or `requestAnimationFrame` next-tick to re-trigger the transform animation back to scale(1).

Simpler: alternate classes each phase, since CSS transitions automatically tween between states.

```javascript
this.el.style.transform = 'translate(-50%, -50%) scale(1.3)';
requestAnimationFrame( () => {
	this.el.style.transform = 'translate(-50%, -50%) scale(1)';
} );
```

### Final fade-out

After GO phase ends, animate opacity 1→0 over 0.3 s then remove from DOM:

```javascript
this.el.style.opacity = '0';
setTimeout( () => this.el?.remove(), 400 );
```

### Wiring

In main.js, near other UI instantiations (after Petals/DayNight/Stars):

```javascript
const countdown = new Countdown();
```

In render loop:

```javascript
countdown.update( dt );
```

## Files touched

**Created:**
- `js/Countdown.js` (~90 LOC)

**Modified:**
- `js/main.js` — import + instantiate + drive. ~3 LOC.

## Acceptance criteria

1. ☐ Page loads → big "3" appears centered, white.
2. ☐ 1 second later → "2" yellow with a pop.
3. ☐ Next second → "1" orange pop.
4. ☐ Next → "GO!" green pop.
5. ☐ ~0.6 s later → fades out, disappears.
6. ☐ Player can drive at any point during the countdown (no gating).
7. ☐ Refresh page → countdown plays again.
8. ☐ FPS still 60.
9. ☐ All other features unchanged.

## Tuning

- Too fast → bump `STAGES[*].duration` 1.0→1.5.
- Numbers too big → drop `font: 900 220px` to 160px.
- Pop too aggressive → drop `scale(1.3)` to `scale(1.15)`.
- Color choices feel off → tweak each stage's `color`.

## Out of scope

- Sound effects
- Skip key
- Re-countdown on respawn
- "Lights" animation (F1 style)
- Network/multiplayer sync
