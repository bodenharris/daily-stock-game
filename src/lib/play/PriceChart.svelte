<script lang="ts">
	import { area, curveLinear, line } from 'd3-shape';
	import { Spring, Tween, prefersReducedMotion } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import type { CallResult, Direction } from './types.ts';
	import { domainFor, pointsFor, slotBounds, xFor, type ChartShape, type Frame } from './layout.ts';

	interface Props {
		/** Visible values (normalised or real, the chart only cares about shape). */
		values: number[];
		shape: ChartShape;
		/** Calls settled on the server (their stretches are in `values`). */
		callsMade: number;
		/** Settled calls, for colouring each stretch by whether the player was right. */
		results: CallResult[];
		/** The call being placed right now. */
		pending?: Direction | null;
		/** Show dates and prices (after the unmasking). */
		labels?: { dates: string[]; closes: number[] } | null;
		class?: string;
	}

	let {
		values,
		shape,
		callsMade,
		results,
		pending = null,
		labels = null,
		class: className = ''
	}: Props = $props();

	const uid = $props.id();
	let width = $state(0);
	let height = $state(0);
	const finished = $derived(callsMade >= shape.calls);

	const frame: Frame = $derived({
		width,
		height,
		padLeft: 4,
		padRight: 4,
		padTop: labels ? 26 : 14,
		padBottom: labels ? 30 : 16,
		contextShare: 0.5
	});

	// Prices are drawn on a log scale: equal % moves look equal, so one spike can't flatten
	// everything before it.
	const logs = $derived(values.map((v) => Math.log(v)));
	const lastIndex = $derived(values.length - 1);

	// The line draws itself forward when a stretch is revealed.
	// svelte-ignore state_referenced_locally
	const drawEnd = new Tween(values.length - 1, { duration: 900, easing: cubicOut });
	// svelte-ignore state_referenced_locally
	const lo = new Spring(domainFor(logs, 0.1)[0], { stiffness: 0.08, damping: 0.6 });
	// svelte-ignore state_referenced_locally
	const hi = new Spring(domainFor(logs, 0.1)[1], { stiffness: 0.08, damping: 0.6 });

	$effect(() => {
		const instant = prefersReducedMotion.current;
		const [a, b] = domainFor(logs, 0.1);
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

	const x = (i: number) => xFor(i, shape, frame);
	const y = (logValue: number) => {
		const h = Math.max(1, height - frame.padTop - frame.padBottom);
		return frame.padTop + (1 - (logValue - lo.current) / (hi.current - lo.current || 1)) * h;
	};

	const pathOf = line<[number, number]>()
		.x((p) => x(p[0]))
		.y((p) => y(p[1]))
		.curve(curveLinear);

	const areaOf = $derived(
		area<[number, number]>()
			.x((p) => x(p[0]))
			.y0(height - frame.padBottom)
			.y1((p) => y(p[1]))
			.curve(curveLinear)
	);

	const contextEnd = $derived(shape.contextBars - 1);
	const contextPath = $derived(pathOf(pointsFor(logs, 0, contextEnd, drawEnd.current)) ?? '');
	const fillPath = $derived(areaOf(pointsFor(logs, 0, lastIndex, drawEnd.current)) ?? '');

	const segments = $derived(
		results.slice(0, callsMade).map((r, k) => {
			const from = contextEnd + k * shape.stepBars;
			const to = from + shape.stepBars;
			const [x0, x1] = slotBounds(k + 1, shape, frame);
			return {
				step: r.step,
				right: r.correct,
				d: drawEnd.current > from ? (pathOf(pointsFor(logs, from, to, drawEnd.current)) ?? '') : '',
				drawn: drawEnd.current >= to - 0.01,
				move: values[to] / values[from] - 1,
				cx: (x0 + x1) / 2
			};
		})
	);

	const head = $derived.by(() => {
		const end = Math.min(drawEnd.current, lastIndex);
		const pts = pointsFor(logs, Math.floor(end), Math.ceil(end), end);
		const p = pts[pts.length - 1] ?? [lastIndex, logs[lastIndex]];
		return { x: x(p[0]), y: y(p[1]) };
	});

	const slots = $derived(
		Array.from({ length: shape.calls }, (_, k) => {
			const [x0, x1] = slotBounds(k + 1, shape, frame);
			return { step: k + 1, x0, x1 };
		})
	);

	const nextStep = $derived(finished ? null : callsMade + 1);
	const levelY = $derived(y(logs[lastIndex]));

	function fmtMove(m: number) {
		const pct = m * 100;
		const abs = Math.abs(pct);
		const body = abs >= 10 ? Math.round(abs).toString() : abs.toFixed(1);
		return `${pct >= 0 ? '+' : '−'}${body}%`;
	}
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

	/** A plain-language summary for screen readers. */
	const summary = $derived.by(() => {
		const ctx = values[contextEnd] / values[0] - 1;
		const parts = [`Price chart. Before the first call it moved ${fmtMove(ctx)}.`];
		for (const s of segments) {
			parts.push(
				`Call ${s.step}: ${fmtMove(s.move)}, ${s.right ? 'you were right' : 'you missed'}.`
			);
		}
		if (!finished) parts.push(`Call ${callsMade + 1} of ${shape.calls} is next.`);
		return parts.join(' ');
	});
</script>

<div
	class="chart {className}"
	bind:clientWidth={width}
	bind:clientHeight={height}
	role="img"
	aria-label={summary}
>
	{#if width > 0 && height > 0}
		<svg {width} {height} viewBox="0 0 {width} {height}" aria-hidden="true">
			<defs>
				<linearGradient id="{uid}-fill" x1="0" x2="0" y1="0" y2="1">
					<stop offset="0" stop-color="var(--chart-ink)" stop-opacity="0.09" />
					<stop offset="1" stop-color="var(--chart-ink)" stop-opacity="0" />
				</linearGradient>
			</defs>

			<!-- The future: one rounded slot per call. -->
			{#each slots as s (s.step)}
				<rect
					class="slot"
					class:next={s.step === nextStep}
					class:done={s.step <= callsMade}
					x={s.x0 + 1.5}
					y={frame.padTop - 4}
					width={Math.max(0, s.x1 - s.x0 - 3)}
					height={Math.max(0, height - frame.padTop - frame.padBottom + 8)}
					rx="10"
				/>
			{/each}

			{#if nextStep && !pending}
				{@const [, sx1] = slotBounds(nextStep, shape, frame)}
				<line class="level" x1={head.x} x2={sx1 - 5} y1={levelY} y2={levelY} />
			{/if}

			{#if pending && nextStep}
				{@const [sx0, sx1] = slotBounds(nextStep, shape, frame)}
				<g class="ghost" transform="translate({(sx0 + sx1) / 2} {levelY})">
					<path d={pending === 'up' ? 'M0 -18 L-7 -8 L7 -8 Z' : 'M0 18 L-7 8 L7 8 Z'} />
					<circle r="3" />
				</g>
			{/if}

			<path class="fill" d={fillPath} fill="url(#{uid}-fill)" />
			<path class="line context" d={contextPath} />
			{#each segments as seg (seg.step)}
				<path class="line seg" class:right={seg.right} class:wrong={!seg.right} d={seg.d} />
			{/each}

			<g class="head" transform="translate({head.x} {head.y})">
				<circle class="halo" r="8" />
				<circle class="dot" r="3.5" />
			</g>

			{#if labels && priceLabels}
				{#each priceLabels as pl (pl.above)}
					<text
						class="price"
						x={Math.min(Math.max(x(pl.i), 24), width - 24)}
						y={y(logs[pl.i]) + (pl.above ? -9 : 17)}
						text-anchor="middle">{pl.text}</text
					>
				{/each}
				<text class="date" x={frame.padLeft} y={height - 6}>{fmtDate(labels.dates[0])}</text>
				<text class="date" x={width - frame.padRight} y={height - 6} text-anchor="end"
					>{fmtDate(labels.dates[labels.dates.length - 1])}</text
				>
			{/if}
		</svg>
	{/if}
</div>

<style>
	.chart {
		--chart-ink: var(--chart-line, currentColor);
		width: 100%;
		height: 100%;
		color: var(--chart-ink);
	}
	svg {
		position: absolute;
		inset: 0;
		display: block;
		overflow: visible;
		animation: appear 300ms ease-out;
	}
	@keyframes appear {
		from {
			opacity: 0;
		}
	}
	.line {
		fill: none;
		stroke-width: 2.25;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.context {
		stroke: var(--chart-ink);
	}
	.seg {
		stroke-width: 3;
	}
	.seg.right {
		stroke: var(--chart-up);
	}
	.seg.wrong {
		stroke: var(--chart-down);
	}
	.move {
		font: 600 11px/1 var(--md-ref-typeface-plain, sans-serif);
		font-variant-numeric: tabular-nums;
		animation: appear 250ms ease-out;
	}
	.move.right {
		fill: var(--chart-up);
	}
	.move.wrong {
		fill: var(--chart-down);
	}
	.slot {
		fill: var(--chart-mask);
		opacity: 0.6;
		transition: opacity 300ms ease;
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
		stroke-dasharray: 3 4;
	}
	.ghost path,
	.ghost circle {
		fill: var(--md-sys-color-primary);
	}
	.ghost {
		animation: appear 150ms ease-out;
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
		font: 500 11px/1 var(--md-ref-typeface-plain, sans-serif);
		font-variant-numeric: tabular-nums;
		fill: var(--chart-axis);
	}
	.price {
		font-weight: 600;
	}
	@media (prefers-reduced-motion: reduce) {
		svg,
		.move,
		.ghost {
			animation: none;
		}
	}
</style>
