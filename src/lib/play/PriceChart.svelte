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
	/** Radius of the right/wrong mark at the end of each stretch. */
	const MARK_R = 4;

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
	 * Stretches already settled when this game was loaded. Their flash and burst are
	 * skipped, so a reload doesn't replay every call at once.
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

	const segments = $derived.by(() => {
		// Read up front: deriveds are lazy, and read inside the map it would first be counted
		// after call 1 had already settled.
		const settled = settledOnLoad;
		return results.slice(0, callsMade).map((r, k) => {
			const from = contextEnd + k * shape.stepBars;
			const to = from + shape.stepBars;
			const [x0, x1] = slotBounds(k + 1, shape, frame);
			return {
				step: r.step,
				right: r.correct,
				d: drawEnd.current > from ? (pathOf(pointsFor(logs, from, to, drawEnd.current)) ?? '') : '',
				drawn: drawEnd.current >= to - 0.01,
				/** The server's move, so the chart says what the pips and the log say. */
				move: r.move / 100,
				/** The same stretch measured off the drawn values (may round differently). */
				drawnMove: values[to] / values[from] - 1,
				fresh: r.step > settled,
				x0,
				x1,
				baseY: y(logs[from]),
				endY: y(logs[to])
			};
		});
	});

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
		let move = Math.exp(head.log - logs[base]) - 1;
		// Ease the ticking value onto the server's move, so it lands on what the pips say.
		const seg = segments[k - 1];
		if (seg) move += (seg.move - seg.drawnMove) * Math.min(1, (head.end - base) / shape.stepBars);
		const price = labels ? fmtPrice(labels.closes[Math.round(head.end)]) : null;
		const text = price ?? fmtPixelMove(move);
		// Press Start advances 8px a glyph; a move also carries a 9px arrow and a 4px gap.
		const w = text.length * 8 + (price ? 0 : 13) + 14;
		const top = frame.padTop - 4;
		const bottom = height - frame.padBottom - 4;
		const clamp = (v: number) => Math.min(Math.max(v, top + 10), bottom - 10);
		// At the right edge the tag would sit on the line and the last mark: step it off, to the
		// side the line isn't on under the tag.
		let ty = head.y;
		const left = width - frame.padRight - w;
		if (head.x > left - MARK_R - 4) {
			const off = 20;
			let sum = 0;
			let n = 0;
			for (let i = Math.floor(head.end); i >= 0 && x(i) >= left - 8; i--) {
				sum += y(logs[i]);
				n++;
			}
			const last = segments.at(-1);
			const above = n > 0 && sum / n !== head.y ? sum / n > head.y : !last || last.move >= 0;
			ty = head.y + (above ? -off : off);
			if (clamp(ty) !== ty) ty = head.y + (above ? off : -off);
		}
		return {
			// Before the first call the setup's move would read like today's gain; after the last,
			// the stretch's move would read like the player's result. The real price is fine.
			show: labels != null || (k > 0 && (!finished || drawing)),
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
	const tape = $derived.by(() => {
		const items: { key: string; label: string; move: number; fresh: boolean }[] = [
			{ key: 'setup', label: 'SETUP', move: values[contextEnd] / values[0] - 1, fresh: false }
		];
		for (const s of segments) {
			if (s.drawn) {
				items.push({ key: `c${s.step}`, label: `CALL ${s.step}`, move: s.move, fresh: s.fresh });
			}
		}
		return items.reverse();
	});

	/**
	 * 9×5 pixel arrows: Press Start's ▲▼ fall back to a small system glyph. Five rows sit exactly
	 * centred on its seven-row digits.
	 */
	const ARROW_UP = 'M4 0h1v1h1v1h1v1h1v1h1v1h-9v-1h1v-1h1v-1h1v-1h1z';
	const ARROW_DOWN = 'M0 0h9v1h-1v1h-1v1h-1v1h-1v1h-1v-1h-1v-1h-1v-1h-1v-1h-1z';

	const slots = $derived(
		Array.from({ length: shape.calls }, (_, k) => {
			const [x0, x1] = slotBounds(k + 1, shape, frame);
			return { step: k + 1, x0, x1 };
		})
	);

	const nextStep = $derived(finished ? null : callsMade + 1);
	const levelY = $derived(y(logs[lastIndex]));
	/** The dashed level across the hidden future; not while a stretch draws (it would give it away). */
	const showLevel = $derived(nextStep != null && !pending && !drawing);

	/** A move as CallPips writes it. Rounded first, so 78.5% / 100 * 100 still reads +79%. */
	function fmtMove(m: number) {
		const pct = Number((m * 100).toFixed(6));
		const abs = Math.abs(pct);
		const body = abs >= 10 ? Math.round(abs).toString() : abs.toFixed(1);
		return `${pct >= 0 ? '+' : '−'}${body}%`;
	}
	/** The same, for Press Start: it has no −, but its hyphen is a full-width pixel minus. */
	const fmtPixelMove = (m: number) => fmtMove(m).replace('−', '-');
	const fmtDate = (iso: string) =>
		new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
			month: 'short',
			year: 'numeric',
			timeZone: 'UTC'
		});
	const fmtPrice = (n: number) =>
		n >= 100 ? `$${Math.round(n)}` : n >= 10 ? `$${n.toFixed(1)}` : `$${n.toFixed(2)}`;

	/** Rough width of a VT323 label at 14px (size-adjusted 125%: about 8.75px a glyph). */
	const labelW = (text: string) => text.length * 8.75;

	/** The axis dates, first and last, along the bottom edge. */
	const dates = $derived(
		labels ? [fmtDate(labels.dates[0]), fmtDate(labels.dates[labels.dates.length - 1])] : null
	);

	/** The high and low prices, above and below their points. */
	const priceLabels = $derived.by(() => {
		if (!labels || !dates) return null;
		let iMax = 0;
		let iMin = 0;
		values.forEach((v, i) => {
			if (v > values[iMax]) iMax = i;
			if (v < values[iMin]) iMin = i;
		});
		const at = (i: number, text: string, above: boolean) => {
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
		return [
			at(iMax, fmtPrice(labels.closes[iMax]), true),
			at(iMin, fmtPrice(labels.closes[iMin]), false)
		];
	});

	/**
	 * Faint gridlines at round % moves from today's level, so a big move has a sense of scale
	 * without giving away the price (hidden once the real prices are shown). Unlabelled: a
	 * "−50%" on the chart reads like a loss.
	 */
	const grid = $derived.by(() => {
		if (labels) return [];
		const base = logs[lastIndex];
		const up = Math.exp(hi.current - base) - 1;
		const down = 1 - Math.exp(lo.current - base);
		const span = Math.max(up, down);
		const step = [0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10].find((s) => span / s <= 1.6) ?? 20;
		const lines: { key: string; y: number }[] = [];
		// One line each way at most: enough for scale, never a busy axis.
		if (step <= up) lines.push({ key: 'up', y: y(base + Math.log(1 + step)) });
		if (step < down && step < 1) lines.push({ key: 'down', y: y(base + Math.log(1 - step)) });
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

<div class="chart {className}" bind:clientWidth={width} bind:clientHeight={height}>
	<!-- Ticker tape: the story so far, like the board on a trading floor. -->
	<div class="tape" style:height="{TAPE_H}px">
		<span class="tape-symbol" aria-hidden="true">
			<span class={['live', finished && 'closed']}></span>
			{ticker ?? '???'}
			<span class="tape-state">{finished ? 'CLOSED' : 'LIVE'}</span>
		</span>
		<div class="tape-window" aria-hidden="true">
			{#each tape as item (item.key)}
				<span class={['tape-item', item.move >= 0 ? 'up' : 'down', item.fresh && 'fresh']}>
					<span class="tape-label">{item.label}</span>
					<svg class="arrow" width="9" height="5" viewBox="0 0 9 5">
						<path d={item.move >= 0 ? ARROW_UP : ARROW_DOWN} />
					</svg>
					{fmtPixelMove(item.move)}
				</span>
			{/each}
		</div>
		{#if tools}
			<div class="tape-tools">{@render tools()}</div>
		{/if}
	</div>

	{#if width > 0 && height > 0}
		<svg
			class="plot"
			{width}
			{height}
			viewBox="0 0 {width} {height}"
			role="img"
			aria-label={summary}
		>
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
			{#each grid as g (g.key)}
				<line class="grid" x1={frame.padLeft} x2={width - frame.padRight} y1={g.y} y2={g.y} />
			{/each}

			<!-- The next call's slot, lit up. -->
			{#each slots as s (s.step)}
				<rect
					class="slot"
					class:next={s.step === nextStep}
					x={s.x0 + 1.5}
					y={frame.padTop - 4}
					width={Math.max(0, s.x1 - s.x0 - 3)}
					height={Math.max(0, height - frame.padTop - frame.padBottom + 8)}
				/>
			{/each}

			<!-- Today's level, ruled across the hidden future: above it is up, below is down. -->
			{#if showLevel && nextStep}
				{@const [sx0, sx1] = slotBounds(nextStep, shape, frame)}
				{@const cx = (sx0 + sx1) / 2}
				{@const upY = frame.padTop + 6}
				{@const downY = height - frame.padBottom - 2}
				<line
					class="level"
					x1={head.x}
					x2={width - frame.padRight}
					y1={Math.round(levelY)}
					y2={Math.round(levelY)}
				/>
				<!-- A chevron that would sit on the level just muddles it. -->
				{#if levelY - (upY + 6) > 12}
					<path class="slot-arrow" d="M{cx - 5} {upY + 6} L{cx} {upY} L{cx + 5} {upY + 6}" />
				{/if}
				{#if downY - 6 - levelY > 12}
					<path class="slot-arrow" d="M{cx - 5} {downY - 6} L{cx} {downY} L{cx + 5} {downY - 6}" />
				{/if}
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
			{#if tag.show}
				{#if !showLevel}
					<line class="last" x1={head.x} x2={width - frame.padRight} y1={head.y} y2={head.y} />
				{/if}
				<g
					class={['tag', tag.up ? 'up' : 'down']}
					transform="translate({width - frame.padRight} {Math.round(tag.y)})"
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
			{#each segments.filter((x) => x.drawn) as seg (seg.step)}
				{#if seg.fresh}
					<!-- The stretch's slot flashes green if the call was right, pink if not, and a
					     burst rings the end of the line. -->
					<rect
						class={['flash', seg.right ? 'right' : 'wrong']}
						x={seg.x0}
						y={frame.padTop - 4}
						width={Math.max(0, seg.x1 - seg.x0)}
						height={Math.max(0, height - frame.padTop - frame.padBottom + 8)}
					/>
					<circle
						class={['burst', seg.right ? 'right' : 'wrong']}
						cx={seg.x1}
						cy={seg.endY}
						r="6"
					/>
				{/if}
				<circle
					class="mark"
					class:right={seg.right}
					class:wrong={!seg.right}
					cx={seg.x1}
					cy={seg.endY}
					r={MARK_R}
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
				{#each priceLabels as pl (pl.key)}
					<text class="price" x={pl.x} y={pl.y} text-anchor="middle">{pl.text}</text>
				{/each}
				<text class="date" x={frame.padLeft} y={height - 6}>{dates?.[0]}</text>
				<text class="date" x={width - frame.padRight} y={height - 6} text-anchor="end"
					>{dates?.[1]}</text
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
		stroke: var(--chart-ink);
		color: var(--chart-ink);
	}
	.seg {
		stroke: var(--md-sys-color-primary);
		color: var(--md-sys-color-primary);
		stroke-width: 3;
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
		stroke: var(--chart-ink);
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
	/* VT323 at the type scale's label size (it has one weight: no faux bold). */
	.price,
	.date {
		font: 400 14px/1 var(--md-ref-typeface-plain, monospace);
		font-variant-numeric: tabular-nums;
		fill: var(--chart-axis);
	}
	.price {
		fill: var(--md-sys-color-on-surface);
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
	.tag text,
	.tag .arrow {
		font: 400 8px/1 var(--mono);
		font-variant-numeric: tabular-nums;
		fill: var(--pixel-ink, var(--md-sys-color-surface));
	}
	.arrow {
		shape-rendering: crispEdges;
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
	.flash.right {
		fill: var(--chart-up);
	}
	.flash.wrong {
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
		background: color-mix(in srgb, var(--md-sys-color-on-surface) 6%, transparent);
		/* Press Start 2P sits on an 8px grid: 8px or 16px, never in between. */
		font: 400 8px/1 var(--mono);
		font-variant-numeric: tabular-nums;
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
	.tape-item {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 100%;
		padding: 0 14px;
		color: var(--chart-axis);
	}
	/* A short rule between items (the list runs newest first, so it goes on the right). */
	.tape-item + .tape-item {
		background: linear-gradient(var(--tape-rule), var(--tape-rule)) right center / 1px 8px no-repeat;
		--tape-rule: color-mix(in srgb, var(--chart-axis) 25%, transparent);
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

	@media (prefers-reduced-motion: reduce) {
		.plot,
		.mark,
		.ghost,
		.ping,
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
