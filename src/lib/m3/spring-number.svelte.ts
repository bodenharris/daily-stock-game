import { SPRINGS, animateSpring, type SpringToken } from './motion.js';

/**
 * A number that springs to its target, frame-rate independent and interruptible (velocity is kept
 * when the target changes mid-flight). For the balance counting up / down after a call.
 *
 *   const shown = new SpringNumber(100);
 *   shown.target = 112;            // animates; read `shown.current` in the template
 *   <span class="type-numeric">{fmt(shown.current)}</span>
 *
 * Defaults to `slow-effects` (critically damped: no overshoot, money never counts past its value).
 * Pass a spatial token for things that may bounce (a bar's height, a marker's position).
 * Under `prefers-reduced-motion` it jumps straight to the target.
 */
export class SpringNumber {
	current = $state(0);
	#target = 0;
	#velocity = 0;
	#cancel: (() => void) | undefined;
	#token: SpringToken;

	constructor(value = 0, token: SpringToken = 'slow-effects') {
		this.current = value;
		this.#target = value;
		this.#token = token;
	}

	get target() {
		return this.#target;
	}

	set target(value: number) {
		if (value === this.#target) return;
		this.#target = value;
		this.#cancel?.();
		this.#cancel = animateSpring(
			this.current,
			value,
			SPRINGS.expressive[this.#token],
			(v, dv) => {
				this.current = v;
				this.#velocity = dv;
			},
			{ velocity: this.#velocity, onComplete: () => (this.#velocity = 0) }
		);
	}

	/** Jump without animating. */
	set(value: number) {
		this.#cancel?.();
		this.#target = value;
		this.#velocity = 0;
		this.current = value;
	}
}
