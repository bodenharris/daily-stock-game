<script lang="ts">
	import { area, curveMonotoneX, line } from 'd3-shape';
	import { Spring, Tween, prefersReducedMotion } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import type { Direction } from './types.ts';
	import {
		domainFor,
		pointsFor,
		slotBounds,
		xFor,
		yFor,
		type ChartShape,
		type Frame
	} from './layout.ts';

	interface Props {
		/** Visible values (normalised or real, the chart only cares about shape). */
		values: number[];
		shape: ChartShape;
		/** Calls already settled. */
		callsMade: number;
		/** Market direction of each settled stretch. */
		outcomes: Direction[];
		/** The call being placed right now, drawn as a ghost in the next slot. */
		pending?: Direction | null;
		/** Show dates and prices (after the unmasking). */
		labels?: { dates: string[]; closes: number[] } | null;
		class?: string;
	}

	let {
		values,
		shape,
		callsMade,
		outcomes,
		pending = null,
		labels = null,
		class: className = ''
	}: Props = $props();

	let width = $state(360);
	let height = $state(260);
	const finished = $derived(callsMade >= shape.calls);

	const frame: Frame = $derived({
		width,
		height,
		padLeft: labels ? 8 : 4,
		padRight: labels ? 8 : 4,
		padTop: 20,
		padBottom: labels ? 34 : 20,
		contextShare: 0.5
	});

	const lastIndex = $derived(values.length - 1);

	// The line draws itself forward when a stretch is revealed.
	// svelte-ignore state_referenced_locally
	const drawEnd = new Tween(values.length - 1, { duration: 900, easing: cubicOut });
	// svelte-ignore state_referenced_locally
	const lo = new Spring(domainFor(values)[0], { stiffness: 0.08, damping: 0.55 });
	// svelte-ignore state_referenced_locally
	const hi = new Spring(domainFor(values)[1], { stiffness: 0.08, damping: 0.55 });

	$effect(() => {
		const instant = prefersReducedMotion.current;
		const [a, b] = domainFor(values);
		if (instant) {
			drawEnd.set(lastIndex, { duration: 0 });
			lo.set(a, { instant: true });
			hi.set(b, { instant: true });
		} else {
			drawEnd.target = lastIndex;
			lo.target = a;
			hi.target = b;
		}
	});

	const domain = $derived([lo.current, hi.current] as [number, number]);
	const x = (i: number) => xFor(i, shape, frame);
	const y = (v: number) => yFor(v, domain, frame);

	const pathOf = line<[number, number]>()
		.x((p) => x(p[0]))
		.y((p) => y(p[1]))
		.curve(curveMonotoneX);

	const areaOf = $derived(
		area<[number, number]>()
			.x((p) => x(p[0]))
			.y0(height - frame.padBottom)
			.y1((p) => y(p[1]))
			.curve(curveMonotoneX)
	);

	const contextEnd = $derived(shape.contextBars - 1);

	const contextPath = $derived(pathOf(pointsFor(values, 0, contextEnd, drawEnd.current)) ?? '');
	const fillPath = $derived(areaOf(pointsFor(values, 0, lastIndex, drawEnd.current)) ?? '');

	const segments = $derived(
		outcomes.slice(0, callsMade).map((dir, k) => {
			const from = contextEnd + k * shape.stepBars;
			const to = from + shape.stepBars;
			return {
				dir,
				d:
					drawEnd.current > from ? (pathOf(pointsFor(values, from, to, drawEnd.current)) ?? '') : ''
			};
		})
	);

	const head = $derived.by(() => {
		const end = Math.min(drawEnd.current, lastIndex);
		const pts = pointsFor(values, Math.floor(end), Math.ceil(end), end);
		const p = pts[pts.length - 1] ?? [lastIndex, values[lastIndex]];
		return { x: x(p[0]), y: y(p[1]) };
	});

	const slots = $derived(
		Array.from({ length: shape.calls }, (_, k) => {
			const [x0, x1] = slotBounds(k + 1, shape, frame);
			return { step: k + 1, x0, x1 };
		})
	);

	const nextStep = $derived(finished ? null : callsMade + 1);
	const lastValue = $derived(values[lastIndex]);
	const levelY = $derived(y(lastValue));

	const fmtDate = (iso: string) =>
		new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
			month: 'short',
			year: 'numeric',
			timeZone: 'UTC'
		});
	const fmtPrice = (n: number) =>
		n >= 100 ? `$${Math.round(n)}` : n >= 10 ? `$${n.toFixed(1)}` : `$${n.toFixed(2)}`;

	const priceLabels = $derived.by(() => {
		if (!labels) return null;
		const scale = labels.closes[contextEnd] / values[contextEnd];
		let iMax = 0;
		let iMin = 0;
		values.forEach((v, i) => {
			if (v > values[iMax]) iMax = i;
			if (v < values[iMin]) iMin = i;
		});
		return [
			{ i: iMax, text: fmtPrice(values[iMax] * scale), above: true },
			{ i: iMin, text: fmtPrice(values[iMin] * scale), above: false }
		];
	});
