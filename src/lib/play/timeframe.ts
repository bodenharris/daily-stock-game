/**
 * How much time a chart covers, in plain words. Dates stay hidden until the reveal, but the
 * lengths are not a secret: the play screen asks about "the next week", and the moment is
 * much easier to name when you know whether a move took a day or a month.
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
