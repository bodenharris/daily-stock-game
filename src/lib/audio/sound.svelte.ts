import { DEFAULT_PREFS, PREFS_KEY, parsePrefs } from './prefs.ts';

/**
 * The game's sound: short 8-bit effects and an optional night ambience (wind, crickets, a far
 * off city hum), all synthesized with the Web Audio API, so there are no files to load or
 * license. Nothing makes a sound until the player has tapped or pressed a key (browsers block
 * audio before that), and the game never waits on audio: every call here is fire and forget,
 * and does nothing where Web Audio is missing.
 *
 * One board per browser tab. It is a module singleton rather than context because it only
 * ever changes in the browser (`load` and the setters run from effects and event handlers),
 * so nothing leaks between requests on the server, which only reads the defaults.
 */
export type Sfx =
	'tap' | 'select' | 'call-up' | 'call-down' | 'right' | 'wrong' | 'finale' | 'bark';

/** Bus levels: effects sit under the UI, the ambience well under the effects. */
const EFFECTS_GAIN = 0.32;
const AMBIENCE_GAIN = 0.5;

type Wave = OscillatorType;
type Blip = {
	wave?: Wave;
	from: number;
	to?: number;
	at?: number;
	dur: number;
	gain?: number;
};

class SoundBoard {
	effects = $state(DEFAULT_PREFS.effects);
	ambience = $state(DEFAULT_PREFS.ambience);

	#ctx: AudioContext | null = null;
	#fx: GainNode | null = null;
	#amb: { bus: GainNode; stop: () => void } | null = null;
	#unlocked = false;

	/** Reads the saved settings. Call once in the browser. */
	load() {
		try {
			const prefs = parsePrefs(localStorage.getItem(PREFS_KEY));
			this.effects = prefs.effects;
			this.ambience = prefs.ambience;
		} catch {
			// Storage blocked: keep the defaults for this visit.
		}
	}