</script>

<div
	class="chart {className}"
	bind:clientWidth={width}
	bind:clientHeight={height}
	role="img"
	aria-label={finished
		? 'The full price chart, unmasked.'
		: `Price chart. ${callsMade} of ${shape.calls} calls made. The shaded slot on the right is what happens next.`}
>
	<svg {width} {height} viewBox="0 0 {width} {height}" aria-hidden="true">
		<defs>
			<linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stop-color="var(--chart-ink)" stop-opacity="0.10" />
				<stop offset="1" stop-color="var(--chart-ink)" stop-opacity="0" />
			</linearGradient>
		</defs>

		<!-- The future: one rounded slot per call. -->
		{#each slots as s (s.step)}
			{@const isNext = s.step === nextStep}
			{@const done = s.step <= callsMade}
			<rect
				class="slot"
				class:next={isNext}
				class:done
				x={s.x0 + 1.5}
				y={frame.padTop - 12}
				width={Math.max(0, s.x1 - s.x0 - 3)}
				height={Math.max(0, height - frame.padTop - frame.padBottom + 24)}
				rx="12"
			/>
		{/each}

		{#if nextStep && !pending}
			{@const [sx0, sx1] = slotBounds(nextStep, shape, frame)}
			<line class="level" x1={head.x} x2={sx1 - 6} y1={levelY} y2={levelY} stroke-dasharray="2 5" />
			<text class="hint" x={(sx0 + sx1) / 2} y={frame.padTop + 2} text-anchor="middle">▲</text>
			<text class="hint" x={(sx0 + sx1) / 2} y={height - frame.padBottom + 4} text-anchor="middle"
				>▼</text
			>
		{/if}

		{#if pending && nextStep}
			{@const [sx0, sx1] = slotBounds(nextStep, shape, frame)}
			<g class="ghost {pending}">
				<line
					x1={head.x}
					y1={levelY}
					x2={sx1 - 8}
					y2={pending === 'up' ? frame.padTop + 6 : height - frame.padBottom - 6}
					stroke-dasharray="3 6"
				/>
				<circle cx={(sx0 + sx1) / 2} cy={levelY} r="3" />
			</g>
		{/if}

		<path class="fill" d={fillPath} fill="url(#chart-fill)" />
		<path class="line context" d={contextPath} />
		{#each segments as seg, k (k)}
			<path class="line seg {seg.dir}" d={seg.d} />
		{/each}

		<g class="head" transform="translate({head.x} {head.y})">
			<circle class="halo" r="9" />
			<circle class="dot" r="4" />
		</g>

		{#if labels && priceLabels}
			{#each priceLabels as pl (pl.above)}
				<text
					class="price"
					x={Math.min(Math.max(x(pl.i), 24), width - 24)}
					y={y(values[pl.i]) + (pl.above ? -10 : 18)}
					text-anchor="middle">{pl.text}</text
				>
			{/each}
			<text class="date" x={frame.padLeft} y={height - 8}>{fmtDate(labels.dates[0])}</text>
			<text class="date" x={width - frame.padRight} y={height - 8} text-anchor="end"
				>{fmtDate(labels.dates[labels.dates.length - 1])}</text
			>
		{/if}
	</svg>
</div>

<style>
	.chart {
		--chart-ink: var(--chart-line, currentColor);
		width: 100%;
		height: 100%;
		color: var(--chart-ink);
	}
	svg {
		display: block;
		overflow: visible;
	}
	.line {
		fill: none;
		stroke-width: 2.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.context {
		stroke: var(--chart-ink);
	}
	.seg.up {
		stroke: var(--chart-up);
		stroke-width: 3;
	}
	.seg.down {
		stroke: var(--chart-down);
		stroke-width: 3;
	}
	.slot {
		fill: var(--chart-mask);
		opacity: 0.55;
		transition:
			opacity 300ms ease,
			fill 300ms ease;
	}
	.slot.next {
		fill: var(--md-sys-color-surface-container-highest);
		opacity: 1;
	}
	.slot.done {
		opacity: 0;
	}
	.level {
		stroke: var(--chart-baseline);
		stroke-width: 1.5;
		opacity: 0.8;
	}
	.hint {
		font-size: 10px;
		fill: var(--chart-axis);
		opacity: 0.7;
	}
	.ghost line {
		stroke-width: 2;
		opacity: 0.6;
	}
	.ghost.up line,
	.ghost.up circle {
		stroke: var(--chart-up);
		fill: var(--chart-up);
	}
	.ghost.down line,
	.ghost.down circle {
		stroke: var(--chart-down);
		fill: var(--chart-down);
	}
	.halo {
		fill: var(--chart-ink);
		opacity: 0.12;
	}
	.dot {
		fill: var(--chart-ink);
	}
	.price,
	.date {
		font-size: 11px;
		font-variant-numeric: tabular-nums;
		fill: var(--chart-axis);
	}
	.price {
		font-weight: 600;
	}
</style>
