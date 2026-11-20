import type { prices } from '#lib/server/db/schema.ts';

/** One day as Tiingo's daily prices endpoint returns it (the fields we use). */
export type TiingoBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  splitFactor?: number;
};

/**
 * Split-adjust raw Tiingo bars: divide every price by the product of all splits that happened
 * after that bar (a split's factor is reported on its first post-split bar). Volume is scaled
 * the other way. Not Tiingo's adj* fields: those also take out dividends, and the reveal should
 * show the quotes people remember.
 */
export function splitAdjust(ticker: string, bars: TiingoBar[]): (typeof prices.$inferInsert)[] {
  const sorted = bars.toSorted((a, b) => a.date.localeCompare(b.date));
  const rows = new Array<typeof prices.$inferInsert>(sorted.length);
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
      volume: Math.round(bar.volume * factor),
    };
    const split = bar.splitFactor ?? 1;
    if (split > 0 && split !== 1) factor *= split;
  }
  // Tiingo has the odd broken bar (zero close, high below low); drop those.
  return rows.filter(
    (r) => Number.isFinite(r.close) && r.close > 0 && r.high >= r.low && Number.isFinite(r.volume),
  );
}
