import { createHmac } from 'node:crypto';

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
