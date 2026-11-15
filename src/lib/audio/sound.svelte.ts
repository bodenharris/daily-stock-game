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

/** A soft clip, for the grit in the bark's voice. */
let softClip: Float32Array<ArrayBuffer> | undefined;
function clipCurve() {
	if (!softClip) {
		softClip = new Float32Array(1024);
		for (let i = 0; i < softClip.length; i++) {
			const x = (i / (softClip.length - 1)) * 2 - 1;
			softClip[i] = Math.tanh(x * 3) / Math.tanh(3);
		}
	}
	return softClip;
}

/**
 * One bark, built the way a voice is: a rough source shaped by a mouth.
 *
 * The source is a sawtooth with a growl an octave below it, its loudness fluttering about 70
 * times a second (the rasp of a throat) and lightly clipped, plus a puff of breath that is
 * strongest at the onset. The mouth is three formant band-passes in parallel that slide from
 * an open "ah" to a rounder "oo" as the pitch jumps up and falls away, so it reads as "rrowf"
 * rather than a beep. `pitch` scales the voice (the formants less, like a slightly smaller
 * dog), `level` the loudness, and every bark jitters a little so repeats don't sound pasted.
 * Exported so it can be rendered offline.
 */
export function bark(ctx: BaseAudioContext, out: AudioNode, t: number, pitch = 1, level = 1) {
	const jitter = (amount: number) => 1 + (Math.random() - 0.5) * amount;
	const f0 = 290 * pitch * jitter(0.08);
	const dur = 0.2 * jitter(0.1);
	const end = t + dur;
	const tract = Math.sqrt(pitch);

	// Loudness: a hard onset, a short hold, a quick fall. The low-pass takes off the 8-bit edge.
	const env = ctx.createGain();
	env.gain.setValueAtTime(0.0001, t);
	env.gain.exponentialRampToValueAtTime(level, t + 0.012);
	env.gain.setValueAtTime(level, t + 0.045);
	env.gain.exponentialRampToValueAtTime(0.0001, end);
	const air = ctx.createBiquadFilter();
	air.type = 'lowpass';
	air.frequency.value = 4000;
	env.connect(air).connect(out);

	// The mouth: [start Hz, end Hz, Q, gain] for each formant, "ah" sliding to "oo".
	const mouth = ctx.createGain();
	for (const [from, to, q, gain] of [
		[800, 480, 5, 1.6],
		[1450, 1000, 7, 0.9],
		[2700, 2300, 9, 0.4]
	]) {
		const band = ctx.createBiquadFilter();
		band.type = 'bandpass';
		band.frequency.setValueAtTime(from * tract, t);
		band.frequency.exponentialRampToValueAtTime(to * tract, end);
		band.Q.value = q;
		const g = ctx.createGain();
		g.gain.value = gain;
		mouth.connect(band).connect(g).connect(env);
	}

	// The throat: its loudness flutters, then it is clipped for grit.
	const throat = ctx.createGain();
	throat.gain.value = 0.6;
	const flutter = ctx.createOscillator();
	flutter.type = 'triangle';
	flutter.frequency.value = 70 * jitter(0.2);
	const depth = ctx.createGain();
	depth.gain.value = 0.35;
	flutter.connect(depth).connect(throat.gain);
	const grit = ctx.createWaveShaper();
	grit.curve = clipCurve();
	throat.connect(grit).connect(mouth);

	// The voice and its growl: up fast, then falling away.
	const sources: AudioScheduledSourceNode[] = [flutter];
	for (const [ratio, gain] of [
		[1, 1],
		[0.5, 0.45]
	]) {
		const osc = ctx.createOscillator();
		osc.type = 'sawtooth';
		const f = f0 * ratio;
		osc.frequency.setValueAtTime(f * 0.8, t);
		osc.frequency.exponentialRampToValueAtTime(f * 1.15, t + 0.035);
		osc.frequency.exponentialRampToValueAtTime(f * 0.65, end);
		const g = ctx.createGain();
		g.gain.value = gain;
		osc.connect(g).connect(throat);
		sources.push(osc);
	}

	// The breath: white noise, strongest as the bark bursts out.
	const len = Math.ceil(ctx.sampleRate * dur);
	const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
	const noise = ctx.createBufferSource();
	noise.buffer = buffer;
	const puff = ctx.createGain();
	puff.gain.setValueAtTime(0.7, t);
	puff.gain.exponentialRampToValueAtTime(0.18, t + 0.05);
	noise.connect(puff).connect(mouth);
	noise.start(t);

	for (const s of sources) {
		s.start(t);
		s.stop(end + 0.02);
	}
}

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
				// "Woof woof": a bark, then a slightly lower, softer one.
				bark(ctx, out, t, 1, 1);
				bark(ctx, out, t + 0.3, 0.92, 0.8);
				break;
		}
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
