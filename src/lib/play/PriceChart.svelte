<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { area, curveLinear, line } from 'd3-shape';
	import { Spring, Tween, prefersReducedMotion } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import type { CallResult, Direction } from './types.ts';
	import { domainFor, pointsFor, slotBounds, xFor, type ChartShape, type Frame } from './layout.ts';
	import ChartScenery from './ChartScenery.svelte';

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
		/** The real ticker, once unmasked. Until then the tape shows "???". */
		ticker?: string | null;
		/** Buttons for the right end of the ticker tape (the marker's). */
		tools?: Snippet;
		class?: string;
	}

	let {
		values,
		shape,
		callsMade,
		results,
		pending = null,
		labels = null,
		ticker = null,
		tools,
		class: className = ''
	}: Props = $props();

	const uid = $props.id();
	let width = $state(0);
	let height = $state(0);
	const finished = $derived(callsMade >= shape.calls);

	/** Height of the ticker tape across the top of the chart. */
	const TAPE_H = 32;

	const frame: Frame = $derived({
		width,
		height,
		padLeft: 4,
		padRight: 4,
		padTop: TAPE_H + (labels ? 26 : 14),
		padBottom: labels ? 30 : 14,
		contextShare: 0.5
	});

	// Prices are drawn on a log scale: equal % moves look equal, so one spike can't flatten
	// everything before it.
	const logs = $derived(values.map((v) => Math.log(Math.max(v, 1e-6))));
	const lastIndex = $derived(values.length - 1);

	// The line draws itself forward when a stretch is revealed.
	// svelte-ignore state_referenced_locally
	const drawEnd = new Tween(values.length - 1, { duration: 900, easing: cubicOut });
	// svelte-ignore state_referenced_locally
	const lo = new Spring(domainFor(logs, 0.1)[0], { stiffness: 0.1, damping: 0.9 });
	// svelte-ignore state_referenced_locally
	const hi = new Spring(domainFor(logs, 0.1)[1], { stiffness: 0.1, damping: 0.9 });

	// The vertical range only ever grows during a game: revealing a stretch adds room for it but
	// never re-zooms what the player has already studied.
	// svelte-ignore state_referenced_locally
	let range = { first: values[0], length: values.length, lo: lo.target, hi: hi.target };
	/**
	 * Stretches already settled when this game was loaded. Their flash, burst and floating
	 * move are skipped, so a reload doesn't replay every call at once.
	 */
	const firstValue = $derived(values[0]);
	const settledOnLoad = $derived.by(() => {
		void firstValue; // a different game: recount from what it arrived with
		return untrack(() => callsMade);
	});
	$effect(() => {
		const instant = prefersReducedMotion.current;
		const [fa, fb] = domainFor(logs, 0.1);
		const sameGame = values[0] === range.first && values.length >= range.length;
		const a = sameGame ? Math.min(range.lo, fa) : fa;
		const b = sameGame ? Math.max(range.hi, fb) : fb;
		range = { first: values[0], length: values.length, lo: a, hi: b };
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
				fresh: r.step > settledOnLoad,
				x0,
				x1,
				baseY: y(logs[from]),
				endY: y(logs[to])
			};
		})
	);

	const head = $derived.by(() => {
		const end = Math.min(drawEnd.current, lastIndex);
		const pts = pointsFor(logs, Math.floor(end), Math.ceil(end), end);
		const p = pts[pts.length - 1] ?? [lastIndex, logs[lastIndex]];
		return { x: x(p[0]), y: y(p[1]), log: p[1], end };
	});

	/** True while a stretch is drawing itself in. */
	const drawing = $derived(drawEnd.current < lastIndex - 0.01);

	/**
	 * The last-price tag on the right edge, like a trading terminal. It shows the move of the
	 * stretch the line is in, ticking as the line draws (or the real price once unmasked).
	 */
	const tag = $derived.by(() => {
		const k =
			head.end <= contextEnd + 0.001
				? 0
				: Math.min(shape.calls, Math.ceil((head.end - contextEnd) / shape.stepBars - 0.001));
		const base = k === 0 ? 0 : contextEnd + (k - 1) * shape.stepBars;
		const move = Math.exp(head.log - logs[base]) - 1;
		const text = labels
			? fmtPrice(labels.closes[Math.round(head.end)])
			: `${move >= 0 ? '▲' : '▼'} ${fmtMove(move)}`;
		const w = text.length * 9 + 14;
		const top = frame.padTop - 4;
		const bottom = height - frame.padBottom - 4;
		return {
			up: move >= 0,
			text,
			w,
			y: Math.min(Math.max(head.y, top + 10), bottom - 10)
		};
	});

	/** The ticker tape: the setup, every settled call, and the calls still to come. */
	const tape = $derived.by(() => {
		const items: { key: string; label: string; move: number | null; fresh: boolean }[] = [
			{ key: 'setup', label: 'SETUP', move: values[contextEnd] / values[0] - 1, fresh: false }
		];
		const drawn = segments.filter((s) => s.drawn);
		for (const s of drawn) {
			items.push({ key: `c${s.step}`, label: `CALL ${s.step}`, move: s.move, fresh: s.fresh });
		}
		for (let k = drawn.length + 1; k <= shape.calls; k++) {
			items.push({ key: `c${k}`, label: `CALL ${k}`, move: null, fresh: false });
		}
		return items;
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
		let iMax = 0;
		let iMin = 0;
		values.forEach((v, i) => {
			if (v > values[iMax]) iMax = i;
			if (v < values[iMin]) iMin = i;
		});
		return [
			{ i: iMax, text: fmtPrice(labels.closes[iMax]), above: true },
			{ i: iMin, text: fmtPrice(labels.closes[iMin]), above: false }
		];
	});

	/**
	 * Faint gridlines at round % moves from today's level, so a big move has a sense of scale
	 * without giving away the price (hidden once the real prices are shown).
	 */
	const grid = $derived.by(() => {
		if (labels) return [];
		const base = logs[lastIndex];
		const up = Math.exp(hi.current - base) - 1;
		const down = 1 - Math.exp(lo.current - base);
		const span = Math.max(up, down);
		const step = [0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10].find((s) => span / s <= 1.6) ?? 20;
		const lines: { y: number; text: string }[] = [];
		// One line each way at most: enough for scale, never a busy axis.
		if (step <= up)
			lines.push({ y: y(base + Math.log(1 + step)), text: `+${Math.round(step * 100)}%` });
		if (step < down && step < 1) {
			lines.push({ y: y(base + Math.log(1 - step)), text: `−${Math.round(step * 100)}%` });
		}
		return lines;
	});

	/** A plain-language summary for screen readers. */
	const summary = $derived.by(() => {
		const ctx = values[contextEnd] / values[0] - 1;
		const parts = [`Price chart. Before the first call it moved ${fmtMove(ctx)}.`];
		for (const s of segments.filter((x) => x.drawn)) {
			const move = results.find((r) => r.step === s.step)?.move;
			parts.push(
				`Call ${s.step}: ${fmtMove(move == null ? s.move : move / 100)}, ${s.right ? 'you were right' : 'you missed'}.`
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
	<!-- Ticker tape: the story so far, scrolling like the board on a trading floor. -->
	<div class="tape" style:height="{TAPE_H}px" style:--tape-s="{tape.length * 3.5}s">
		<span class="tape-symbol" aria-hidden="true">
			<span class={['live', finished && 'closed']}></span>
			{ticker ?? '???'}
			<span class="tape-state">{finished ? 'CLOSED' : 'LIVE'}</span>
		</span>
		<div class="tape-window" aria-hidden="true">
			<div class="tape-track">
				{#each [0, 1] as copy (copy)}
					<div class="tape-copy">
						{#each tape as item (item.key)}
							<span
								class={[
									'tape-item',
									item.move == null ? 'tbd' : item.move >= 0 ? 'up' : 'down',
									item.fresh && 'fresh'
								]}
							>
								<span class="tape-label">{item.label}</span>
								{#if item.move == null}
									···
								{:else}
									{item.move >= 0 ? '▲' : '▼'} {fmtMove(item.move)}
								{/if}
							</span>
						{/each}
					</div>
				{/each}
			</div>
		</div>
		{#if tools}
			<div class="tape-tools">{@render tools()}</div>
		{/if}
	</div>

	{#if width > 0 && height > 0}
		<svg {width} {height} viewBox="0 0 {width} {height}" aria-hidden="true">
			<defs>
				<!-- Lines never spill into the header while the range eases out to fit a spike. -->
				<clipPath id="{uid}-plot">
					<rect x="-4" y={TAPE_H} width={width + 8} height={Math.max(0, height - TAPE_H)} />
				</clipPath>
				<linearGradient id="{uid}-fill" x1="0" x2="0" y1="0" y2="1">
					<stop offset="0" stop-color="var(--md-sys-color-primary)" stop-opacity="0.16" />
					<stop offset="1" stop-color="var(--md-sys-color-primary)" stop-opacity="0" />
				</linearGradient>
				<!-- Terminal graph paper. -->
				<pattern id="{uid}-paper" width="24" height="24" patternUnits="userSpaceOnUse">
					<path class="paper" d="M24 0 L0 0 L0 24" />
				</pattern>
				<linearGradient id="{uid}-scan" x1="0" x2="0" y1="0" y2="1">
					<stop offset="0" stop-color="var(--md-sys-color-primary)" stop-opacity="0" />
					<stop offset="0.5" stop-color="var(--md-sys-color-primary)" stop-opacity="0.55" />
					<stop offset="1" stop-color="var(--md-sys-color-primary)" stop-opacity="0" />
				</linearGradient>
			</defs>

			<rect
				x={frame.padLeft}
				y={frame.padTop - 4}
				width={Math.max(0, width - frame.padLeft - frame.padRight)}
				height={Math.max(0, height - frame.padTop - frame.padBottom + 8)}
				fill="url(#{uid}-paper)"
			/>
			<ChartScenery
				{uid}
				x0={frame.padLeft}
				x1={width - frame.padRight}
				top={frame.padTop - 4}
				bottom={height - frame.padBottom + 4}
			/>
			{#if !labels}
				<text class="watermark" x={width - frame.padRight - 4} y={height - frame.padBottom - 2}
					>WOLF EXCHANGE</text
				>
			{/if}

			{#each grid as g (g.text)}
				<line class="grid" x1={frame.padLeft} x2={width - frame.padRight} y1={g.y} y2={g.y} />
				<text class="grid-label" x={frame.padLeft + 2} y={g.y - 4}>{g.text}</text>
			{/each}

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
					rx="0"
				/>
			{/each}

			<!-- Not while a stretch draws: the level would show where the line lands before it does. -->
			{#if nextStep && !pending && !drawing}
				{@const [sx0, sx1] = slotBounds(nextStep, shape, frame)}
				<line class="level" x1={head.x} x2={sx1 - 4} y1={levelY} y2={levelY} />
				{@const cx = (sx0 + sx1) / 2}
				<path
					class="slot-arrow"
					d="M{cx - 5} {frame.padTop + 12} L{cx} {frame.padTop + 6} L{cx + 5} {frame.padTop + 12}"
				/>
				<path
					class="slot-arrow"
					d="M{cx - 5} {height - frame.padBottom - 8} L{cx} {height - frame.padBottom - 2} L{cx +
						5} {height - frame.padBottom - 8}"
				/>
			{/if}

			{#if pending && nextStep}
				{@const [sx0, sx1] = slotBounds(nextStep, shape, frame)}
				<g class="ghost" transform="translate({(sx0 + sx1) / 2} {levelY})">
					<path d={pending === 'up' ? 'M0 -18 L-7 -8 L7 -8 Z' : 'M0 18 L-7 8 L7 8 Z'} />
					<circle r="3" />
				</g>
			{/if}

			<g clip-path="url(#{uid}-plot)">
				<path class="fill" d={fillPath} fill="url(#{uid}-fill)" />
				<path class="line context" d={contextPath} />
				{#each segments as seg (seg.step)}
					<!-- Where this stretch started: above this line is up, below is down. -->
					<line class="base" x1={seg.x0} x2={seg.x1} y1={seg.baseY} y2={seg.baseY} />
					<!-- Revealed stretches wear the brand colour; right or wrong is marked at their end. -->
					<path class="line seg" d={seg.d} />
				{/each}
			</g>

			<!-- The scanner sweeps along with the line while a stretch draws in. -->
			{#if drawing}
				<rect
					class="scan"
					x={head.x - 1}
					y={frame.padTop - 4}
					width="2"
					height={Math.max(0, height - frame.padTop - frame.padBottom + 8)}
					fill="url(#{uid}-scan)"
				/>
			{/if}

			<!-- The last price, ruled across to its tag on the right edge. -->
			<line class="last" x1={head.x} x2={width - frame.padRight} y1={head.y} y2={head.y} />
			<g
				class={['tag', tag.up ? 'up' : 'down']}
				transform="translate({width - frame.padRight} {tag.y})"
			>
				<rect x={-tag.w} y="-10" width={tag.w} height="20" rx="0" />
				<text x="-7" y="4" text-anchor="end">{tag.text}</text>
			</g>

			<!-- Right or wrong marks the end of each stretch, once it has fully drawn. -->
			{#each segments.filter((x) => x.drawn) as seg (seg.step)}
				{#if seg.fresh}
					<!-- The stretch's slot flashes the colour of its move, then a burst and the move
					     itself float off the end of the line. -->
					<rect
						class={['flash', seg.move >= 0 ? 'up' : 'down']}
						x={seg.x0}
						y={frame.padTop - 4}
						width={Math.max(0, seg.x1 - seg.x0)}
						height={Math.max(0, height - frame.padTop - frame.padBottom + 8)}
					/>
					<g transform="translate({seg.x1} {seg.endY})">
						<circle class={['burst', seg.right ? 'right' : 'wrong']} r="6" />
						<g class={['float', seg.move >= 0 ? 'up' : 'down']}>
							<text y={seg.move >= 0 ? -14 : 24} text-anchor="middle"
								>{seg.move >= 0 ? '▲' : '▼'} {fmtMove(seg.move)}</text
							>
						</g>
					</g>
				{/if}
				<circle
					class="mark"
					class:right={seg.right}
					class:wrong={!seg.right}
					cx={seg.x1}
					cy={seg.endY}
					r="4"
				/>
			{/each}

			<g class="head" transform="translate({head.x} {head.y})">
				{#if !finished}
					<circle class="ping" r="8" />
				{/if}
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
	/* Arcade vector-display line: square ends, bevelled corners, a soft phosphor glow. */
	.line {
		fill: none;
		stroke-width: 2.5;
		stroke-linecap: square;
		stroke-linejoin: bevel;
		filter: drop-shadow(0 0 4px color-mix(in srgb, currentColor 55%, transparent));
	}
	.context {
		stroke: var(--chart-ink);
		color: var(--chart-ink);
	}
	.seg {
		stroke: var(--md-sys-color-primary);
		color: var(--md-sys-color-primary);
		stroke-width: 3;
	}
	.slot {
		fill: none;
		stroke: var(--md-sys-color-outline-variant);
		stroke-width: 1;
		stroke-dasharray: 2 4;
		transition:
			opacity 300ms ease,
			fill 250ms ease;
	}
	.slot.next {
		fill: color-mix(in srgb, var(--md-sys-color-primary-container) 55%, transparent);
		stroke: none;
	}
	.slot.done {
		opacity: 0;
	}
	.base {
		stroke: var(--chart-baseline);
		stroke-width: 1;
		stroke-dasharray: 2 4;
		opacity: 0.55;
	}
	.level {
		stroke: var(--chart-ink);
		stroke-width: 2;
		stroke-dasharray: 4 4;
		opacity: 0.7;
	}
	.slot-arrow {
		fill: none;
		stroke: var(--md-sys-color-on-primary-container);
		stroke-width: 2;
		stroke-linecap: square;
		stroke-linejoin: miter;
		opacity: 0.7;
	}
	.mark {
		stroke: var(--md-sys-color-surface);
		stroke-width: 2;
		animation: appear 200ms ease-out;
	}
	.mark.right {
		fill: var(--chart-up);
	}
	.mark.wrong {
		fill: var(--chart-down);
	}
	.grid {
		stroke: var(--chart-grid);
		stroke-width: 1;
		opacity: 0.6;
	}
	.grid-label {
		font: 400 12px/1 var(--md-ref-typeface-plain, monospace);
		font-variant-numeric: tabular-nums;
		fill: var(--chart-axis);
		opacity: 0.8;
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
	/* ── Trading-floor dressing ─────────────────────────────────────────────── */
	.chart {
		--mono: var(--md-ref-typeface-pixel, ui-monospace, monospace);
	}
	.paper {
		fill: none;
		stroke: var(--chart-grid);
		stroke-width: 1;
		opacity: 0.28;
	}
	.watermark {
		font: 400 7px/1 var(--mono);
		letter-spacing: 0.3em;
		text-anchor: end;
		fill: var(--chart-axis);
		opacity: 0.35;
	}
	.last {
		stroke: var(--chart-ink);
		stroke-width: 1;
		stroke-dasharray: 1 3;
		opacity: 0.5;
	}
	.tag rect {
		transition: fill 250ms ease;
	}
	.tag.up rect {
		fill: var(--chart-up);
	}
	.tag.down rect {
		fill: var(--chart-down);
	}
	.tag text {
		font: 400 9px/1 var(--mono);
		font-variant-numeric: tabular-nums;
		fill: var(--pixel-ink, var(--md-sys-color-surface));
	}
	.scan {
		pointer-events: none;
	}
	.ping {
		fill: none;
		stroke: var(--md-sys-color-primary);
		stroke-width: 2;
		transform-box: fill-box;
		transform-origin: center;
		animation: ping 1.6s ease-out infinite;
	}
	@keyframes ping {
		from {
			transform: scale(0.6);
			opacity: 0.8;
		}
		to {
			transform: scale(2.4);
			opacity: 0;
		}
	}
	.flash {
		opacity: 0;
		animation: flash 900ms ease-out;
	}
	.flash.up {
		fill: var(--chart-up);
	}
	.flash.down {
		fill: var(--chart-down);
	}
	@keyframes flash {
		from {
			opacity: 0.32;
		}
		to {
			opacity: 0;
		}
	}
	.burst {
		fill: none;
		stroke-width: 2.5;
		opacity: 0;
		transform-box: fill-box;
		transform-origin: center;
		animation: burst 700ms ease-out;
	}
	.burst.right {
		stroke: var(--chart-up);
	}
	.burst.wrong {
		stroke: var(--chart-down);
	}
	@keyframes burst {
		from {
			transform: scale(0.5);
			opacity: 1;
		}
		to {
			transform: scale(3.2);
			opacity: 0;
		}
	}
	.float {
		opacity: 0;
		animation: float 1.8s ease-out;
	}
	.float text {
		font: 400 10px/1 var(--mono);
		font-variant-numeric: tabular-nums;
	}
	.float.up text {
		fill: var(--chart-up);
	}
	.float.down text {
		fill: var(--chart-down);
	}
	@keyframes float {
		0% {
			opacity: 0;
			transform: translateY(6px) scale(0.8);
		}
		15% {
			opacity: 1;
			transform: translateY(0) scale(1.1);
		}
		70% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translateY(-18px) scale(1);
		}
	}

	/* The tape. */
	.tape-tools {
		display: flex;
		flex: none;
		align-items: center;
		gap: 2px;
		padding: 0 2px;
		background: color-mix(in srgb, var(--md-sys-color-primary) 18%, transparent);
	}
	.tape {
		position: absolute;
		inset: 0 0 auto;
		z-index: 3; /* over the marker layer, so its buttons stay reachable while drawing */
		display: flex;
		align-items: stretch;
		overflow: hidden;
		border-radius: 0;
		background: color-mix(in srgb, var(--md-sys-color-on-surface) 6%, transparent);
		font: 400 9px/1 var(--mono);
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.04em;
		white-space: nowrap;
	}
	.tape-symbol {
		display: flex;
		flex: none;
		align-items: center;
		gap: 0.4rem;
		padding: 0 0.6rem;
		background: color-mix(in srgb, var(--md-sys-color-primary) 18%, transparent);
		color: var(--md-sys-color-on-surface);
		font-weight: 800;
	}
	.tape-state {
		font-size: 7px;
		opacity: 0.7;
	}
	.live {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--chart-up);
		animation: blink 1.2s steps(2, jump-none) infinite;
	}
	.live.closed {
		background: var(--chart-axis);
		animation: none;
	}
	@keyframes blink {
		50% {
			opacity: 0.2;
		}
	}
	.tape-window {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		mask-image: linear-gradient(
			90deg,
			transparent,
			#000 1.5rem,
			#000 calc(100% - 1.5rem),
			transparent
		);
	}
	.tape-track {
		display: flex;
		width: max-content;
		height: 100%;
		animation: tape var(--tape-s, 20s) linear infinite;
	}
	.tape-copy {
		display: flex;
		align-items: center;
		flex: none;
		min-width: 100%;
	}
	@keyframes tape {
		to {
			transform: translateX(-50%);
		}
	}
	.tape-item {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0 0.9rem;
		color: var(--chart-axis);
	}
	.tape-item + .tape-item {
		border-left: 1px solid color-mix(in srgb, var(--chart-axis) 25%, transparent);
	}
	.tape-label {
		color: var(--md-sys-color-on-surface);
	}
	.tape-item.up {
		color: var(--chart-up);
	}
	.tape-item.down {
		color: var(--chart-down);
	}
	.tape-item.fresh {
		animation: tape-in 1.2s ease-out;
	}
	@keyframes tape-in {
		0%,
		40% {
			background: color-mix(in srgb, currentColor 30%, transparent);
		}
		100% {
			background: transparent;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		svg,
		.move,
		.ghost,
		.ping,
		.live,
		.tape-item.fresh,
		.tape-track {
			animation: none;
		}
		.ping,
		.flash,
		.burst,
		.float,
		.scan {
			display: none;
		}
	}
</style>