	#save() {
		try {
			localStorage.setItem(
				PREFS_KEY,
				JSON.stringify({ effects: this.effects, ambience: this.ambience })
			);
		} catch {
			// Storage blocked: the choice lasts for this visit only.
		}
	}

	setEffects(on: boolean) {
		this.effects = on;
		this.#save();
	}

	setAmbience(on: boolean) {
		this.ambience = on;
		this.#save();
		if (on) this.#startAmbience();
		else this.#stopAmbience();
	}

	/**
	 * The player's first tap or key press: the one moment browsers allow audio to start. Opens
	 * the audio context and, if the player chose it, fades the ambience in.
	 */
	unlock() {
		if (this.#unlocked) return;
		this.#unlocked = true;
		if (this.ambience) this.#startAmbience();
	}

	/** Quiet while the tab is hidden; picks up again when the player comes back. */
	visibility(hidden: boolean) {
		const ctx = this.#ctx;
		if (!ctx) return;
		if (hidden) void ctx.suspend().catch(() => {});
		else void ctx.resume().catch(() => {});
	}

	play(name: Sfx) {
		if (!this.effects) return;
		const ctx = this.#context();
		if (!ctx || !this.#fx) return;
		const t = ctx.currentTime + 0.005;
		const out = this.#fx;
		switch (name) {
			case 'tap':
				this.#blip(ctx, out, t, { wave: 'square', from: 900, to: 620, dur: 0.03, gain: 0.12 });
				break;
			case 'select':
				this.#blip(ctx, out, t, { wave: 'square', from: 660, dur: 0.03, gain: 0.12 });
				this.#blip(ctx, out, t, { wave: 'square', from: 990, at: 0.035, dur: 0.035, gain: 0.12 });
				break;
			case 'call-up':
				this.#blip(ctx, out, t, { wave: 'square', from: 330, to: 880, dur: 0.11, gain: 0.16 });
				break;
			case 'call-down':
				this.#blip(ctx, out, t, { wave: 'square', from: 880, to: 330, dur: 0.11, gain: 0.16 });
				break;
			case 'right':
				// A coin-up: a quick major arpeggio that ends on a held top note.
				[1047, 1319, 1568].forEach((f, i) =>
					this.#blip(ctx, out, t, { wave: 'square', from: f, at: i * 0.06, dur: 0.06, gain: 0.14 })
				);
				this.#blip(ctx, out, t, { wave: 'triangle', from: 2093, at: 0.18, dur: 0.22, gain: 0.2 });
				break;
			case 'wrong':
				// A soft two-step slide down: clear, not a buzzer.
				this.#blip(ctx, out, t, { wave: 'triangle', from: 392, to: 370, dur: 0.12, gain: 0.3 });
				this.#blip(ctx, out, t, {
					wave: 'triangle',
					from: 294,
					to: 262,
					at: 0.13,
					dur: 0.26,
					gain: 0.3
				});
				break;
			case 'finale':
				this.#finale(ctx, out, t);
				break;
			case 'bark':
				// "Ruff ruff": a quick yap, then a slightly lower one.
				this.#bark(ctx, out, t, 1);
				this.#bark(ctx, out, t + 0.17, 0.88);
				break;
		}
	}

	/**
	 * One yap: a buzzy voice that jumps up and drops, plus a breath of noise, both through a
	 * band-pass that stands in for the mouth. `pitch` scales the whole thing.
	 */
	#bark(ctx: AudioContext, out: AudioNode, t: number, pitch: number) {
		const dur = 0.13;
		const mouth = ctx.createBiquadFilter();
		mouth.type = 'bandpass';
		mouth.frequency.setValueAtTime(900 * pitch, t);
		mouth.frequency.exponentialRampToValueAtTime(1400 * pitch, t + 0.03);
		mouth.frequency.exponentialRampToValueAtTime(600 * pitch, t + dur);
		mouth.Q.value = 1.4;
		const env = ctx.createGain();
		env.gain.setValueAtTime(0.0001, t);
		env.gain.exponentialRampToValueAtTime(0.9, t + 0.008);
		env.gain.exponentialRampToValueAtTime(0.35, t + 0.05);
		env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		mouth.connect(env).connect(out);

		const voice = ctx.createOscillator();
		voice.type = 'sawtooth';
		voice.frequency.setValueAtTime(380 * pitch, t);
		voice.frequency.exponentialRampToValueAtTime(620 * pitch, t + 0.025);
		voice.frequency.exponentialRampToValueAtTime(260 * pitch, t + dur);
		voice.connect(mouth);
		voice.start(t);
		voice.stop(t + dur + 0.02);

		const len = Math.ceil(ctx.sampleRate * dur);
		const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
		const breath = ctx.createBufferSource();
		breath.buffer = buffer;
		breath.connect(mouth);
		breath.start(t);
	}

	#context(): AudioContext | null {
		if (this.#ctx) {
			if (this.#ctx.state === 'suspended' && document.visibilityState === 'visible') {
				void this.#ctx.resume().catch(() => {});
			}
			return this.#ctx;
		}
		if (!this.#unlocked || typeof AudioContext === 'undefined') return null;
		try {
			const ctx = new AudioContext();
			const fx = ctx.createGain();
			fx.gain.value = EFFECTS_GAIN;
			fx.connect(ctx.destination);
			this.#ctx = ctx;
			this.#fx = fx;
			return ctx;
		} catch {
			return null;
		}
	}

	/** One short tone with a click-free envelope, optionally sliding in pitch. */
	#blip(ctx: AudioContext, out: AudioNode, t0: number, b: Blip) {
		const start = t0 + (b.at ?? 0);
		const end = start + b.dur;
		const osc = ctx.createOscillator();
		const env = ctx.createGain();
		osc.type = b.wave ?? 'square';
		osc.frequency.setValueAtTime(b.from, start);
		if (b.to) osc.frequency.exponentialRampToValueAtTime(b.to, end);
		const peak = b.gain ?? 0.15;
		env.gain.setValueAtTime(0.0001, start);
		env.gain.exponentialRampToValueAtTime(peak, start + 0.005);
		env.gain.exponentialRampToValueAtTime(0.0001, end);
		osc.connect(env).connect(out);
		osc.start(start);
		osc.stop(end + 0.02);
	}

	/** The unmasking: a little fanfare, then the wolf howls at the moon. */
	#finale(ctx: AudioContext, out: AudioNode, t: number) {
		[523, 659, 784, 1047].forEach((f, i) =>
			this.#blip(ctx, out, t, {
				wave: 'square',
				from: f,
				at: i * 0.09,
				dur: i === 3 ? 0.3 : 0.09,
				gain: 0.12
			})
		);

		// The howl: two detuned voices through a low-pass, rising, holding with a vibrato, falling.
		const h = t + 0.5;
		const filter = ctx.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.value = 1500;
		filter.Q.value = 2;
		const env = ctx.createGain();
		env.gain.setValueAtTime(0.0001, h);
		env.gain.exponentialRampToValueAtTime(0.32, h + 0.35);
		env.gain.setValueAtTime(0.32, h + 1.1);
		env.gain.exponentialRampToValueAtTime(0.0001, h + 2.1);
		filter.connect(env).connect(out);

		const vibrato = ctx.createOscillator();
		const depth = ctx.createGain();
		vibrato.frequency.value = 5.5;
		depth.gain.setValueAtTime(0, h);
		depth.gain.linearRampToValueAtTime(14, h + 0.7);
		vibrato.connect(depth);

		for (const [wave, detune] of [
			['sawtooth', -6],
			['triangle', 6]
		] as const) {
			const osc = ctx.createOscillator();
			osc.type = wave;
			osc.detune.value = detune;
			osc.frequency.setValueAtTime(330, h);
			osc.frequency.exponentialRampToValueAtTime(600, h + 0.45);
			osc.frequency.setValueAtTime(600, h + 1.1);
			osc.frequency.exponentialRampToValueAtTime(390, h + 2.1);
			depth.connect(osc.frequency);
			osc.connect(filter);
			osc.start(h);
			osc.stop(h + 2.2);
		}
		vibrato.start(h);
		vibrato.stop(h + 2.2);
	}

	#startAmbience() {
		if (this.#amb || !this.#unlocked) return;
		const ctx = this.#context();
		if (!ctx) return;
		const t = ctx.currentTime;
		const bus = ctx.createGain();
		bus.gain.setValueAtTime(0.0001, t);
		bus.gain.exponentialRampToValueAtTime(AMBIENCE_GAIN, t + 2.5);
		bus.connect(ctx.destination);
		const sources: AudioScheduledSourceNode[] = [];

		// Wind: soft brown noise through a low-pass that drifts slowly open and closed.
		const len = ctx.sampleRate * 4;
		const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
		const data = buffer.getChannelData(0);
		let last = 0;
		for (let i = 0; i < len; i++) {
			last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
			data[i] = last * 3.5;
		}
		const noise = ctx.createBufferSource();
		noise.buffer = buffer;
		noise.loop = true;
		const wind = ctx.createBiquadFilter();
		wind.type = 'lowpass';
		wind.frequency.value = 420;
		const gust = ctx.createOscillator();
		const gustDepth = ctx.createGain();
		gust.frequency.value = 0.07;
		gustDepth.gain.value = 220;
		gust.connect(gustDepth).connect(wind.frequency);
		const windGain = ctx.createGain();
		windGain.gain.value = 0.22;
		noise.connect(wind).connect(windGain).connect(bus);
		sources.push(noise, gust);

		// The city far off: a low hum, barely there.
		const hum = ctx.createGain();
		hum.gain.value = 0.025;
		hum.connect(bus);
		for (const f of [55, 110.4]) {
			const o = ctx.createOscillator();
			o.frequency.value = f;
			o.connect(hum);
			sources.push(o);
		}
		for (const s of sources) s.start(t);

		// Crickets: a few quick high chirps every few seconds.
		let timer: ReturnType<typeof setTimeout> | undefined;
		const chirp = () => {
			if (ctx.state === 'running') {
				const at = ctx.currentTime + 0.02;
				const pulses = 3 + Math.floor(Math.random() * 3);
				const f = 4000 + Math.random() * 600;
				for (let i = 0; i < pulses; i++) {
					this.#blip(ctx, bus, at, {
						wave: 'sine',
						from: f,
						at: i * 0.055,
						dur: 0.03,
						gain: 0.035
					});
				}
			}
			timer = setTimeout(chirp, 2500 + Math.random() * 5000);
		};
		timer = setTimeout(chirp, 1500);

		this.#amb = {
			bus,
			stop: () => {
				clearTimeout(timer);
				const now = ctx.currentTime;
				bus.gain.cancelScheduledValues(now);
				bus.gain.setValueAtTime(Math.max(bus.gain.value, 0.0001), now);
				bus.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
				for (const s of sources) s.stop(now + 0.85);
				setTimeout(() => bus.disconnect(), 1000);
			}
		};
	}

	#stopAmbience() {
		this.#amb?.stop();
		this.#amb = null;
	}
}

export const sound = new SoundBoard();
