/**
 * M3 Expressive springs as Svelte transitions.
 *
 * CSS `linear()` easings (layout.css) can't be handed to Svelte transitions, which want a JS
 * easing function. These sample the same analytic springs as `motion.ts`, so `transition:` /
 * `in:` / `out:` move exactly like the CSS utilities.
 *
 *   <div in:pop>…</div>                                   // result chip: scale 0.8 → 1 + fade
 *   <div in:rise={{ y: 24 }} out:fade={springParams('fast-effects')}>…</div>
 *   <div transition:fly={{ y: 16, ...springParams('default-spatial') }}>…</div>
 *
 * Rules (M3): spatial springs (position, size, scale) may overshoot; effects springs (opacity,
 * color) never do. Fast = small parts, default = partial screen, slow = full screen.
 * Under `prefers-reduced-motion` spatial movement is dropped; fades remain.
 */
import { prefersReducedMotion } from 'svelte/motion';
import type { EasingFunction, TransitionConfig } from 'svelte/transition';
import { SPRINGS, springValue, type SpringToken } from './motion.js';

const spec = (token: SpringToken) => SPRINGS.expressive[token];

/** The spring's normalized step response as an easing function (may exceed 1 for spatial springs). */
export function springEasing(token: SpringToken): EasingFunction {
	const s = spec(token);
	const seconds = s.durationMs / 1000;
	return (t) => (t >= 1 ? 1 : t <= 0 ? 0 : springValue(t * seconds, s));
}

/** `{ duration, easing }` for Svelte's built-in transitions (`fly`, `scale`, `slide`, `fade`, …). */
export function springParams(token: SpringToken): { duration: number; easing: EasingFunction } {
	const reduced = prefersReducedMotion.current && token.endsWith('spatial');
	return { duration: reduced ? 0 : spec(token).durationMs, easing: springEasing(token) };
}

interface PopParams {
	/** Starting scale. Default 0.8 (M3 snackbar / dialog enter). */
	start?: number;
	/** Spatial spring for the scale. Default `fast-spatial` (bouncy). */
	spring?: SpringToken;
	delay?: number;
}

/**
 * Scale up from `start` on a spatial spring while fading in on fast-effects.
 * For the moments that matter: the +$12 / −$8 result, the reveal card, a streak badge.
 */
export function pop(
	_node: Element,
	{ start = 0.8, spring = 'fast-spatial', delay = 0 }: PopParams = {}
): TransitionConfig {
	const scale = spec(spring);
	const fade = spec('fast-effects');
	const duration = Math.max(scale.durationMs, fade.durationMs);
	const reduced = prefersReducedMotion.current;
	return {
		delay,
		duration: reduced ? fade.durationMs : duration,
		css: (t) => {
			const ms = t * (reduced ? fade.durationMs : duration);
			const o = ms >= fade.durationMs ? 1 : springValue(ms / 1000, fade);
			if (reduced) return `opacity: ${o}`;
			const p = ms >= scale.durationMs ? 1 : springValue(ms / 1000, scale);
			return `opacity: ${o}; scale: ${start + (1 - start) * p}`;
		}
	};
}

interface RiseParams {
	/** Distance in px to travel upward. Default 16. */
	y?: number;
	/** Spatial spring for the movement. Default `default-spatial`. */
	spring?: SpringToken;
	delay?: number;
}

/** Slide up `y` px on a spatial spring + fade on default-effects. Good for staggered card content. */
export function rise(
	_node: Element,
	{ y = 16, spring = 'default-spatial', delay = 0 }: RiseParams = {}
): TransitionConfig {
	const move = spec(spring);
	const fade = spec('default-effects');
	const duration = Math.max(move.durationMs, fade.durationMs);
	const reduced = prefersReducedMotion.current;
	return {
		delay,
		duration: reduced ? fade.durationMs : duration,
		css: (t) => {
			const ms = t * (reduced ? fade.durationMs : duration);
			const o = ms >= fade.durationMs ? 1 : springValue(ms / 1000, fade);
			if (reduced) return `opacity: ${o}`;
			const p = ms >= move.durationMs ? 1 : springValue(ms / 1000, move);
			return `opacity: ${o}; translate: 0 ${(1 - p) * y}px`;
		}
	};
}
