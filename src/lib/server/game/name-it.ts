import { BETTER_AUTH_SECRET, PUZZLE_SECRET } from '$app/env/private';
import { client } from '#lib/server/db/index.ts';
import { bigMoveOf, nameItOptions, type NameItCandidate } from './name-it-options.ts';

const SECRET = PUZZLE_SECRET ?? BETTER_AUTH_SECRET;
const TTL_MS = 10 * 60_000;

let cache: { at: number; pool: Promise<NameItCandidate[]> } | null = null;

/**
 * Every puzzle in play, with the direction of its big move, in one round trip: the close
 * before call 1 and the closes after it, per puzzle, via LATERAL joins on the prices
 * hypertable. Cached for a few minutes, so a reseeded catalog shows up without a restart.
 */
function candidates(): Promise<NameItCandidate[]> {
	if (cache && Date.now() - cache.at < TTL_MS) return cache.pool;
	const pool = client<
		{
			slug: string;
			ticker: string;
			headline: string;
			step: number;
			base: number;
			after: number[];
		}[]
	>`
		select p.slug, p.ticker, p.headline, p.step_bars as step, b.close as base, a.closes as after
		from puzzles p
		cross join lateral (
			select close from prices
			where ticker = p.ticker and ts <= p.last_context_date
			order by ts desc limit 1
		) b
		cross join lateral (
			select array_agg(close order by ts) as closes from (
				select ts, close from prices
				where ticker = p.ticker and ts > p.last_context_date
				order by ts limit p.step_bars * p.calls
			) x
		) a
		where p.position >= 0`.then((rows) =>
		rows.map((r) => {
			const points = [Number(r.base)];
			for (let i = r.step - 1; i < r.after.length; i += r.step) points.push(Number(r.after[i]));
			const moves = points.slice(1).map((c, i) => (c / points[i] - 1) * 100);
			return { slug: r.slug, ticker: r.ticker, headline: r.headline, bigMove: bigMoveOf(moves) };
		})
	);
	pool.catch(() => (cache = null));
	cache = { at: Date.now(), pool };
	return pool;
}

/** The four moments offered for a puzzle, in the order shown. Same for every player. */
export async function optionsFor(answer: {
	slug: string;
	ticker: string;
	headline: string;
	moves: number[];
}): Promise<NameItCandidate[]> {
	const pool = await candidates();
	const me = pool.find((c) => c.slug === answer.slug) ?? {
		slug: answer.slug,
		ticker: answer.ticker,
		headline: answer.headline,
		bigMove: bigMoveOf(answer.moves)
	};
	return nameItOptions(me, pool, SECRET);
}
