<script lang="ts">
	import { area, curveMonotoneX, line } from 'd3-shape';
	import { START_BALANCE_CENTS } from '#lib/game/config.ts';
	import { dollars } from '#lib/play/money.ts';
	import { FINISH_BUCKET_CENTS, FINISH_CAP_CENTS as cap, type FinishBucket } from './finishes.ts';

	let {
		finishes,
		you = null
	}: {
		/** Finishes per $10 bucket (lower edge in cents), as the server sends them. */
		finishes: FinishBucket[];
		/** The viewer's own final balance, if they finished. */
		you?: number | null;
	} = $props();

	/**
	 * The day's range split into round-width groups ($10, $20, $25, $50 …): they set where the
	 * axis ends, and give the screen-reader summary its "$60 to $80 group". Widths are tried
	 * narrowest first; the first that fits the range in MAX_GROUPS wins.
	 */
	const WIDTHS = [1_000, 2_000, 2_500, 5_000, 10_000, 20_000, 25_000, 50_000];
	const MAX_GROUPS = 16;

	const chart = $derived.by(() => {
		const top = Math.max(0, ...finishes.map((f) => f.cents));
		const capped = top >= cap;
		// Always reach past the start, so the start line has room on both sides.
		const end = Math.max(top + 1, START_BALANCE_CENTS * 2);
		const width = WIDTHS.find((w) => Math.ceil(end / w) <= MAX_GROUPS) ?? WIDTHS.at(-1)!;
		const n = Math.ceil(end / width);
		const groups = Array.from({ length: n }, (_, i) => ({
			from: i * width,
			to: (i + 1) * width,
			count: 0,
			open: capped && i === n - 1
		}));
		for (const f of finishes) groups[Math.min(n - 1, Math.floor(f.cents / width))].count += f.count;
		const mine = you == null ? -1 : Math.min(n - 1, Math.floor(Math.min(you, cap) / width));
		return {
			groups,
			mine,
			total: groups.reduce((s, b) => s + b.count, 0),
			end: n * width,
			capped
		};
	});

	const money = (cents: number) => dollars(cents, { cents: false });
	const range = (b: { from: number; to: number; open: boolean }) =>
		b.open ? `${money(b.from)} or more` : `${money(b.from)} to ${money(b.to)}`;
	const startAt = $derived((START_BALANCE_CENTS / chart.end) * 100);

	/**
	 * A smooth curve of where people finished (a kernel density estimate): every finish adds a
	 * small bell centred on its $10 bucket, and the curve is their sum. Bell width follows
	 * Silverman's rule, kept within a sensible share of the axis, so a handful of players reads
	 * as one shape rather than a row of spikes, and a big crowd still shows its bumps.
	 */
	const SAMPLES = 81;
	const HEADROOM = 8;
	const curve = $derived.by(() => {
		const half = FINISH_BUCKET_CENTS / 2;
		const total = chart.total || 1;
		const mean = finishes.reduce((s, f) => s + (f.cents + half) * f.count, 0) / total;
		const sd = Math.sqrt(
			finishes.reduce((s, f) => s + (f.cents + half - mean) ** 2 * f.count, 0) / total
		);
		const h = Math.min(
			chart.end / 6,
			Math.max(chart.end / 40, sd > 0 ? 0.75 * sd * total ** -0.2 : chart.end / 20)
		);
		const density = (x: number) =>
			finishes.reduce((s, f) => s + f.count * Math.exp(-0.5 * ((x - f.cents - half) / h) ** 2), 0);
		const xs = Array.from({ length: SAMPLES }, (_, i) => (i / (SAMPLES - 1)) * chart.end);
		const ys = xs.map(density);
		const peak = Math.max(...ys) || 1;
		// Drawn in a 100×100 box stretched to fit, so x and y are percentages of the plot.
		const at = (x: number, d: number): [number, number] => [
			(x / chart.end) * 100,
			100 - (d / peak) * (100 - HEADROOM)
		];
		const points = xs.map((x, i) => at(x, ys[i]));
		const mine = you == null ? null : Math.min(Math.max(you, 0), chart.end);
		return {
			line: line().curve(curveMonotoneX)(points) ?? '',
			area: area().curve(curveMonotoneX).y0(100)(points) ?? '',
			mine: mine == null ? null : at(mine, Math.min(density(mine), peak))
		};
	});
	const id = $props.id();

	const label = $derived.by(() => {
		const { groups, mine, total } = chart;
		const made = groups
			.filter((b) => b.from >= START_BALANCE_CENTS)
			.reduce((s, b) => s + b.count, 0);
		let text = `Final balances of ${total} ${total === 1 ? 'player' : 'players'}: ${made} finished at or above the ${money(START_BALANCE_CENTS)} start.`;
		if (mine >= 0) {
			const others = groups[mine].count - 1;
			text += ` You're in the ${range(groups[mine])} group${others > 0 ? ` with ${others} ${others === 1 ? 'other' : 'others'}` : ''}.`;
		}
		return text;
	});
