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
	import Reveal from './Reveal.svelte';
	import { dollars, multiplier, percent } from './money.ts';
	import { sameSideShare } from './records.ts';
	import type { Direction, GameView } from './types.ts';

	let { view }: { view: GameView } = $props();

	let stakePercent = $state('25');
	let pending = $state<Direction | null>(null);
	let error = $state<string | null>(null);
	/** Set when a call settles in this session, so its result animates in. */
	let fresh = $state(false);

	const callsMade = $derived(view.results.length);
	const latest = $derived(view.results.at(-1) ?? null);
	const outcomes = $derived(
		view.results.map((r) =>
			r.correct ? r.direction : r.direction === 'up' ? ('down' as const) : ('up' as const)
		)
	);

	// The balance counts to its new value just after the line finishes drawing.
	// svelte-ignore state_referenced_locally
	const shownBalance = new Tween(view.balanceCents, { duration: 700, easing: cubicOut });
	$effect(() => {
		const target = view.balanceCents;
		if (prefersReducedMotion.current) shownBalance.set(target, { duration: 0 });
		else shownBalance.set(target, { delay: fresh ? 650 : 0 });
	});

	const crowdLine = $derived.by(() => {
		if (!latest) return '';
		const head = latest.correct ? 'Called it.' : 'Not this time.';
		const others = latest.crowd.up + latest.crowd.down - 1;
		if (others < 3) return `${head} You're one of the first to call this one.`;
		const share = percent(sameSideShare(latest));
		const chip = STAKE_OPTIONS.find((o) => o.percent === latest.stakePercent);
		const paidHundredths = Math.floor(
			(latest.multiplierHundredths * (chip?.payoutPercent ?? 100)) / 100
		);
		const paid = latest.correct ? ` · paid ${multiplier(paidHundredths)}` : '';
		return `${head} ${share} called it your way${paid}.`;
	});

	const stakeOptions = $derived(
		STAKE_OPTIONS.map((o) => ({
			value: String(o.percent),
			percent: o.percent,
			cents: Math.floor((view.balanceCents * o.percent) / 100)
		}))
	);

	function buzz(pattern: number | number[]) {
		if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
	}

	async function call(direction: Direction) {
		if (pending || view.finished) return;
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
			setTimeout(() => buzz(res.result.correct ? [8, 60, 16] : 40), 650);
		} catch (e) {
			const status = (e as { status?: number }).status;
			if (status === 409) {
				// A new day started, or this call was already made in another tab: catch up.
				await getGame().refresh();
				error = (e as { body?: { message?: string } }).body?.message ?? null;
			} else {
				error = navigator.onLine
					? 'That call did not go through. Try again.'
					: 'You are offline. Try again when you are back.';
			}
		} finally {
			pending = null;
		}
	}

	function onkeydown(e: KeyboardEvent) {
		if (view.finished || e.metaKey || e.ctrlKey || e.altKey) return;
		const target = e.target as HTMLElement | null;
		if (target?.closest('input, textarea, [role="dialog"]')) return;
		if (e.key === 'ArrowUp') call('up');
		else if (e.key === 'ArrowDown') call('down');
		else if (e.key === '1' || e.key === '2' || e.key === '3') {
			stakePercent = String(STAKE_OPTIONS[Number(e.key) - 1].percent);
		} else return;
		e.preventDefault();
	}
</script>

<svelte:window {onkeydown} />

<div class="flex min-h-0 flex-1 flex-col">
	<!-- Balance: the one number that matters. -->
	<div class="flex items-end justify-between gap-3 px-1 pt-2">
		<div>
			<p class="type-label-md text-on-surface-variant">
				{view.finished ? 'Final balance' : 'Balance'}
			</p>
			<p class="type-display-sm-emphasized text-on-surface type-numeric" aria-live="polite">
				{dollars(Math.round(shownBalance.current), { cents: false })}
			</p>
		</div>
		{#if view.finished}
			{@const change = view.balanceCents - START_BALANCE_CENTS}
			<span
				class="mb-1.5 rounded-full px-3 py-1 type-title-lg-emphasized type-numeric
				{change >= 0 ? 'bg-up-container text-on-up-container' : 'bg-down-container text-on-down-container'}"
				in:pop={{ delay: fresh ? 900 : 0 }}
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
					in:pop={{ delay: 650 }}
				>
					{dollars(latest.deltaCents, { sign: true })}
				</span>
			{/key}
		{/if}
	</div>

	<!-- The chart is the hero. -->
	<div class="relative mt-3 min-h-[220px] flex-1">
		<PriceChart
			class="absolute inset-0"
			values={view.bars}
			shape={{ contextBars: view.contextBars, stepBars: view.stepBars, calls: view.calls }}
			{callsMade}
			{outcomes}
			{pending}
			labels={view.reveal ? { dates: view.reveal.dates, closes: view.reveal.closes } : null}
		/>
	</div>

	<CallPips results={view.results} calls={view.calls} />

	{#if view.finished && view.reveal}
		<Reveal {view} {fresh} />
	{:else}
		<div class="flex flex-col gap-4 pt-3 pb-4">
			<div class="flex min-h-6 items-center justify-center text-center">
				{#if latest}
					{#key latest.step}
						<p
							class="type-body-md text-on-surface-variant"
							in:fly={{ y: 6, duration: fresh ? 300 : 0, delay: fresh ? 800 : 0 }}
						>
							{crowdLine}
						</p>
					{/key}
				{:else}
					<p class="type-title-md text-on-surface">Where does it go next?</p>
				{/if}
			</div>

			<div>
				<p class="mb-2 text-center type-label-md text-on-surface-variant">
					Bet on call {callsMade + 1} of {view.calls}
				</p>
				<StakePicker bind:value={stakePercent} options={stakeOptions} disabled={!!pending} />
			</div>

			<div class="grid grid-cols-2 gap-3">
				<Button
					variant="up"
					size="hero"
					disabled={!!pending}
					aria-label="Call up"
					onclick={() => call('up')}
				>
					<ArrowUp strokeWidth={2.5} />
					Up
				</Button>
				<Button
					variant="down"
					size="hero"
					disabled={!!pending}
					aria-label="Call down"
					onclick={() => call('down')}
				>
					<ArrowDown strokeWidth={2.5} />
					Down
				</Button>
			</div>

			{#if error}
				<p class="text-center type-body-sm text-error" role="alert">{error}</p>
			{/if}
		</div>
	{/if}
</div>
