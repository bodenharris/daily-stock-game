<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import { rise } from '#lib/m3/transitions.ts';
	import { stateLayer } from '#lib/m3/ripple.svelte.ts';
	import { Button } from '#lib/components/ui/button/index.js';
	import { nameIt as sendGuess } from '#lib/remote/game.remote.ts';
	import type { NameIt } from './types.ts';

	/**
	 * "Name the moment": after the last call and before the unmasking, the player picks which
	 * of four famous moments this chart was, or skips. It never touches the money.
	 */
	let {
		number,
		nameIt,
		timeframe,
		archive = false,
		onAnswered
	}: {
		number: number;
		nameIt: NameIt;
		/** What the chart covers, e.g. "3 months of daily prices, then 5 calls of a week each." */
		timeframe: string;
		archive?: boolean;
		onAnswered: (named: boolean) => void;
	} = $props();

	let picked = $state<number | null>(null);
	let busy = $state(false);
	let error = $state<string | null>(null);

	const done = $derived(nameIt.answered);

	async function choose(choice: number | null) {
		if (busy || done) return;
		busy = true;
		picked = choice;
		error = null;
		try {
			const view = await sendGuess({ puzzleNumber: number, choice, archive });
			const n = view.nameIt;
			onAnswered(!!n && n.guess != null && n.guess === n.answer);
		} catch {
			picked = null;
			error = navigator.onLine
				? 'That did not go through. Try again.'
				: 'You are offline. Try again when you are back.';
		} finally {
			busy = false;
		}
	}

	function optionState(i: number): 'right' | 'wrong' | 'picked' | 'other' | 'idle' {
		if (done && nameIt.answer === i) return 'right';
		if (done && nameIt.guess === i) return 'wrong';
		if (done) return 'other';
		if (picked === i) return 'picked';
		return picked != null ? 'other' : 'idle';
	}
</script>

<section class="flex flex-col gap-3 pt-1 pb-4" in:rise>
	<div
		class="outline-none"
		tabindex="-1"
		{@attach (node) => {
			// The call buttons just went away; keep keyboard and screen-reader users here.
			if (document.activeElement === document.body) node.focus({ preventScroll: true });
		}}
	>
		<h2 class="type-title-lg-emphasized text-on-surface">Name the moment</h2>
		<p class="type-body-md text-on-surface-variant">Which one was it? Just for bragging rights.</p>
		<!-- The calls share the chart's width equally, so the chart alone can't show how long they were. -->
		<p class="mt-2 type-body-sm text-on-surface-variant">
			<span class="font-medium text-on-surface">The chart:</span>
			{timeframe}
		</p>
	</div>

	<div class="flex flex-col gap-2" role="group" aria-label="Which moment was this?">
		{#each nameIt.options as option, i (i)}
			{@const s = optionState(i)}
			<button
				type="button"
				class="option {s}"
				disabled={busy || done}
				aria-pressed={picked === i || nameIt.guess === i}
				onclick={() => choose(i)}
				{@attach stateLayer()}
			>
				<span class="min-w-0 flex-1 text-left">{option}</span>
				{#if s === 'right'}
					<Check class="size-5 shrink-0" strokeWidth={3} aria-hidden="true" />
					<span class="sr-only">(the answer)</span>
				{:else if s === 'wrong'}
					<X class="size-5 shrink-0" strokeWidth={3} aria-hidden="true" />
					<span class="sr-only">(your guess)</span>
				{/if}
			</button>
		{/each}
	</div>

	<div class="flex min-h-10 items-center justify-center">
		{#if error}
			<p class="type-body-sm text-error" role="alert">{error}</p>
		{:else if done}
			<p class="type-title-md text-on-surface" role="status">
				{#if nameIt.guess == null}
					Here it is.
				{:else if nameIt.guess === nameIt.answer}
					You named it.
				{:else}
					Not that one.
				{/if}
			</p>
		{:else}
			<Button variant="text" size="sm" disabled={busy} onclick={() => choose(null)}>
				Skip to the reveal
			</Button>
		{/if}
	</div>
</section>

<style>
	.option {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: 3.25rem;
		padding: 0.625rem 1.25rem;
		border-radius: var(--md-sys-shape-corner-large, 16px);
		background: var(--md-sys-color-surface-container-high);
		color: var(--md-sys-color-on-surface);
		font: inherit;
		font-size: 1rem;
		line-height: 1.375rem;
		transition:
			background-color 200ms ease,
			color 200ms ease,
			opacity 200ms ease,
			border-radius 250ms ease;
	}
	.option:focus-visible {
		outline: 2px solid var(--md-sys-color-primary);
		outline-offset: 2px;
	}
	.option:disabled {
		cursor: default;
	}
	.option.picked {
		background: var(--md-sys-color-primary);
		color: var(--md-sys-color-on-primary);
		border-radius: var(--md-sys-shape-corner-small, 8px);
	}
	.option.right {
		background: var(--up-container);
		color: var(--on-up-container);
	}
	.option.wrong {
		background: var(--down-container);
		color: var(--on-down-container);
	}
	.option.other {
		opacity: 0.45;
	}
	@media (prefers-reduced-motion: reduce) {
		.option {
			transition: none;
		}
	}
</style>
