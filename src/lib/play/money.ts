/**
 * Display helpers for money. Balances are integer cents.
 *
 * One rule on every screen: whole dollars, halves rounded up (the share text uses the same rule,
 * see formatWholeDollars in src/lib/game/share.ts). What a call paid is the change in the rounded
 * balance (see paidByCall), so the per-call amounts always add up to the balance shown.
 */

/** Cents rounded to whole dollars, halves away from zero. Still in cents. */
export function wholeDollarCents(cents: number): number {
	const abs = Math.floor((Math.abs(cents) + 50) / 100) * 100;
	return cents < 0 ? -abs : abs;
}

/** "$142", "−$14", or "+$6" with `sign`. Zero never takes a sign. */
export function dollars(cents: number, opts: { sign?: boolean } = {}): string {
	const whole = wholeDollarCents(cents) / 100;
	const body = Math.abs(whole).toLocaleString('en-US');
	const sign = whole < 0 ? '−' : opts.sign && whole > 0 ? '+' : '';
	return `${sign}$${body}`;
}

/**
 * What each call paid, in cents of whole dollars: the change in the rounded balance. Use these
 * (not each call's exact delta) wherever a call's result is shown next to the balance.
 */
export function paidByCall(
	results: readonly { balanceAfterCents: number }[],
	startCents: number
): number[] {
	return results.map((r, i) => {
		const before = i === 0 ? startCents : results[i - 1].balanceAfterCents;
		return wholeDollarCents(r.balanceAfterCents) - wholeDollarCents(before);
	});
}

export function multiplier(hundredths: number): string {
	return `${(hundredths / 100).toFixed(hundredths % 10 === 0 ? 1 : 2)}×`;
}

export function percent(share: number): string {
	return `${Math.round(share * 100)}%`;
}
