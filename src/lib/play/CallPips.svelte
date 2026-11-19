<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import { START_BALANCE_CENTS } from '#lib/game/config.ts';
	import { dollars, formatMove, paidByCall } from './format.ts';
	import type { CallResult } from './types.ts';

	/** The phone scoreboard: one column per call, right or wrong, and what it paid. */
	let { results, calls }: { results: CallResult[]; calls: number } = $props();

	/** What each call paid, so the labels always add up to the balance shown. */
	const paid = $derived(
		paidByCall(results, START_BALANCE_CENTS).map((c) => dollars(c, { sign: true }))
	);
</script>

<ol class="grid gap-1" style:grid-template-columns="repeat({calls}, 1fr)">
	{#each { length: calls }, i (i)}
		{@const r = results[i]}
		<li class="flex flex-col items-center gap-1.5">
			<span
				class={[
					'pip grid place-items-center',
					r
						? r.correct
							? 'bg-up text-on-up'
							: 'bg-down text-on-down'
						: i === results.length
							? 'bg-surface-container-highest ring-2 ring-m3-primary ring-inset'
							: 'ring-2 ring-outline ring-inset'
				]}
				aria-hidden="true"
			>
				{#if r?.correct}
					<Check class="size-4" strokeWidth={3} />
				{:else if r}
					<X class="size-4" strokeWidth={3} />
				{/if}
			</span>
			<span
				class={[
					'paid type-label-md type-numeric lg:type-body-lg',
					r && (r.correct ? 'text-up' : 'text-down')
				]}
				aria-hidden="true"
			>
				{#if r}{paid[i]}{:else}&nbsp;{/if}
			</span>
			<span class="sr-only">
				Call {i + 1}: {r
					? `${r.correct ? 'right' : 'wrong'}, ${paid[i]}, price ${formatMove(r.move)}`
					: i === results.length
						? 'next'
						: 'to come'}
			</span>
		</li>
	{/each}
</ol>

<style>
	.pip {
		width: 1.75rem;
		height: 1.75rem;
		transition: background-color var(--md-sys-motion-spring-default-effects-duration)
			var(--md-sys-motion-spring-default-effects-easing);
	}
	.paid {
		line-height: 1;
	}
	/* Small phones: a smaller scoreboard, so the call buttons make the fold. */
	@media (max-width: 1023px) and (max-height: 620px) {
		li {
			gap: 0.25rem;
		}
		.pip {
			width: 22px;
			height: 22px;
		}
	}
</style>
