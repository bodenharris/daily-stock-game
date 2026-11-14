/** Display helpers for money. Balances are integer cents. */

export function dollars(cents: number, opts: { cents?: boolean; sign?: boolean } = {}): string {
	// Whole dollars read faster; cents only matter on small amounts.
	const showCents = opts.cents ?? (Math.abs(cents) < 1000 && Math.abs(cents) % 100 !== 0);
	const abs = Math.abs(cents) / 100;
	const body = abs.toLocaleString('en-US', {
		minimumFractionDigits: showCents ? 2 : 0,
		maximumFractionDigits: showCents ? 2 : 0
	});
	const sign = cents < 0 ? '−' : opts.sign ? '+' : '';
	return `${sign}$${body}`;
}

export function multiplier(hundredths: number): string {
	return `${(hundredths / 100).toFixed(hundredths % 10 === 0 ? 1 : 2)}×`;
}

export function percent(share: number): string {
	return `${Math.round(share * 100)}%`;
}
