<script lang="ts">
	import { untrack } from 'svelte';
	import { Tween, prefersReducedMotion } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import { pop } from '#lib/m3/transitions.ts';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import { Button } from '#lib/components/ui/button/index.js';
	import { START_BALANCE_CENTS, STAKE_OPTIONS } from '#lib/game/config.ts';
	import { getDay, getGame, makeCall } from '#lib/remote/game.remote.ts';
	import PriceChart from './PriceChart.svelte';
	import StakePicker from './StakePicker.svelte';
	import CallPips from './CallPips.svelte';
	import CallLog from './CallLog.svelte';
	import Reveal from './Reveal.svelte';
	import NameIt from './NameIt.svelte';
	import MarkerLayer from './MarkerLayer.svelte';
	import { Marker } from './marker.svelte.ts';
	import { IconButton } from '#lib/components/ui/icon-button/index.js';
	import Highlighter from '@lucide/svelte/icons/highlighter';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import Eraser from '@lucide/svelte/icons/eraser';
	import { dollars, percent } from './money.ts';
	import { sound } from '#lib/audio/sound.svelte.ts';
	import type { CallResult, Direction, GameView } from './types.ts';

	/** `archive`: a past day played from the archive, not today's chart. */
	let { view, archive = false }: { view: GameView; archive?: boolean } = $props();

	/** The red marker: the player's own notes on today's chart, kept in this browser. */
	const marker = new Marker();
	$effect(() => {
		marker.load(`thewolf:marks:${view.number}`);
	});

	/** How long the chart takes to draw a new stretch. Everything else waits for it. */
	const DRAW_MS = 900;

	let stakePercent = $state('25');
	let pending = $state<Direction | null>(null);
	let error = $state<string | null>(null);
	/** Set when a call settles in this session, so its result animates in. */
	let fresh = $state(false);

	/**
	 * Results the player has *seen*. The server answers instantly, but the dots, balance, result
	 * and next stakes only update once the chart has drawn the stretch, so nothing gives the
	 * outcome away before the line does.
	 */
	// svelte-ignore state_referenced_locally
	let shown = $state(view.results.length);
	$effect(() => {
		const total = view.results.length;
		if (total < shown) {
			shown = total; // new day or a different game
			return;
		}
		if (total === shown) return;
		const wait = prefersReducedMotion.current ? 0 : DRAW_MS;
		const id = setTimeout(() => (shown = total), wait);
		return () => clearTimeout(id);
	});

	const results = $derived(view.results.slice(0, shown));
	const latest = $derived<CallResult | null>(results.at(-1) ?? null);
	const revealing = $derived(shown < view.results.length);

	// After the fifth call lands, give it its own beat before the ending takes over.
	// svelte-ignore state_referenced_locally
	let endingReady = $state(view.finished);
	$effect(() => {
		if (!view.finished) {
			endingReady = false;
			return;
		}
		if (revealing || endingReady) return;
		const id = setTimeout(() => (endingReady = true), prefersReducedMotion.current ? 0 : 1800);
		return () => clearTimeout(id);
	});
	const finished = $derived(view.finished && !revealing && endingReady);

	// "Name the moment" sits between the last call and the unmasking. Once answered, the right
	// option stays on screen for a beat before the reveal takes over.
	let nameHold = $state(false);
	const naming = $derived(
		finished && !!view.nameIt && (!view.nameIt.answered || nameHold || !view.reveal)
	);
	const showReveal = $derived(finished && !!view.reveal && !naming);
	function answered(named: boolean) {
		fresh = true;
		nameHold = true;
		buzz(named ? [8, 60, 16] : 20);
		sound.play(named ? 'right' : 'wrong');
		setTimeout(() => (nameHold = false), prefersReducedMotion.current ? 0 : 1400);
	}

	// Back to the middle chip after each call, so a big bet is always a choice, never a leftover.
	// svelte-ignore state_referenced_locally
	let lastShown = shown;
	$effect(() => {
		if (shown !== lastShown) {
			lastShown = shown;
			stakePercent = '25';
		}
	});
	const balanceCents = $derived(latest?.balanceAfterCents ?? START_BALANCE_CENTS);
	const callsMade = $derived(view.results.length);

	// svelte-ignore state_referenced_locally
	const shownBalance = new Tween(balanceCents, { duration: 700, easing: cubicOut });
	$effect(() => {
		const target = balanceCents;
		shownBalance.set(target, { duration: prefersReducedMotion.current ? 0 : 700 });
	});

	/** The last call's result: the outcome and money first, then how the crowd called it. */
	const result = $derived.by(() => {
		if (!latest) return null;
		const total = latest.crowd.up + latest.crowd.down;
		const same = latest.direction === 'up' ? latest.crowd.up : latest.crowd.down;
		// Short enough to sit on one line of a phone, crowd bonus aside.
		const crowd =
			total <= 1
				? `You're the first to call this one.`
				: total <= 20
					? `${same} of ${total} called ${latest.direction}.`
					: `${percent(same / total)} called ${latest.direction} too.`;
		// A right call returns the stake, plus a crowd bonus when most players called it wrong.
		const bonus = latest.correct ? latest.deltaCents - latest.stakeCents : 0;
		return {
			outcome: `${latest.correct ? 'Right.' : 'Missed.'} ${dollars(latest.deltaCents, { sign: true })}.`,
			crowd: bonus > 0 ? `${crowd} Crowd bonus ${dollars(bonus, { sign: true })}.` : crowd
		};
	});

	/** How long each call covers, in plain words. */
	const stretch = $derived(
		view.stepBars === 1
			? 'the next day'
			: view.stepBars === 5
				? 'the next week'
				: view.stepBars === 10
					? 'the next two weeks'
					: view.stepBars >= 20 && view.stepBars <= 22
						? 'the next month'
						: `the next ${view.stepBars} trading days`
	);

	const stakeOptions = $derived(
		STAKE_OPTIONS.map((o) => ({
			value: String(o.percent),
			percent: o.percent,
			cents: Math.floor((balanceCents * o.percent) / 100)
		}))
	);

	function buzz(pattern: number | number[]) {
		// Phones only: desktops have no motor, and keyboard play has no tap to unlock it.
		if (!matchMedia('(pointer: coarse)').matches || !('vibrate' in navigator)) return;
		navigator.vibrate(pattern);
	}

	async function call(direction: Direction) {
		if (pending || revealing || view.finished) return;
		error = null;
		pending = direction;
		buzz(12);
		sound.play(direction === 'up' ? 'call-up' : 'call-down');
		try {
			const res = await makeCall({
				puzzleNumber: view.number,
				archive,
				step: callsMade + 1,
				direction,
				stakePercent: Number(stakePercent)
			});
			fresh = true;
			// The result is felt and heard as the line lands, not when the server answers.
			setTimeout(() => {
				buzz(res.result.correct ? [8, 60, 16] : 40);
				sound.play(res.result.correct ? 'right' : 'wrong');
			}, DRAW_MS);
		} catch (e) {
			const status = (e as { status?: number }).status;
			const message = (e as { body?: { message?: string } }).body?.message;
			if (status === 409) {
				// A new day started, or this call was already made in another tab: catch up.
				error = message ?? null;
				await (archive ? getDay(view.number) : getGame())
					.refresh()
					.catch(() => (error = 'Refresh the page to continue.'));
			} else if ((status === 429 || status === 503) && message) {
				error = message;
			} else {
				error = navigator.onLine
					? 'That call did not go through. Try again.'
					: 'You are offline. Try again when you are back.';
			}
		} finally {
			pending = null;
		}
	}

	const busy = $derived(!!pending || revealing || view.finished);

	/**
	 * Phones: the quiz and the unmasking land below the chart. Scroll the balance to the top so
	 * the balance, the chart and what comes next share one screen. Short phones go straight to
	 * the new part instead.
	 */
	function bringIntoView(node: HTMLElement) {
		if (!untrack(() => fresh) || !matchMedia('(max-width: 1023px)').matches) return;
		const balance = node.closest('.game')?.querySelector('.balance-row');
		const target = innerHeight < 680 || !balance ? (node.querySelector('h2') ?? node) : balance;
		scrollTo({
			top: target.getBoundingClientRect().top + scrollY - 16,
			behavior: prefersReducedMotion.current ? 'instant' : 'smooth'
		});
	}

	/** The unmasking gets its fanfare and howl, but only when it happens now, not on a reload. */
	function howl() {
		if (untrack(() => fresh)) sound.play('finale');
	}

	/** Keyboard play: ↑ / ↓ make the call, 1 / 2 / 3 pick the bet. Never while typing or in a sheet. */
	function onKey(e: KeyboardEvent) {
		if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey || busy) return;
		const t = e.target as HTMLElement | null;
		if (t?.closest('input, textarea, select, [contenteditable], [role="dialog"]')) return;
		if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
			e.preventDefault();
			void call(e.key === 'ArrowUp' ? 'up' : 'down');
			return;
		}
		const stake = STAKE_OPTIONS[Number(e.key) - 1];
		if (stake && stakePercent !== String(stake.percent)) {
			stakePercent = String(stake.percent);
			sound.play('select');
		}
	}
	/** The call in flight or being revealed, highlighted until the result lands. */
	const chosen = $derived<Direction | null>(
		pending ?? (revealing ? (view.results.at(-1)?.direction ?? null) : null)
	);