</script>

<figure>
	<div class="relative pt-6" role="img" aria-label={label}>
		<div class="relative h-28 border-b border-outline-variant lg:h-36">
			<svg
				class="absolute inset-0 size-full overflow-visible"
				viewBox="0 0 100 100"
				preserveAspectRatio="none"
				aria-hidden="true"
			>
				<defs>
					<!-- Red below the start, green from it up: a hard stop at the start line. -->
					<linearGradient id="{id}-split" gradientUnits="userSpaceOnUse" x1="0" x2="100">
						<stop offset="{startAt}%" stop-color="var(--color-down)" />
						<stop offset="{startAt}%" stop-color="var(--color-up)" />
					</linearGradient>
				</defs>
				<path class="shape" d={curve.area} fill="url(#{id}-split)" opacity="0.18" />
				<path
					class="shape"
					d={curve.line}
					fill="none"
					stroke="url(#{id}-split)"
					stroke-width="2.5"
					stroke-linejoin="round"
					vector-effect="non-scaling-stroke"
				/>
			</svg>
			<!-- Where everyone started. -->
			<div
				class="pointer-events-none absolute inset-y-0 border-l border-dashed border-outline"
				style:left="{startAt}%"
			></div>
			{#if curve.mine}
				{@const [x, y] = curve.mine}
				<!-- HTML, not SVG, so the stretched box can't squash the dot or the label. -->
				<div
					class="pointer-events-none absolute flex -translate-x-1/2 -translate-y-full flex-col items-center"
					style:left="{x}%"
					style:top="{y}%"
				>
					<span class="type-label-md text-on-surface">You</span>
					<span
						class={[
							'mt-0.5 size-3 translate-y-1/2 rounded-full ring-2 ring-surface',
							x >= startAt ? 'bg-up' : 'bg-down'
						]}
					></span>
				</div>
			{/if}
		</div>
	</div>
	<figcaption class="relative mt-1.5 h-4 type-label-sm text-on-surface-variant" aria-hidden="true">
		<!-- On a wide range the start label sits near the left edge; drop "$0" rather than overlap. -->
		{#if startAt >= 15}<span class="absolute left-0">$0</span>{/if}
		<span class="absolute -translate-x-1/2" style:left="{startAt}%"
			>Start {money(START_BALANCE_CENTS)}</span
		>
		<span class="absolute right-0"
			>{chart.capped ? `${money(chart.groups.at(-1)!.from)}+` : money(chart.end)}</span
		>
	</figcaption>
</figure>

<style>
	/* The live stats page moves the curve as finishes come in. */
	.shape {
		transition: d 600ms var(--md-sys-motion-spring-default-spatial-easing, ease);
	}
	@media (prefers-reduced-motion: reduce) {
		.shape {
			transition: none;
		}
	}
</style>
