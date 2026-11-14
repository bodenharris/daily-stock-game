<script lang="ts">
	import { START_BALANCE_CENTS } from '#lib/game/config.ts';
	import { dollars } from '#lib/play/money.ts';
	import { FINISH_CAP_CENTS as cap } from './finishes.ts';

	let {
		finishes,
		you = null
	}: {
		/** Finishes per narrow bucket (lower edge in cents), as the live stats send them. */
		finishes: { cents: number; count: number }[];
		/** The viewer's own final balance, if they finished. */
		you?: number | null;
	} = $props();

	/** Bar widths to try, narrowest first; the first that fits the day's range in MAX_BARS wins. */
	const WIDTHS = [1_000, 2_000, 2_500, 5_000, 10_000, 20_000, 25_000, 50_000];
	const MAX_BARS = 16;

	const chart = $derived.by(() => {
		const top = Math.max(0, ...finishes.map((f) => f.cents));
		const capped = top >= cap;
		// Always reach past the start, so the start line has room on both sides.
		const end = Math.max(top + 1, START_BALANCE_CENTS * 2);
		const width = WIDTHS.find((w) => Math.ceil(end / w) <= MAX_BARS) ?? WIDTHS.at(-1)!;
		const n = Math.ceil(end / width);
		const bars = Array.from({ length: n }, (_, i) => ({
			from: i * width,
			to: (i + 1) * width,
			count: 0,
			open: capped && i === n - 1
		}));
		for (const f of finishes) bars[Math.min(n - 1, Math.floor(f.cents / width))].count += f.count;
		const mine = you == null ? -1 : Math.min(n - 1, Math.floor(Math.min(you, cap) / width));
		return {
			bars,
			mine,
			max: Math.max(1, ...bars.map((b) => b.count)),
			total: bars.reduce((s, b) => s + b.count, 0),
			end: n * width,
			capped
		};
	});

	const money = (cents: number) => dollars(cents, { cents: false });
	const range = (b: { from: number; to: number; open: boolean }) =>
		b.open ? `${money(b.from)} or more` : `${money(b.from)} to ${money(b.to)}`;
	const startAt = $derived((START_BALANCE_CENTS / chart.end) * 100);

	const label = $derived.by(() => {
		const { bars, mine, total } = chart;
		const made = bars.filter((b) => b.from >= START_BALANCE_CENTS).reduce((s, b) => s + b.count, 0);
		let text = `Final balances of ${total} ${total === 1 ? 'player' : 'players'}: ${made} finished at or above the ${money(START_BALANCE_CENTS)} start.`;
		if (mine >= 0) {
			const others = bars[mine].count - 1;
			text += ` You're in the ${range(bars[mine])} group${others > 0 ? ` with ${others} ${others === 1 ? 'other' : 'others'}` : ''}.`;
		}
		return text;
	});
</script>

<figure>
	<div class="relative pt-6" role="img" aria-label={label}>
		<div
			class="grid h-28 items-end gap-0.5 border-b border-outline-variant lg:h-36"
			style:grid-template-columns="repeat({chart.bars.length}, minmax(0, 1fr))"
		>
			{#each chart.bars as bar, i (bar.from)}
				{@const profit = bar.from >= START_BALANCE_CENTS}
				{@const mine = i === chart.mine}
				<div class="relative flex h-full items-end" title="{range(bar)}: {bar.count}">
					{#if bar.count > 0}
						<div
							class={[
								'bar w-full rounded-t-[3px]',
								profit ? 'bg-up' : 'bg-down',
								!mine && 'opacity-40'
							]}
							style:height="{Math.max(4, (bar.count / chart.max) * 100)}%"
						></div>
					{/if}
					{#if mine}
						<span
							class="absolute left-1/2 mb-1 -translate-x-1/2 type-label-md whitespace-nowrap text-on-surface"
							style:bottom="{Math.max(4, (bar.count / chart.max) * 100)}%">You</span
						>
					{/if}
				</div>
			{/each}
		</div>
		<!-- Where everyone started. -->
		<div
			class="pointer-events-none absolute top-6 bottom-0 border-l border-dashed border-outline"
			style:left="{startAt}%"
		></div>
	</div>
	<figcaption class="relative mt-1.5 h-4 type-label-sm text-on-surface-variant" aria-hidden="true">
		<!-- On a wide range the start label sits near the left edge; drop "$0" rather than overlap. -->
		{#if startAt >= 15}<span class="absolute left-0">$0</span>{/if}
		<span class="absolute -translate-x-1/2" style:left="{startAt}%"
			>Start {money(START_BALANCE_CENTS)}</span
		>
		<span class="absolute right-0"
			>{chart.capped ? `${money(chart.bars.at(-1)!.from)}+` : money(chart.end)}</span
		>
	</figcaption>
</figure>

<style>
	.bar {
		transition: height 600ms var(--md-sys-motion-spring-default-spatial-easing, ease);
	}
	@media (prefers-reduced-motion: reduce) {
		.bar {
			transition: none;
		}
	}
</style>
