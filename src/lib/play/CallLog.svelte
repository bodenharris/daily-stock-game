<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { START_BALANCE_CENTS } from '#lib/game/config.ts';
	import { dollars, paidByCall } from './money.ts';
	import type { CallResult } from './types.ts';

	/**
	 * The wide-screen scoreboard: one row per call with the bet, how far the price moved and what
	 * it paid. Phones get the compact dots (CallPips) instead.
	 */
	let { results, calls }: { results: CallResult[]; calls: number } = $props();

	/** The same per-call amounts as the phone pips, so they add up to the balance shown. */
	const paid = $derived(paidByCall(results, START_BALANCE_CENTS));

	function fmtMove(pct: number) {
		const abs = Math.abs(pct);
		const body = abs >= 10 ? Math.round(abs).toString() : abs.toFixed(1);
		return `${pct >= 0 ? '+' : '−'}${body}%`;
	}
</script>

<ol class="flex flex-col gap-1">
	{#each { length: calls }, i (i)}
		{@const r = results[i]}
		{@const next = i === results.length}
		<li
			class={[
				'row grid grid-cols-[1.75rem_1fr_auto] items-center gap-3 rounded-none px-3',
				r ? 'bg-surface-container' : next ? 'next' : ''
			]}
		>
			<span
				class={[
					'grid size-7 place-items-center rounded-none',
					r
						? r.correct
							? 'bg-up text-on-up'
							: 'bg-down text-on-down'
						: next
							? 'bg-surface-container-highest'
							: 'ring-2 ring-outline ring-inset'
				]}
				aria-hidden="true"
			>
				{#if r}
					{#if r.correct}<Check class="size-4" strokeWidth={3} />{:else}<X
							class="size-4"
							strokeWidth={3}
						/>{/if}
				{:else}
					<span
						class={[
							'type-label-lg type-numeric',
							next ? 'text-on-surface' : 'text-on-surface-variant'
						]}>{i + 1}</span
					>
				{/if}
			</span>
			{#if r}
				<span
					class="flex min-w-0 items-baseline gap-2"
					in:fly={{ x: -8, duration: 300, easing: cubicOut }}
				>
					<span class="flex items-center gap-1 type-title-md text-on-surface">
						{#if r.direction === 'up'}<ArrowUp class="size-4" strokeWidth={2.5} />{:else}<ArrowDown
								class="size-4"
								strokeWidth={2.5}
							/>{/if}
						<span class="sr-only">Call {r.step}: you called</span>
						{r.direction === 'up' ? 'Up' : 'Down'}
					</span>
					<span class="truncate type-body-lg text-on-surface-variant type-numeric">
						{dollars(r.stakeCents)} bet · price {fmtMove(r.move)}
					</span>
				</span>
				<span class={['type-title-md type-numeric', r.correct ? 'text-up' : 'text-down']}>
					<span class="sr-only">{r.correct ? 'right,' : 'wrong,'}</span>
					{dollars(paid[i], { sign: true })}
				</span>
			{:else}
				<span class={['type-body-lg', next ? 'text-on-surface' : 'text-on-surface-variant']}>
					{next ? 'Your call' : `Call ${i + 1}`}
				</span>
				<span></span>
			{/if}
		</li>
	{/each}
</ol>

<style>
	/* Rows stretch to fill the rail when there's room, up to a point. */
	.row {
		flex: 1 1 0;
		min-height: 3rem;
		max-height: 4rem;
	}
	@media (max-height: 840px) {
		.row {
			min-height: 2.5rem;
		}
	}
	/* The call you're about to make. */
	.next {
		outline: 2px solid var(--md-sys-color-primary);
		outline-offset: -2px;
	}
</style>
