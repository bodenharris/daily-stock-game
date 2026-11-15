<script lang="ts">
	import { area, curveMonotoneX, line } from 'd3-shape';
	import { START_BALANCE_CENTS } from '#lib/game/config.ts';
	import { dollars } from '#lib/play/money.ts';
	import { FINISH_BUCKET_CENTS, groupFinishes, type FinishBucket } from './finishes.ts';

	let {
		finishes,
		you = null
	}: {
		/** Finishes per $10 bucket (lower edge in cents), as the server sends them. */
		finishes: FinishBucket[];
		/** The viewer's own final balance, if they finished. */
		you?: number | null;
	} = $props();

	/** Round-width groups: they set where the axis ends, and give the summary its "$60 to $80 group". */
	const chart = $derived(groupFinishes(finishes, you));

	const money = (cents: number) => dollars(cents, { cents: false });
	const range = (b: { from: number; to: number; open: boolean }) =>
		b.open ? `${money(b.from)} or more` : `${money(b.from)} to ${money(b.to)}`;
	const startAt = $derived((START_BALANCE_CENTS / chart.end) * 100);

	/**
	 * A smooth curve of where people finished (a kernel density estimate): every finish adds a
	 * small bell centred on its $10 bucket, and the curve is their sum. Bell width follows
	 * Silverman's rule, kept within a sensible share of the axis, so a handful of players reads
	 * as one shape rather than a row of spikes, and a big crowd still shows its bumps.
	 *
	 * Smoothing spreads every finish a little to each side, so the curve is only drawn from just
	 * below the lowest finish to just above the highest, and never crosses the start line onto a
	 * side nobody finished on: a day where everyone made money shows no red at all.
	 */
	const SAMPLES = 81;
	const HEADROOM = 8;
	const curve = $derived.by(() => {
		if (finishes.length === 0) return { line: '', area: '', mine: null };
		const half = FINISH_BUCKET_CENTS / 2;
		const total = chart.total || 1;
		const mean = finishes.reduce((s, f) => s + (f.cents + half) * f.count, 0) / total;
		const sd = Math.sqrt(
			finishes.reduce((s, f) => s + (f.cents + half - mean) ** 2 * f.count, 0) / total
		);
		const h = Math.min(
			chart.end / 10,
			Math.max(chart.end / 40, sd > 0 ? 0.75 * sd * total ** -0.2 : chart.end / 20)
		);
		const density = (x: number) =>
			finishes.reduce((s, f) => s + f.count * Math.exp(-0.5 * ((x - f.cents - half) / h) ** 2), 0);
		// Two bell-widths past the outermost finishes, where a bell has faded to an eighth.
		const lowest = Math.min(...finishes.map((f) => f.cents));
		const highest = Math.min(chart.end, Math.max(...finishes.map((f) => f.cents)) + 2 * half);
		let from = Math.max(0, lowest - 2 * h);
		let to = Math.min(chart.end, highest + 2 * h);
		if (lowest >= START_BALANCE_CENTS) from = Math.max(from, START_BALANCE_CENTS);
		if (highest <= START_BALANCE_CENTS) to = Math.min(to, START_BALANCE_CENTS);
		const xs = Array.from({ length: SAMPLES }, (_, i) => from + (i / (SAMPLES - 1)) * (to - from));
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

	// "$0" sits at the left edge and "Start $100" is centred on the start line. On a wide range
	// the line sits near the edge, so "$0" is dropped rather than touch it: it needs roughly the
	// width of both labels (about 56px) between the edge and the line.
	let axisWidth = $state(0);
	const showZero = $derived(axisWidth > 0 && (startAt / 100) * axisWidth >= 56);

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
	<figcaption
		class="relative mt-1.5 h-4 type-label-sm text-on-surface-variant"
		aria-hidden="true"
		bind:clientWidth={axisWidth}
	>
		{#if showZero}<span class="absolute left-0">$0</span>{/if}
		<!-- Kept far enough in that a start line near the edge can't push its label off it. -->
		<span class="absolute -translate-x-1/2" style:left="max({startAt}%, 1.875rem)"
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