</script>

<!-- One calm announcement per call for screen readers (the visible numbers animate). -->
<p class="sr-only" aria-live="polite">
	{#if result}{result.outcome}
		{result.crowd} Balance {dollars(balanceCents, { cents: false })}.{/if}
</p>

<svelte:window onkeydown={onKey} />

<!-- Past days have a shorter header than the skyline, so the game can stand taller. -->
<div
	class={['game min-h-0 flex-1', view.finished && 'done']}
	style:--scene-h={archive ? 'var(--scene-h-compact, 3.5rem)' : undefined}
>
	<!-- Balance: the one number that matters. -->
	<div class="balance-row flex items-end justify-between gap-3 pt-1">
		<div>
			<p class="neon-text type-label-md lg:type-label-lg">
				{finished ? 'Final balance' : 'Balance'}
			</p>
			<p class="balance type-display-sm-emphasized text-on-surface type-numeric">
				{dollars(Math.round(shownBalance.current), { cents: false })}
			</p>
		</div>
		{#if finished}
			{@const change = view.balanceCents - START_BALANCE_CENTS}
			<span
				class="mb-1.5 rounded-none px-3 py-1 type-title-lg-emphasized type-numeric
				{change >= 0 ? 'bg-up-container text-on-up-container' : 'bg-down-container text-on-down-container'}"
				in:pop
			>
				{change >= 0 ? '+' : '−'}{Math.round((Math.abs(change) / START_BALANCE_CENTS) * 100)}%
			</span>
		{/if}
	</div>

	<!-- The chart is the hero. On wide screens it gets the stage and a card of its own. -->
	<div class="chart-area mt-3 flex flex-col">
		<div class="relative min-h-0 flex-1">
			<PriceChart
				class="absolute inset-0"
				values={view.bars}
				shape={{ contextBars: view.contextBars, stepBars: view.stepBars, calls: view.calls }}
				{callsMade}
				results={view.results}
				{pending}
				labels={showReveal && view.reveal
					? { dates: view.reveal.dates, closes: view.reveal.closes }
					: null}
				ticker={showReveal ? (view.reveal?.ticker ?? null) : null}
			>
				{#snippet tools()}
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
				{/snippet}
			</PriceChart>
			<MarkerLayer {marker} />
		</div>
	</div>

	<div class="panel flex min-w-0 flex-col">
		<div class={['pips', !finished && 'hide-wide']}>
			<CallPips {results} calls={view.calls} />
		</div>
		{#if !finished}
			<div class="log">
				<CallLog {results} calls={view.calls} />
			</div>
		{/if}

		{#if showReveal}
			<div {@attach bringIntoView} {@attach howl}>
				<Reveal {view} {fresh} {archive} />
			</div>
		{:else if naming && view.nameIt}
			<div class="naming flex flex-col" {@attach bringIntoView}>
				<NameIt number={view.number} nameIt={view.nameIt} {archive} onAnswered={answered} />
			</div>
		{:else}
			<div class="controls flex flex-col pb-4">
				<!-- The last result, then the next question: the ask never leaves the screen. -->
				<div class="prompt flex flex-col gap-1 text-center lg:text-left">
					{#if result}
						{#key latest?.step}
							<p
								class="type-body-md text-balance text-on-surface-variant lg:type-body-lg"
								aria-hidden="true"
								in:fly={{ y: 6, duration: fresh ? 250 : 0 }}
							>
								<span class={latest?.correct ? 'text-up' : 'text-down'}>{result.outcome}</span>
								{result.crowd}
							</p>
						{/key}
					{/if}
					{#if !view.finished}
						<p class="ask type-title-md text-balance text-on-surface lg:type-body-lg">
							Bet on {stretch}: up or down?
						</p>
					{/if}
				</div>

				{#if !view.finished}
					<div class="stakes mt-4">
						<StakePicker bind:value={stakePercent} options={stakeOptions} disabled={busy} />
					</div>

					<div class="calls mt-6 grid grid-cols-2 gap-6 px-1.5 pt-1.5 pb-3">
						{#each [{ dir: 'up', label: 'Up' }, { dir: 'down', label: 'Down' }] as const as b (b.dir)}
							<Button
								variant="tonal"
								size="hero"
								class="call pixel-frame {b.dir} {chosen === b.dir ? 'chosen' : ''} {chosen &&
								chosen !== b.dir
									? 'other'
									: ''}"
								disabled={busy && chosen !== b.dir}
								aria-label="Call {b.label.toLowerCase()}"
								data-sfx="none"
								onclick={() => call(b.dir)}
							>
								{#if b.dir === 'up'}<ArrowUp strokeWidth={2.5} />{:else}<ArrowDown
										strokeWidth={2.5}
									/>{/if}
								{b.label}
								<kbd class="key" aria-hidden="true">{b.dir === 'up' ? '↑' : '↓'}</kbd>
							</Button>
						{/each}
					</div>
				{:else}
					<p
						class="unmasking mt-6 text-center type-title-md text-on-surface-variant lg:text-left"
						tabindex="-1"
						{@attach (node) => {
							// The Up/Down buttons just went away; keep keyboard focus on the game.
							if (document.activeElement === document.body) node.focus({ preventScroll: true });
						}}
					>
						{view.reveal ? 'Unmasking the chart…' : 'One last question…'}
					</p>
				{/if}

				{#if error}
					<p class="mt-2 text-center type-body-sm text-error" role="alert">{error}</p>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.game {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: auto 1fr auto;
		grid-template-areas: 'balance' 'chart' 'panel';
	}
	.balance-row {
		grid-area: balance;
	}
	.chart-area {
		grid-area: chart;
		min-height: 200px;
	}
	.panel {
		grid-area: panel;
	}
	.pips {
		margin-top: 1rem;
	}
	.controls {
		padding-top: 1rem;
	}
	.naming {
		padding-top: 1.5rem;
	}
	.key,
	.log {
		display: none;
	}

	/* Wide screens: the chart takes the stage on the left, the game sits in a rail on the right,
	   with the call buttons level with the bottom of the chart, and both above the fold
	   (--scene-h is the skyline header's height). */
	@media (min-width: 1024px) {
		.game {
			flex: none;
			min-height: clamp(440px, calc(100dvh - var(--scene-h, 224px) - 4rem), 700px);
			margin-top: 0.5rem;
			margin-bottom: 2rem;
			grid-template-columns: minmax(0, 1fr) 22.5rem;
			grid-template-rows: auto 1fr;
			grid-template-areas: 'chart balance' 'chart panel';
			column-gap: 2.5rem;
		}
		/* The chart keeps its play-time size when the reveal makes the rail long, and stays in
		   view while the rail scrolls. */
		.chart-area {
			align-self: start;
			position: sticky;
			top: 1rem;
			height: clamp(440px, calc(100dvh - var(--scene-h, 224px) - 4rem), 700px);
			margin-top: 0;
			padding: 1.5rem 1.25rem 1rem;
			border-radius: 0;
			background: var(--md-sys-color-surface-container-low);
			box-shadow:
				0 0 0 2px var(--pixel-ink),
				0 0 0 4px var(--md-sys-color-outline-variant),
				0 6px 0 4px var(--md-sys-color-shadow);
		}
		.balance-row {
			padding-top: 0.5rem;
		}
		.panel {
			padding-top: 0.75rem;
		}
		.hide-wide {
			display: none;
		}
		/* The log's rows take up the rail's slack, so no dead gap opens above the question. */
		.log {
			display: flex;
			flex: 1 1 auto;
			flex-direction: column;
			max-height: 22.5rem; /* five 4rem rows and their gaps; past that, the gap is fine */
			margin-top: 1.5rem;
		}
		.log > :global(ol) {
			flex: 1 1 auto;
		}
		.controls {
			margin-top: auto;
			padding-top: 1.5rem;
			padding-bottom: 0;
		}
	}
	@media (min-width: 1280px) {
		.game {
			grid-template-columns: minmax(0, 1fr) 26rem;
		}
	}
	/* Short laptops: smaller call buttons, and below ~740px the rail swaps the log for the pips,
	   so the whole game still fits above the fold. */
	@media (min-width: 1024px) and (max-height: 840px) {
		.calls :global(.call) {
			--btn-h: 64px;
		}
		.log {
			margin-top: 1rem;
		}
	}
	@media (min-width: 1024px) and (max-height: 740px) {
		.hide-wide {
			display: block;
		}
		.log {
			display: none;
		}
	}
	@media (min-width: 1024px) and (pointer: fine) {
		.key {
			display: inline-grid;
			place-items: center;
			min-width: 1.5rem;
			height: 1.5rem;
			margin-left: 0.25rem;
			border-radius: 0;
			background: color-mix(in srgb, currentColor 12%, transparent);
			font: inherit;
			font-size: 0.875rem;
			line-height: 1;
		}
	}
	/* The score readout: chunky 8-bit digits. */
	.balance {
		font-family: var(--md-ref-typeface-pixel);
		font-size: 2rem;
		line-height: 2.75rem;
		letter-spacing: 0;
		text-shadow: 0 3px 0 var(--pixel-ink);
	}
	/* The tapped call lights up at once; the other steps back while the stretch is revealed. */
	/* Up and Down are arcade cabinet buttons: navy face, a green or pink neon frame; the tapped
	   one floods with its color. */
	.calls :global(.call) {
		background: var(--md-sys-color-surface-container);
		color: var(--md-sys-color-on-surface);
	}
	.calls :global(.call.up) {
		--frame: var(--up);
	}
	.calls :global(.call.down) {
		--frame: var(--down);
	}
	/* Mouse only: on touch a tapped button would keep the hover and read as preselected. */
	@media (hover: hover) {
		.calls :global(.call:hover) {
			background: var(--md-sys-color-surface-container-highest);
		}
	}
	/* Cabinet press: no easing. The button drops onto its base the instant it's hit. */
	.calls :global(.call) {
		transition:
			background-color 120ms linear,
			color 120ms linear;
	}
	.calls :global(.call:active:not(:disabled)) {
		translate: 0 6px;
		box-shadow:
			0 0 0 3px var(--pixel-ink),
			0 0 0 6px var(--frame),
			0 0 26px 0 color-mix(in srgb, var(--frame) 30%, transparent);
	}
	.calls :global(.call.chosen) {
		background: var(--frame);
		color: var(--md-sys-color-surface-container-lowest);
		pointer-events: none;
	}
	.unmasking {
		outline: none;
		animation: breathe 1.4s ease-in-out infinite;
	}
	@keyframes breathe {
		50% {
			opacity: 0.45;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.unmasking {
			animation: none;
		}
	}
	.calls :global(.call.other) {
		opacity: 0.5;
	}
	@media (max-height: 700px) {
		.chart-area {
			min-height: 150px;
		}
		.balance {
			font-size: 1.5rem;
			line-height: 2.25rem;
		}
		.calls :global(.call) {
			--btn-h: 64px;
		}
	}
	/* Once the calls are made, nothing has to fit above the fold: the chart gets its room back. */
	.game.done .chart-area {
		min-height: 200px;
	}
	/* Small phones (an SE, or a phone browser with its bars out): tighter beats all the way down,
	   so the call buttons still make the fold. */
	@media (max-width: 1023px) and (max-height: 620px) {
		.balance-row {
			padding-top: 0;
		}
		.chart-area {
			min-height: 96px;
			margin-top: 0.5rem;
		}
		.pips {
			margin-top: 0.5rem;
		}
		.controls {
			padding-top: 0.5rem;
		}
		.ask {
			font-size: 0.875rem;
			line-height: 1.25rem;
		}
		.stakes {
			margin-top: 0.5rem;
		}
		.calls {
			margin-top: 0.75rem;
		}
	}
</style>
