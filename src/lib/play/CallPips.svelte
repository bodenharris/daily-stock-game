<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import { START_BALANCE_CENTS } from '#lib/game/config.ts';
	import { dollars } from './money.ts';
	import type { CallResult } from './types.ts';

	let { results, calls }: { results: CallResult[]; calls: number } = $props();

	/**
	 * What each call paid in whole dollars, rounded on the running balance rather than per call,
	 * so the labels always add up to the balance shown.
	 */
	const paid = $derived(
		results.map((r, i) => {
			const before = results[i - 1]?.balanceAfterCents ?? START_BALANCE_CENTS;
			const whole = Math.round(r.balanceAfterCents / 100) - Math.round(before / 100);
			return dollars(whole * 100, { sign: whole !== 0, cents: false });
		})
	);

	function fmtMove(pct: number) {
		const abs = Math.abs(pct);
		const body = abs >= 10 ? Math.round(abs).toString() : abs.toFixed(1);
		return `${pct >= 0 ? '+' : '−'}${body}%`;
	}
</script>

<!-- The scoreboard: one column per call, right or wrong, and what it paid. -->
<ol class="grid gap-1" style:grid-template-columns="repeat({calls}, 1fr)">
	{#each { length: calls }, i (i)}
		{@const r = results[i]}
		<li class="flex flex-col items-center gap-1.5">
			<span
				class={[
					'pip grid place-items-center rounded-none',
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
				{#if r}
					{#if r.correct}<Check class="size-4" strokeWidth={3} />{:else}<X
							class="size-4"
							strokeWidth={3}
						/>{/if}
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
					? `${r.correct ? 'right' : 'wrong'}, ${dollars(r.deltaCents, { sign: true })}, price ${fmtMove(r.move)}`
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
		transition: background-color var(--md-sys-motion-spring-default-effects-duration, 200ms)
			var(--md-sys-motion-spring-default-effects-easing, ease);
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
