/**
 * How the game writes money, moves, prices, dates and time spans.
 *
 * One money rule on every screen and in the share text: whole dollars, halves rounded up. What a
 * call paid is the change in the rounded balance (see paidByCall), so the per-call amounts always
 * add up to the balance shown.
 */

/** Cents rounded to whole dollars, halves away from zero. Still in cents. */
export function wholeDollarCents(cents: number): number {
	const abs = Math.floor((Math.abs(cents) + 50) / 100) * 100;
	return cents < 0 ? -abs : abs;
}

/** "$142", "−$14", or "+$6" with `sign`. Zero never takes a sign. */
export function dollars(cents: number, opts: { sign?: boolean } = {}): string {
	const whole = wholeDollarCents(cents) / 100;
	const sign = whole < 0 ? '−' : opts.sign && whole > 0 ? '+' : '';
	return `${sign}$${Math.abs(whole).toLocaleString('en-US')}`;
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

/** A price move in percent: "+79%", "−6.5%". Float noise is rounded off first, so 78.4999… reads +79%. */
export function formatMove(percent: number): string {
	const pct = Number(percent.toFixed(6));
	const abs = Math.abs(pct);
	return `${pct >= 0 ? '+' : '−'}${abs >= 10 ? Math.round(abs) : abs.toFixed(1)}%`;
}

/** A share price as quoted: "$348", "$86.9", "$4.12". */
export function formatPrice(n: number): string {
	return n >= 100 ? `$${Math.round(n)}` : n >= 10 ? `$${n.toFixed(1)}` : `$${n.toFixed(2)}`;
}

/** Building a formatter is the slow part, and the archive formats a date per row: keep one per set of options. */
const formatters = new Map<string, Intl.DateTimeFormat>();

/**
 * A calendar date ("YYYY-MM-DD") in words. Read at noon UTC and written in UTC, so the day never
 * shifts with the viewer's time zone and the server and the browser agree.
 */
export function formatDate(iso: string, options: Intl.DateTimeFormatOptions): string {
	const key = JSON.stringify(options);
	let formatter = formatters.get(key);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' });
		formatters.set(key, formatter);
	}
	return formatter.format(new Date(`${iso}T12:00:00Z`));
}

/*
 * How much time a chart covers, in plain words. Dates stay hidden until the reveal, but the
 * lengths are not a secret: the play screen asks about "the next week", and the moment is much
 * easier to name when you know whether a move took a day or a month.
 */

/** One call's stretch, without an article: "day", "week", "two weeks", "5 trading days"… */
export function callSpan(stepBars: number): string {
	if (stepBars === 1) return 'day';
	if (stepBars === 5) return 'week';
	if (stepBars === 10) return 'two weeks';
	if (stepBars === 15) return 'three weeks';
	if (stepBars >= 20 && stepBars <= 22) return 'month';
	return `${stepBars} trading days`;
}

/** The history shown before the first call: "3 months", "a month", "30 trading days". */
export function contextSpan(contextBars: number): string {
	if (contextBars >= 20 && contextBars <= 22) return 'a month';
	if (contextBars >= 40) return `${Math.round(contextBars / 21)} months`;
	return `${contextBars} trading days`;
}

/** The whole chart: "3 months of daily prices, then 5 calls of a week each." */
export function chartTimeframe(shape: {
	contextBars: number;
	stepBars: number;
	calls: number;
}): string {
	const span = callSpan(shape.stepBars);
	const each = ['day', 'week', 'month'].includes(span) ? `a ${span}` : span;
	return `${contextSpan(shape.contextBars)} of daily prices, then ${shape.calls} calls of ${each} each.`;
}
