<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { dollars } from './money.ts';
	import type { CallResult } from './types.ts';

	/**
	 * The wide-screen scoreboard: one row per call with the bet, how far the price moved and what
	 * it paid. Phones get the compact dots (CallPips) instead.
	 */
	let { results, calls }: { results: CallResult[]; calls: number } = $props();

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
				'row grid min-h-11 grid-cols-[1.75rem_1fr_auto] items-center gap-3 rounded-m3-lg px-3',
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
							? 'bg-surface-container-highest ring-2 ring-outline ring-inset'
							: 'bg-surface-container-high'
				]}
				aria-hidden="true"
			>
				{#if r}
					{#if r.correct}<Check class="size-4" strokeWidth={3} />{:else}<X
							class="size-4"
							strokeWidth={3}
						/>{/if}
				{:else}
					<span class="type-label-md text-on-surface-variant type-numeric">{i + 1}</span>
				{/if}
			</span>
			{#if r}
				<span
					class="flex min-w-0 items-baseline gap-2"
					in:fly={{ x: -8, duration: 300, easing: cubicOut }}
				>
					<span class="flex items-center gap-1 type-label-lg text-on-surface">
						{#if r.direction === 'up'}<ArrowUp class="size-4" strokeWidth={2.5} />{:else}<ArrowDown
								class="size-4"
								strokeWidth={2.5}
							/>{/if}
						<span class="sr-only">Call {r.step}: you called</span>
						{r.direction === 'up' ? 'Up' : 'Down'}
					</span>
					<span class="truncate type-body-sm text-on-surface-variant type-numeric">
						{dollars(r.stakeCents)} bet · price {fmtMove(r.move)}
					</span>
				</span>
				<span
					class={['type-label-lg type-numeric', r.correct ? 'text-up' : 'text-on-surface-variant']}
				>
					<span class="sr-only">{r.correct ? 'right,' : 'wrong,'}</span>
					{dollars(r.deltaCents, { sign: true })}
				</span>
			{:else}
				<span
					class={['type-body-md', next ? 'text-on-surface' : 'text-on-surface-variant opacity-60']}
				>
					{next ? 'Your call' : `Call ${i + 1}`}
				</span>
				<span></span>
			{/if}
		</li>
	{/each}
</ol>

<style>
	.next {
		outline: 1px dashed var(--md-sys-color-outline-variant);
		outline-offset: -1px;
	}
</style>
