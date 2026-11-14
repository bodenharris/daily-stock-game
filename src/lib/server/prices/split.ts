export type TiingoBar = {
	date: string;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
	splitFactor?: number;
};

export type PriceRow = {
	ticker: string;
	ts: string;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
};

/**
 * Split-adjust raw Tiingo bars: divide every price by the product of all splits that happened
 * after that bar (a split's factor is reported on its first post-split bar). Volume is scaled
 * the other way. No dividend adjustment, so prices match the quotes people remember.
 */
export function splitAdjust(ticker: string, bars: TiingoBar[]): PriceRow[] {
	const sorted = [...bars].sort((a, b) => a.date.localeCompare(b.date));
	const rows: PriceRow[] = new Array(sorted.length);
	let factor = 1;
	for (let i = sorted.length - 1; i >= 0; i--) {
		const bar = sorted[i];
		rows[i] = {
			ticker,
			ts: bar.date.slice(0, 10),
			open: bar.open / factor,
			high: bar.high / factor,
			low: bar.low / factor,
			close: bar.close / factor,
			volume: Math.round(bar.volume * factor)
		};
		const split = bar.splitFactor ?? 1;
		if (split > 0 && split !== 1) factor *= split;
	}
	return rows.filter(
		(r) => Number.isFinite(r.close) && r.close > 0 && r.high >= r.low && Number.isFinite(r.volume)
	);
}
