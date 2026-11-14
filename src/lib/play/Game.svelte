<script lang="ts">
	import { Tween, prefersReducedMotion } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import { pop } from '#lib/m3/transitions.ts';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import { Button } from '#lib/components/ui/button/index.js';
	import { START_BALANCE_CENTS, STAKE_OPTIONS } from '#lib/game/config.ts';
	import { getGame, makeCall } from '#lib/remote/game.remote.ts';
	import PriceChart from './PriceChart.svelte';
	import StakePicker from './StakePicker.svelte';
	import CallPips from './CallPips.svelte';
	import CallLog from './CallLog.svelte';
	import Reveal from './Reveal.svelte';
	import { dollars, percent } from './money.ts';
	import type { CallResult, Direction, GameView } from './types.ts';

	let { view }: { view: GameView } = $props();

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

	const resultLine = $derived.by(() => {
		if (!latest) return '';
		const total = latest.crowd.up + latest.crowd.down;
		const same = latest.direction === 'up' ? latest.crowd.up : latest.crowd.down;
		const crowd =
			total <= 1
				? `You're the first to call this one.`
				: total <= 20
					? `${same} of ${total} players called ${latest.direction}.`
					: `${percent(same / total)} of players called ${latest.direction}.`;
		if (!latest.correct) return `Missed. ${crowd}`;
		// A right call returns the stake, plus a crowd bonus when most players called it wrong.
		const bonus = latest.deltaCents - latest.stakeCents;
		const payout =
			bonus > 0
				? `Crowd bonus ${dollars(bonus, { sign: true })}.`
				: total > 1
					? 'Most saw it too, so no crowd bonus.'
					: '';
		return `Right. ${crowd} ${payout}`.trim();
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
		try {
			const res = await makeCall({
				puzzleNumber: view.number,
				step: callsMade + 1,
				direction,
				stakePercent: Number(stakePercent)
			});
			fresh = true;
			setTimeout(() => buzz(res.result.correct ? [8, 60, 16] : 40), DRAW_MS);
		} catch (e) {
			const status = (e as { status?: number }).status;
			const message = (e as { body?: { message?: string } }).body?.message;
			if (status === 409) {
				// A new day started, or this call was already made in another tab: catch up.
				error = message ?? null;
				await getGame()
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
		if (stake) stakePercent = String(stake.percent);
	}
	/** The call in flight or being revealed, highlighted until the result lands. */
	const chosen = $derived<Direction | null>(
		pending ?? (revealing ? (view.results.at(-1)?.direction ?? null) : null)
	);
</script>

<!-- One calm announcement per call for screen readers (the visible numbers animate). -->
<p class="sr-only" aria-live="polite">
	{#if latest}{resultLine} Balance {dollars(balanceCents, { cents: false })}.{/if}
</p>

<svelte:window onkeydown={onKey} />

<div class="game min-h-0 flex-1">
	<!-- Balance: the one number that matters. -->
	<div class="balance-row flex items-end justify-between gap-3 pt-1">
		<div>
			<p class="type-label-md text-on-surface-variant">
				{finished ? 'Final balance' : 'Balance'}
			</p>
			<p class="balance type-display-sm-emphasized text-on-surface type-numeric">
				{dollars(Math.round(shownBalance.current), { cents: false })}
			</p>
		</div>
		{#if finished}
			{@const change = view.balanceCents - START_BALANCE_CENTS}
			<span
				class="mb-1.5 rounded-full px-3 py-1 type-title-lg-emphasized type-numeric
				{change >= 0 ? 'bg-up-container text-on-up-container' : 'bg-down-container text-on-down-container'}"
				in:pop
			>
				{change >= 0 ? '+' : '−'}{Math.round((Math.abs(change) / START_BALANCE_CENTS) * 100)}%
			</span>
		{:else if latest}
			{#key latest.step}
				<span
					class="mb-1.5 rounded-full px-3 py-1 type-title-lg-emphasized type-numeric
					{latest.correct
						? 'bg-up-container text-on-up-container'
						: 'bg-down-container text-on-down-container'}"
					in:pop
				>
					{dollars(latest.deltaCents, { sign: true })}
				</span>
			{/key}
		{/if}
	</div>

	<!-- The chart is the hero. On wide screens it gets the stage and a card of its own. -->
	<div class="chart-area mt-2 flex flex-col">
		<div class="relative min-h-0 flex-1">
			<PriceChart
				class="absolute inset-0"
				values={view.bars}
				shape={{ contextBars: view.contextBars, stepBars: view.stepBars, calls: view.calls }}
				{callsMade}
				results={view.results}
				{pending}
				labels={finished && view.reveal
					? { dates: view.reveal.dates, closes: view.reveal.closes }
					: null}
			/>
		</div>
	</div>

	<div class="panel flex min-w-0 flex-col">
		<div class={[!finished && 'hide-wide']}>
			<CallPips {results} calls={view.calls} />
		</div>
		{#if !finished}
			<div class="log">
				<CallLog {results} calls={view.calls} />
			</div>
		{/if}

		{#if finished && view.reveal}
			<Reveal {view} {fresh} />
		{:else}
			<div class="controls flex flex-col pb-4">
				<div class="flex min-h-10 items-center justify-center px-2 text-center">
					{#if latest}
						{#key latest.step}
							<p
								class="type-body-md text-balance text-on-surface-variant"
								in:fly={{ y: 6, duration: fresh ? 250 : 0 }}
							>
								{resultLine}
							</p>
						{/key}
					{:else}
						<div>
							<p class="type-title-md text-balance text-on-surface">Up or down over {stretch}?</p>
						</div>
					{/if}
				</div>

				{#if !view.finished}
					<div class="mt-3">
						<StakePicker bind:value={stakePercent} options={stakeOptions} disabled={busy} />
					</div>

					<div class="calls mt-3 grid grid-cols-2 gap-3">
						{#each [{ dir: 'up', label: 'Up' }, { dir: 'down', label: 'Down' }] as const as b (b.dir)}
							<Button
								variant="tonal"
								size="hero"
								class="call {chosen === b.dir ? 'chosen' : ''} {chosen && chosen !== b.dir
									? 'other'
									: ''}"
								disabled={busy && chosen !== b.dir}
								aria-label="Call {b.label.toLowerCase()}"
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
						class="unmasking mt-6 text-center type-title-md text-on-surface-variant"
						tabindex="-1"
						{@attach (node) => {
							// The Up/Down buttons just went away; keep keyboard focus on the game.
							if (document.activeElement === document.body) node.focus({ preventScroll: true });
						}}
					>
						Unmasking the chart…
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
	.key,
	.log {
		display: none;
	}

	/* Wide screens: the chart takes the stage on the left, the game sits in a rail on the right,
	   with the call buttons level with the bottom of the chart. */
	@media (min-width: 1024px) {
		.game {
			flex: none;
			min-height: clamp(480px, calc(100dvh - 7rem), 700px);
			margin-top: 0.5rem;
			margin-bottom: 2rem;
			grid-template-columns: minmax(0, 1fr) 22.5rem;
			grid-template-rows: auto 1fr;
			grid-template-areas: 'chart balance' 'chart panel';
			column-gap: 2.5rem;
		}
		.chart-area {
			margin-top: 0;
			padding: 1.5rem 1.25rem 1rem;
			border-radius: var(--md-sys-shape-corner-extra-large, 28px);
			background: var(--md-sys-color-surface-container-low);
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
		.log {
			display: block;
			margin-top: 1.25rem;
		}
		.controls {
			margin-top: auto;
			padding-top: 1.5rem;
			padding-bottom: 0;
		}
	}
	@media (min-width: 1024px) and (pointer: fine) {
		.key {
			display: inline-grid;
			place-items: center;
			min-width: 1.5rem;
			height: 1.5rem;
			margin-left: 0.25rem;
			border-radius: 6px;
			background: color-mix(in srgb, currentColor 12%, transparent);
			font: inherit;
			font-size: 0.875rem;
			line-height: 1;
		}
	}
	/* The tapped call lights up at once; the other steps back while the stretch is revealed. */
	/* Up and Down wear the brand: primary container, the tapped one fills to primary. */
	.calls :global(.call) {
		background: var(--md-sys-color-primary-container);
		color: var(--md-sys-color-on-primary-container);
	}
	.calls :global(.call.chosen) {
		background: var(--md-sys-color-primary);
		color: var(--md-sys-color-on-primary);
		--btn-r: var(--btn-r-square);
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
			font-size: 1.875rem;
			line-height: 2.25rem;
		}
		.calls :global(.call) {
			--btn-h: 64px;
		}
	}
</style>
