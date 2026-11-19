<script lang="ts">
	import { untrack } from 'svelte';
	import { Spring, Tween, prefersReducedMotion } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import Highlighter from '@lucide/svelte/icons/highlighter';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import Eraser from '@lucide/svelte/icons/eraser';
	import { IconButton } from '#lib/components/ui/icon-button/index.js';
	import { formatDate, formatMove, formatPrice } from './format.ts';
	import {
		barFor,
		domainFor,
		pointsFor,
		slotBounds,
		xFor,
		type ChartPoint,
		type ChartShape,
		type Frame
	} from './layout.ts';
	import { Marker } from './marker.svelte.ts';
	import ChartScenery from './ChartScenery.svelte';
	import MarkerLayer from './MarkerLayer.svelte';
	import type { CallResult, Direction, Reveal } from './types.ts';

	/**
	 * The hidden chart, as a trading terminal: a ticker tape on top, the price line on a log
	 * scale over a night city, an empty slot per call to come, and the player's red marker.
	 * One instance per game: the line only ever grows while it lives.
	 */
	let {
		values,
		shape,
		results,
		pending = null,
		reveal = null,
		span = null,
		marks,
		class: className
	}: {
		/** Visible bars, normalised (the chart only cares about shape). */
		values: number[];
		shape: ChartShape;
		/** Settled calls; their stretches are in `values`. */
		results: CallResult[];
		/** The call being placed right now. */
		pending?: Direction | null;
		/** Once unmasked: the ticker, and a date and quoted price for every bar. */
		reveal?: Pick<Reveal, 'ticker' | 'dates' | 'closes'> | null;
		/** First and last dates alone, for the axis before the unmasking (no prices). */
		span?: [string, string] | null;
		/** Where the red marker keeps this chart's strokes. */
		marks: string;
		class?: string;
	} = $props();

	/** Height of the ticker tape across the top of the chart. */
	const TAPE_H = 32;
	/** Radius of the right/wrong mark at the end of each stretch. */
	const MARK_R = 4;
	/**
	 * 9×5 pixel arrows: Press Start's ▲▼ fall back to a small system glyph. Five rows sit exactly
	 * centred on its seven-row digits.
	 */
	const ARROW_UP = 'M4 0h1v1h1v1h1v1h1v1h1v1h-9v-1h1v-1h1v-1h1v-1h1z';
	const ARROW_DOWN = 'M0 0h9v1h-1v1h-1v1h-1v1h-1v1h-1v-1h-1v-1h-1v-1h-1v-1h-1z';
	const RANGE_SPRING = { stiffness: 0.1, damping: 0.9 };

	const uid = $props.id();
	let width = $state(0);
	let height = $state(0);

	const marker = new Marker();
	$effect(() => marker.load(marks));

	const callsMade = $derived(results.length);
	const finished = $derived(callsMade >= shape.calls);
	const nextStep = $derived(finished ? null : callsMade + 1);
	const frame: Frame = $derived({
		width,
		height,
		padLeft: 4,
		padRight: 4,
		padTop: TAPE_H + (reveal ? 26 : 14),
		padBottom: reveal || span ? 30 : 14,
		contextShare: 0.5
	});
	/** The plot's top and bottom edges, a little outside the padded line area. */
	const top = $derived(frame.padTop - 4);
	const bottom = $derived(height - frame.padBottom + 4);

	// Prices are drawn on a log scale: equal % moves look equal, so one spike can't flatten
	// everything before it.
	const logs = $derived(values.map((v) => Math.log(Math.max(v, 1e-6))));
	const lastIndex = $derived(values.length - 1);
	const contextEnd = $derived(shape.contextBars - 1);
	/** How far the price moved before the first call. */
	const setupMove = $derived(values[contextEnd] / values[0] - 1);
	// Bars are only ever added, so this padded range only ever grows: a reveal makes room for its
	// stretch but never re-zooms the history the player has already studied.
	const domain = $derived(domainFor(logs, 0.1));

	// The line draws itself forward when a stretch is revealed, and the range eases out to fit.
	const drawEnd = new Tween(
		untrack(() => lastIndex),
		{ duration: 900, easing: cubicOut }
	);
	const lo = new Spring(
		untrack(() => domain[0]),
		RANGE_SPRING
	);
	const hi = new Spring(
		untrack(() => domain[1]),
		RANGE_SPRING
	);
	$effect(() => {
		const instant = prefersReducedMotion.current;
		void drawEnd.set(lastIndex, instant ? { duration: 0 } : undefined);
		void lo.set(domain[0], { instant });
		void hi.set(domain[1], { instant });
	});
	/** True while a stretch is drawing itself in. */
	const drawing = $derived(drawEnd.current < lastIndex - 0.01);
	/**
	 * Stretches already settled when the chart appeared. Their flash and burst are skipped, so a
	 * reload doesn't replay every call at once.
	 */
	const settledOnLoad = untrack(() => callsMade);

	const plotH = $derived(Math.max(1, height - frame.padTop - frame.padBottom));
	const x = (bar: number) => xFor(bar, shape, frame);
	const y = (log: number) =>
		frame.padTop + (1 - (log - lo.current) / (hi.current - lo.current || 1)) * plotH;
	// The chart's live scale, for the marker: its strokes ease along when the range grows.
	const toPx = ([bar, log]: ChartPoint): [number, number] => [x(bar), y(log)];
	const fromPx = ([px, py]: [number, number]): ChartPoint => [
		barFor(px, shape, frame),
		lo.current + (1 - (py - frame.padTop) / plotH) * (hi.current - lo.current || 1)
	];

	/** Straight lines between bars: curves on a two-bar stretch look invented. */
	const path = (points: ChartPoint[]) =>
		points.length ? `M${points.map(([bar, log]) => `${x(bar)},${y(log)}`).join('L')}` : '';

	const contextPath = $derived(path(pointsFor(logs, 0, contextEnd, drawEnd.current)));
	const fillPath = $derived.by(() => {
		const points = pointsFor(logs, 0, lastIndex, drawEnd.current);
		const base = height - frame.padBottom;
		return `${path(points)}L${x(points.at(-1)![0])},${base}L${x(0)},${base}Z`;
	});

	const segments = $derived(
		results.map((r, k) => {
			const from = contextEnd + k * shape.stepBars;
			const to = from + shape.stepBars;
			const [x0, x1] = slotBounds(k + 1, shape, frame);
			return {
				step: r.step,
				right: r.correct,
				d: drawEnd.current > from ? path(pointsFor(logs, from, to, drawEnd.current)) : '',
				drawn: drawEnd.current >= to - 0.01,
				/** The server's move, so the chart says what the pips and the log say. */
				move: r.move / 100,
				/** The same stretch measured off the drawn values (may round differently). */
				drawnMove: values[to] / values[from] - 1,
				fresh: r.step > settledOnLoad,
				x0,
				x1,
				baseY: y(logs[from]),
				endY: y(logs[to])
			};
		})
	);
	const drawn = $derived(segments.filter((s) => s.drawn));

	const head = $derived.by(() => {
		const end = Math.min(drawEnd.current, lastIndex);
		const [bar, log] = pointsFor(logs, Math.floor(end), Math.ceil(end), end).at(-1) ?? [
			lastIndex,
			logs[lastIndex]
		];
		return { x: x(bar), y: y(log), log, end };
	});

	/** A move as the pips write it, for Press Start: it has no −, but its hyphen is a pixel minus. */
	const pixelMove = (move: number) => formatMove(move * 100).replace('−', '-');

	/**
	 * The last-price tag on the right edge, like a trading terminal. It shows the move of the
	 * stretch the line is in, ticking as the line draws (or the real price once unmasked).
	 */
	const tag = $derived.by(() => {
		// The stretch the line's head is in: 0 for the setup, then each call.
		const k =
			head.end <= contextEnd + 0.001
				? 0
				: Math.min(shape.calls, Math.ceil((head.end - contextEnd) / shape.stepBars - 0.001));
		const base = k === 0 ? 0 : contextEnd + (k - 1) * shape.stepBars;
		let move = Math.exp(head.log - logs[base]) - 1;
		// Ease the ticking value onto the server's move, so it lands on what the pips say.
		const seg = segments[k - 1];
		if (seg) move += (seg.move - seg.drawnMove) * Math.min(1, (head.end - base) / shape.stepBars);
		const price = reveal ? formatPrice(reveal.closes[Math.round(head.end)]) : null;
		const text = price ?? pixelMove(move);
		// Press Start advances 8px a glyph; a move also carries a 9px arrow and a 4px gap.
		const w = text.length * 8 + (price ? 0 : 13) + 14;
		const clamp = (v: number) => Math.min(Math.max(v, top + 10), height - frame.padBottom - 14);
		// At the right edge the tag would sit on the line and the last mark: step it off, to the
		// side the line isn't on under the tag.
		let ty = head.y;
		const left = width - frame.padRight - w;
		if (head.x > left - MARK_R - 4) {
			let sum = 0;
			let n = 0;
			for (let i = Math.floor(head.end); i >= 0 && x(i) >= left - 8; i--) {
				sum += y(logs[i]);
				n++;
			}
			const last = segments.at(-1);
			const above = n > 0 && sum / n !== head.y ? sum / n > head.y : !last || last.move >= 0;
			ty = head.y + (above ? -20 : 20);
			if (clamp(ty) !== ty) ty = head.y + (above ? 20 : -20);
		}
		return {
			// Before the first call the setup's move would read like today's gain; after the last,
			// the stretch's move would read like the player's result. The real price is fine.
			show: reveal != null || (k > 0 && (!finished || drawing)),
			up: move >= 0,
			arrow: price == null,
			text,
			w,
			y: clamp(ty)
		};
	});

	/**
	 * The ticker tape: the setup, then every settled call. Listed newest first: the tape lays
	 * them out right to left, so when they run long the oldest drop out whole.
	 */
	const tape = $derived([
		...drawn
			.map((s) => ({ key: `c${s.step}`, label: `CALL ${s.step}`, move: s.move, fresh: s.fresh }))
			.reverse(),
		{ key: 'setup', label: 'SETUP', move: setupMove, fresh: false }
	]);

	const slots = $derived(
		Array.from({ length: shape.calls }, (_, k) => {
			const [x0, x1] = slotBounds(k + 1, shape, frame);
			return { step: k + 1, x0, x1, mid: (x0 + x1) / 2 };
		})
	);
	const next = $derived(nextStep == null ? null : slots[nextStep - 1]);
	const levelY = $derived(y(logs[lastIndex]));
	/** The dashed level across the hidden future; not while a stretch draws (it would give it away). */
	const showLevel = $derived(next != null && !pending && !drawing);

	/** The axis dates, first and last, along the bottom edge. */
	const dates = $derived(
		(reveal ? [reveal.dates[0], reveal.dates.at(-1)!] : span)?.map((d) =>
			formatDate(d, { month: 'short', year: 'numeric' })
		)
	);

	/** The high and low prices, above and below their points. */
	const priceLabels = $derived.by(() => {
		if (!reveal || !dates) return [];
		// Rough width of a VT323 label at 14px (size-adjusted 125%: about 8.75px a glyph).
		const labelW = (text: string) => text.length * 8.75;
		const at = (i: number, above: boolean) => {
			const text = formatPrice(reveal.closes[i]);
			const lx = Math.min(Math.max(x(i), 28), width - 28);
			const py = y(logs[i]);
			let ly = py + (above ? -9 : 20);
			// A low near a corner would print over the date there: put it above its point instead.
			const half = labelW(text) / 2;
			const onDate =
				lx - half < frame.padLeft + labelW(dates[0]) + 6 ||
				lx + half > width - frame.padRight - labelW(dates[1]) - 6;
			if (!above && onDate && ly > height - 6 - 14 - 4) ly = py - 9;
			return { key: above ? 'high' : 'low', text, x: lx, y: ly };
		};
		const high = values.indexOf(Math.max(...values));
		const low = values.indexOf(Math.min(...values));
		return [at(high, true), at(low, false)];
	});

	/**
	 * Faint gridlines at round % moves from today's level, so a big move has a sense of scale
	 * without giving away the price (hidden once the real prices are shown). Unlabelled: a
	 * "−50%" on the chart reads like a loss.
	 */
	const grid = $derived.by(() => {
		if (reveal) return [];
		const base = logs[lastIndex];
		const up = Math.exp(hi.current - base) - 1;
		const down = 1 - Math.exp(lo.current - base);
		const range = Math.max(up, down);
		const step = [0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10].find((s) => range / s <= 1.6) ?? 20;
		// One line each way at most: enough for scale, never a busy axis.
		const lines: { key: string; y: number }[] = [];
		if (step <= up) lines.push({ key: 'up', y: y(base + Math.log(1 + step)) });
		if (step < down && step < 1) lines.push({ key: 'down', y: y(base + Math.log(1 - step)) });
		return lines;
	});

	/** A plain-language summary for screen readers. */
	const summary = $derived(
		[
			`Price chart. Before the first call it moved ${formatMove(setupMove * 100)}.`,
			...drawn.map(
				(s) =>
					`Call ${s.step}: ${formatMove(s.move * 100)}, ${s.right ? 'you were right' : 'you missed'}.`
			),
			!finished && `Call ${callsMade + 1} of ${shape.calls} is next.`
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<div class={['chart', className]} bind:clientWidth={width} bind:clientHeight={height}>
	<!-- Ticker tape: the story so far, like the board on a trading floor. -->
	<div class="tape" style:height="{TAPE_H}px">
		<span class="tape-symbol" aria-hidden="true">
			<span class={['live', finished && 'closed']}></span>
			{reveal?.ticker ?? '???'}
			<span class="tape-state">{finished ? 'CLOSED' : 'LIVE'}</span>
		</span>
		<div class="tape-window" aria-hidden="true">
			{#each tape as item (item.key)}
				<span class={['tape-item', item.move >= 0 ? 'up' : 'down', item.fresh && 'fresh']}>
					<span class="tape-label">{item.label}</span>
					<svg class="arrow" width="9" height="5" viewBox="0 0 9 5">
						<path d={item.move >= 0 ? ARROW_UP : ARROW_DOWN} />
					</svg>
					{pixelMove(item.move)}
				</span>
			{/each}
		</div>
		<div class="tape-tools">
			<IconButton
				size="xs"
				toggle
				bind:pressed={marker.active}
				aria-label={marker.active ? 'Stop drawing' : 'Draw on the chart with a red marker'}
				title="Red marker"
			>
				<Highlighter />
			</IconButton>
			{#if marker.strokes.length > 0}
				<IconButton size="xs" aria-label="Undo the last mark" onclick={() => marker.undo()}>
					<Undo2 />
				</IconButton>
				<IconButton size="xs" aria-label="Clear all marks" onclick={() => marker.clear()}>
					<Eraser />
				</IconButton>
			{/if}
		</div>
	</div>

	{#if width > 0 && height > 0}
		{@const right = width - frame.padRight}
		{@const plotTall = Math.max(0, bottom - top)}
		<svg
			class="plot"
			{width}
			{height}
			viewBox="0 0 {width} {height}"
			role="img"
			aria-label={summary}
		>
			<defs>
				<!-- Lines never spill into the tape while the range eases out to fit a spike. -->
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
				y={top}
				width={Math.max(0, right - frame.padLeft)}
				height={plotTall}
				fill="url(#{uid}-paper)"
			/>
			<ChartScenery {uid} x0={frame.padLeft} x1={right} {top} {bottom} />
			{#each grid as g (g.key)}
				<line class="grid" x1={frame.padLeft} x2={right} y1={g.y} y2={g.y} />
			{/each}

			<!-- The next call's slot, lit up. -->
			{#each slots as s (s.step)}
				<rect
					class={['slot', s.step === nextStep && 'next']}
					x={s.x0 + 1.5}
					y={top}
					width={Math.max(0, s.x1 - s.x0 - 3)}
					height={plotTall}
				/>
			{/each}

			<!-- Today's level, ruled across the hidden future: above it is up, below is down. -->
			{#if showLevel && next}
				{@const upY = frame.padTop + 6}
				{@const downY = height - frame.padBottom - 2}
				<line
					class="level"
					x1={head.x}
					x2={right}
					y1={Math.round(levelY)}
					y2={Math.round(levelY)}
				/>
				<!-- A chevron that would sit on the level just muddles it. -->
				{#if levelY - (upY + 6) > 12}
					<path
						class="slot-arrow"
						d="M{next.mid - 5} {upY + 6} L{next.mid} {upY} L{next.mid + 5} {upY + 6}"
					/>
				{/if}
				{#if downY - 6 - levelY > 12}
					<path
						class="slot-arrow"
						d="M{next.mid - 5} {downY - 6} L{next.mid} {downY} L{next.mid + 5} {downY - 6}"
					/>
				{/if}
			{/if}

			{#if pending && next}
				<g class="ghost" transform="translate({next.mid} {levelY})">
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
					y={top}
					width="2"
					height={plotTall}
					fill="url(#{uid}-scan)"
				/>
			{/if}

			<!-- The last price, ruled across to its tag on the right edge. -->
			{#if tag.show}
				{#if !showLevel}
					<line class="last" x1={head.x} x2={right} y1={head.y} y2={head.y} />
				{/if}
				<g
					class={['tag', tag.up ? 'up' : 'down']}
					transform="translate({right} {Math.round(tag.y)})"
				>
					<rect x={-tag.w} y="-10" width={tag.w} height="20" />
					{#if tag.arrow}
						<path
							class="arrow"
							transform="translate({-tag.w + 7} -2)"
							d={tag.up ? ARROW_UP : ARROW_DOWN}
						/>
					{/if}
					<!-- Set from the left, so the glyphs land on whole pixels. -->
					<text x={-tag.w + (tag.arrow ? 20 : 7)} y="4">{tag.text}</text>
				</g>
			{/if}

			<!-- Right or wrong marks the end of each stretch, once it has fully drawn. -->
			{#each drawn as seg (seg.step)}
				{@const verdict = seg.right ? 'right' : 'wrong'}
				{#if seg.fresh}
					<!-- The stretch's slot flashes green if the call was right, pink if not, and a
					     burst rings the end of the line. -->
					<rect
						class={['flash', verdict]}
						x={seg.x0}
						y={top}
						width={Math.max(0, seg.x1 - seg.x0)}
						height={plotTall}
					/>
					<circle class={['burst', verdict]} cx={seg.x1} cy={seg.endY} r="6" />
				{/if}
				<circle class={['mark', verdict]} cx={seg.x1} cy={seg.endY} r={MARK_R} />
			{/each}

			<g class="head" transform="translate({head.x} {head.y})">
				{#if !finished}
					<circle class="ping" r="8" />
				{/if}
				<circle class="halo" r="8" />
				<circle class="dot" r="3.5" />
			</g>

			{#each priceLabels as pl (pl.key)}
				<text class="price" x={pl.x} y={pl.y} text-anchor="middle">{pl.text}</text>
			{/each}
			{#if dates}
				<text class="date" x={frame.padLeft} y={height - 6}>{dates[0]}</text>
				<text class="date" x={right} y={height - 6} text-anchor="end">{dates[1]}</text>
			{/if}
		</svg>
	{/if}
	<MarkerLayer {marker} {toPx} {fromPx} />
</div>

<style>
	.chart {
		width: 100%;
		height: 100%;
		color: var(--chart-line);
	}
	.plot {
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
		stroke: var(--chart-line);
	}
	.seg {
		stroke: var(--md-sys-color-primary);
		color: var(--md-sys-color-primary);
		stroke-width: 3;
	}
	.paper {
		fill: none;
		stroke: var(--chart-grid);
		stroke-width: 1;
		opacity: 0.28;
	}
	.grid {
		stroke: var(--chart-grid);
		stroke-width: 1;
		opacity: 0.6;
	}
	.slot {
		fill: transparent;
		transition: fill 250ms ease;
	}
	.slot.next {
		fill: color-mix(in srgb, var(--md-sys-color-primary-container) 55%, transparent);
	}
	.base {
		stroke: var(--chart-baseline);
		stroke-width: 1;
		stroke-dasharray: 2 4;
		opacity: 0.55;
	}
	.level {
		stroke: var(--chart-line);
		stroke-width: 2;
		stroke-dasharray: 6 4;
		opacity: 0.85;
		shape-rendering: crispEdges;
	}
	.slot-arrow {
		fill: none;
		stroke: var(--md-sys-color-on-primary-container);
		stroke-width: 2;
		stroke-linecap: square;
		stroke-linejoin: miter;
		opacity: 0.7;
	}
	.ghost {
		fill: var(--md-sys-color-primary);
		animation: appear 150ms ease-out;
	}
	.last {
		stroke: var(--chart-line);
		stroke-width: 1;
		stroke-dasharray: 1 3;
		opacity: 0.5;
	}
	.scan {
		pointer-events: none;
	}
	/* Green for a right call or a rise, pink for a miss or a fall. */
	.right,
	.up {
		--tone: var(--chart-up);
	}
	.wrong,
	.down {
		--tone: var(--chart-down);
	}
	.mark {
		fill: var(--tone);
		stroke: var(--md-sys-color-surface);
		stroke-width: 2;
		animation: appear 200ms ease-out;
	}
	.halo {
		fill: var(--chart-line);
		opacity: 0.12;
	}
	.dot {
		fill: var(--chart-line);
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
		fill: var(--tone);
		opacity: 0;
		animation: flash 900ms ease-out;
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
		stroke: var(--tone);
		stroke-width: 2.5;
		opacity: 0;
		transform-box: fill-box;
		transform-origin: center;
		animation: burst 700ms ease-out;
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
	/* VT323 at the type scale's label size (it has one weight: no faux bold). */
	.price,
	.date {
		font: 400 14px/1 var(--md-ref-typeface-plain);
		font-variant-numeric: tabular-nums;
		fill: var(--chart-axis);
	}
	.price {
		fill: var(--md-sys-color-on-surface);
	}
	.tag rect {
		fill: var(--tone);
		transition: fill 250ms ease;
	}
	.tag text,
	.tag .arrow {
		font: 400 8px/1 var(--md-ref-typeface-pixel);
		font-variant-numeric: tabular-nums;
		fill: var(--pixel-ink);
	}
	.arrow {
		shape-rendering: crispEdges;
	}

	/* The tape. Press Start 2P sits on an 8px grid: 8px or 16px, never in between. */
	.tape {
		position: absolute;
		inset: 0 0 auto;
		z-index: 3; /* over the marker layer, so its buttons stay reachable while drawing */
		display: flex;
		align-items: stretch;
		background: color-mix(in srgb, var(--md-sys-color-on-surface) 6%, transparent);
		font: 400 8px/1 var(--md-ref-typeface-pixel);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.tape-symbol,
	.tape-tools {
		display: flex;
		flex: none;
		align-items: center;
		background: color-mix(in srgb, var(--md-sys-color-primary) 18%, transparent);
	}
	.tape-symbol {
		gap: 0.4rem;
		padding: 0 0.6rem;
		color: var(--md-sys-color-on-surface);
	}
	.tape-tools {
		gap: 2px;
		padding: 0 2px;
	}
	.tape-state {
		color: var(--md-sys-color-on-surface-variant);
	}
	.live {
		width: 6px;
		height: 6px;
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
	/* Static, starting from the setup. Laid out from the newest call leftwards (the list is
	   newest first) and packed left; what doesn't fit wraps onto a hidden second line, so the
	   oldest calls drop out whole rather than being cut mid-glyph. */
	.tape-window {
		display: flex;
		flex: 1;
		flex-flow: row-reverse wrap;
		justify-content: flex-end;
		min-width: 0;
		overflow: hidden;
	}
	.tape-item {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 100%;
		padding: 0 14px;
		color: var(--tone);
	}
	/* A short rule between items (the list runs newest first, so it goes on the right). */
	.tape-item + .tape-item {
		--tape-rule: color-mix(in srgb, var(--chart-axis) 25%, transparent);
		background: linear-gradient(var(--tape-rule), var(--tape-rule)) right center / 1px 8px no-repeat;
	}
	.tape-label {
		color: var(--md-sys-color-on-surface);
	}
	/* Digits fill the top seven of the line's eight pixel rows: lift the arrow half a row (as
	   a whole pixel) to centre it on them. */
	.tape-item .arrow {
		flex: none;
		margin: -1px -2px 0 0;
		fill: currentColor;
	}
	.tape-item.fresh {
		animation: tape-in 1.2s ease-out;
	}
	@keyframes tape-in {
		0%,
		40% {
			background-color: color-mix(in srgb, currentColor 30%, transparent);
		}
		100% {
			background-color: transparent;
		}
	}
	/* On a phone the tape is too short to read as a story, so it keeps just the symbol and the
	   tools, sitting as two small chips on the chart's top edge. */
	@media (max-width: 767.98px) {
		.tape {
			background: transparent;
		}
		.tape-window {
			display: none;
		}
		.tape-tools {
			margin-left: auto;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.plot,
		.mark,
		.ghost,
		.live,
		.tape-item.fresh {
			animation: none;
		}
		.slot,
		.tag rect {
			transition: none;
		}
		.ping,
		.flash,
		.burst,
		.scan {
			display: none;
		}
	}
</style>
