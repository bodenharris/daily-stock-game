/**
 * The two Svelte transitions for the moments that matter, on M3 Expressive springs:
 *
 *   <span in:pop>+12%</span>                       scale up from 0.8 and fade in
 *   <div in:rise={{ delay: 100 }}>…</div>         slide up 16px and fade in
 *
 * Svelte transitions want JS, not the CSS linear() curves in layout.css, so these sample the
 * same damped springs. Spatial springs (scale, position) overshoot a little; effects springs
 * (opacity) never do. Under reduced motion only the fade is left.
 */
import { prefersReducedMotion } from 'svelte/motion';
import type { TransitionConfig } from 'svelte/transition';

/** Damping ratio, stiffness (mass 1) and the time it takes to settle. */
type Spring = { damping: number; stiffness: number; ms: number };

const FAST_SPATIAL: Spring = { damping: 0.6, stiffness: 800, ms: 359 };
const DEFAULT_SPATIAL: Spring = { damping: 0.8, stiffness: 380, ms: 435 };
const FAST_EFFECTS: Spring = { damping: 1, stiffness: 3800, ms: 150 };
const DEFAULT_EFFECTS: Spring = { damping: 1, stiffness: 1600, ms: 231 };

/** How far a spring released at 0 has travelled towards 1 after `ms`. */
function progress({ damping: z, stiffness, ms: settle }: Spring, ms: number) {
	if (ms >= settle) return 1;
	const t = ms / 1000;
	const w0 = Math.sqrt(stiffness);
	if (z === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
	const wd = w0 * Math.sqrt(1 - z * z);
	return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
}

function spring(
	move: Spring,
	fade: Spring,
	delay: number,
	style: (p: number) => string
): TransitionConfig {
	const reduced = prefersReducedMotion.current;
	const duration = reduced ? fade.ms : Math.max(move.ms, fade.ms);
	return {
		delay,
		duration,
		css: (t) => {
			const ms = t * duration;
			const opacity = `opacity: ${progress(fade, ms)}`;
			return reduced ? opacity : `${opacity}; ${style(progress(move, ms))}`;
		}
	};
}

/** For the result chip and the verdict card. `start` is the scale it grows from. */
export function pop(_node: Element, { start = 0.8, delay = 0 } = {}): TransitionConfig {
	return spring(FAST_SPATIAL, FAST_EFFECTS, delay, (p) => `scale: ${start + (1 - start) * p}`);
}

/** For content that builds up in beats, like the unmasking. */
export function rise(_node: Element, { delay = 0 } = {}): TransitionConfig {
	return spring(DEFAULT_SPATIAL, DEFAULT_EFFECTS, delay, (p) => `translate: 0 ${(1 - p) * 16}px`);
}
