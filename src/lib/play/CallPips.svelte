<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import { dollars } from './money.ts';
	import type { CallResult } from './types.ts';

	let { results, calls }: { results: CallResult[]; calls: number } = $props();

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
					'pip grid size-7 place-items-center rounded-none',
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
				class={['paid type-label-md type-numeric', r && (r.correct ? 'text-up' : 'text-down')]}
				aria-hidden="true"
			>
				{#if r}{dollars(r.deltaCents, { sign: true, cents: false })}{:else}&nbsp;{/if}
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
		transition: background-color var(--md-sys-motion-spring-default-effects-duration, 200ms)
			var(--md-sys-motion-spring-default-effects-easing, ease);
	}
	.paid {
		line-height: 1;
	}
</style>
