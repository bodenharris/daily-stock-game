/**
 * Pure helpers for the "Real or Random?" bonus round: a seeded RNG and a random walk that
 * looks like a stock. Kept free of database imports so they can be unit tested.
 */

/** mulberry32: small, fast, good enough for picking charts. */
export function rng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function normal(rand: () => number): number {
	let u = 0;
	while (u === 0) u = rand();
	const v = rand();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Student-t-ish fat tails: a normal divided by the root of a scaled chi-square. */
function fatTail(rand: () => number, dof = 4): number {
	let chi = 0;
	for (let i = 0; i < dof; i++) chi += normal(rand) ** 2;
	return normal(rand) / Math.sqrt(chi / dof) / Math.sqrt(dof / (dof - 2));
}

/**
 * A synthetic daily price path with the things real charts have: fat-tailed returns, volatility
 * that clusters (GARCH(1,1)), and a little drift. Plain random walks look too smooth to fool anyone.
 */
export function syntheticPath(rand: () => number, bars: number, dailyVol: number): number[] {
	const omega = dailyVol ** 2 * 0.06;
	const alpha = 0.09;
	const beta = 0.85;
	let variance = dailyVol ** 2;
	let lastShock = 0;
	const drift = (rand() - 0.45) * dailyVol * 0.25;
	const out = [100];
	for (let i = 1; i < bars; i++) {
		variance = omega + alpha * lastShock ** 2 + beta * variance;
		const shock = Math.sqrt(variance) * fatTail(rand);
		lastShock = shock;
		out.push(out[i - 1] * Math.exp(drift + shock));
	}
	return out;
}

/** Daily log-return volatility of a price series. */
export function dailyVolatility(closes: number[]): number {
	const r: number[] = [];
	for (let i = 1; i < closes.length; i++) r.push(Math.log(closes[i] / closes[i - 1]));
	const mean = r.reduce((a, b) => a + b, 0) / Math.max(1, r.length);
	const v = r.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, r.length - 1);
	return Math.sqrt(v);
}

/** Normalise so the first close is 100 and round, so values carry no hint of their source. */
export function normalise(closes: number[]): number[] {
	const base = closes[0];
	return closes.map((c) => Math.round((c / base) * 1000) / 10);
}
