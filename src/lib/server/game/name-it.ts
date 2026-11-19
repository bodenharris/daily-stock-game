import { createHmac } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { PUZZLE_SECRET } from '$app/env/private';
import { db } from '#lib/server/db/index.ts';
import type { PuzzleData } from './puzzle-data.ts';

/** One puzzle as a "Name it" option: what it is, and which way its big move went. */
export interface NameItCandidate {
	slug: string;
	ticker: string;
	headline: string;
	/** Direction of the biggest single stretch of the five, the move the headline is about. */
	bigMove: 'up' | 'down';
}

export const NAME_IT_OPTIONS = 4;

/**
 * The four moments offered for `answer`: the answer plus three decoys, in a fixed order.
 *
 * Decoys share the answer's big-move direction where possible (a crash is offered with other
 * crashes, so the chart's shape alone doesn't give it away), never use the same ticker or
 * headline, and are picked and ordered by a hash keyed with a server secret: the same options
 * for every player of a puzzle, but not computable from the repo.
 */
export function nameItOptions(
	answer: NameItCandidate,
	pool: NameItCandidate[],
	secret: string
): NameItCandidate[] {
	const rank = (salt: string, slug: string) =>
		createHmac('sha256', secret).update(`${answer.slug}:${salt}:${slug}`).digest('hex');
	const byRank = (salt: string) => (a: NameItCandidate, b: NameItCandidate) => {
		const ra = rank(salt, a.slug);
		const rb = rank(salt, b.slug);
		return ra < rb ? -1 : ra > rb ? 1 : 0;
	};

	const eligible = pool.filter(
		(c) => c.slug !== answer.slug && c.ticker !== answer.ticker && c.headline !== answer.headline
	);
	const same = eligible.filter((c) => c.bigMove === answer.bigMove).sort(byRank('decoy'));
	const other = eligible.filter((c) => c.bigMove !== answer.bigMove).sort(byRank('decoy'));

	const decoys: NameItCandidate[] = [];
	const headlines = new Set([answer.headline]);
	for (const c of [...same, ...other]) {
		if (decoys.length === NAME_IT_OPTIONS - 1) break;
		if (headlines.has(c.headline)) continue;
		headlines.add(c.headline);
		decoys.push(c);
	}
	return [answer, ...decoys].sort(byRank('order'));
}

/** Direction of the largest absolute move among the five stretches. */
export function bigMoveOf(moves: number[]): 'up' | 'down' {
	let best = 0;
	for (const m of moves) if (Math.abs(m) > Math.abs(best)) best = m;
	return best >= 0 ? 'up' : 'down';
}

/**
 * Every puzzle in play with the direction of its big move, in one query: the close before call 1
 * and the closes after it, per puzzle, through LATERAL joins on the prices primary key.
 */
async function candidates(): Promise<NameItCandidate[]> {
	const { rows } = await db.execute<{
		slug: string;
		ticker: string;
		headline: string;
		step: number;
		base: number;
		after: number[];
	}>(sql`
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
		where p.position >= 0`);
	return rows.map((r) => {
		const points = [r.base];
		for (let i = r.step - 1; i < r.after.length; i += r.step) points.push(r.after[i]);
		const moves = points.slice(1).map((c, i) => (c / points[i] - 1) * 100);
		return { slug: r.slug, ticker: r.ticker, headline: r.headline, bigMove: bigMoveOf(moves) };
	});
}

/** The four moments offered for a puzzle, in the order shown. Same for every player. */
export async function optionsFor(answer: PuzzleData): Promise<NameItCandidate[]> {
	const pool = await candidates();
	const me = pool.find((c) => c.slug === answer.slug) ?? {
		slug: answer.slug,
		ticker: answer.ticker,
		headline: answer.headline,
		bigMove: bigMoveOf(answer.moves)
	};
	return nameItOptions(me, pool, PUZZLE_SECRET);
}
