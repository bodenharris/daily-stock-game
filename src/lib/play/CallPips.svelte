<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import type { CallResult } from './types.ts';

	let { results, calls }: { results: CallResult[]; calls: number } = $props();

	function fmtMove(pct: number) {
		const abs = Math.abs(pct);
		const body = abs >= 10 ? Math.round(abs).toString() : abs.toFixed(1);
		return `${pct >= 0 ? '+' : '−'}${body}%`;
	}
</script>

<!-- The scoreboard: one column per call, right or wrong, and how far the price moved. -->
<ol class="grid gap-1 py-2" style:grid-template-columns="repeat({calls}, 1fr)">
	{#each { length: calls }, i (i)}
		{@const r = results[i]}
		<li class="flex flex-col items-center gap-1">
			<span
				class="pip grid size-7 place-items-center rounded-full
				{r
					? r.correct
						? 'bg-up text-on-up'
						: 'bg-down text-on-down'
					: i === results.length
						? 'bg-surface-container-highest ring-2 ring-outline ring-inset'
						: 'bg-surface-container-high'}"
			>
				{#if r}
					{#if r.correct}<Check class="size-4" strokeWidth={3} />{:else}<X
							class="size-4"
							strokeWidth={3}
						/>{/if}
				{/if}
			</span>
			<span class="move type-label-sm text-on-surface-variant type-numeric">
				{#if r}{fmtMove(r.move)}{:else}&nbsp;{/if}
			</span>
			<span class="sr-only">
				Call {i + 1}: {r
					? `${r.correct ? 'right' : 'wrong'}, price ${fmtMove(r.move)}`
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
	.move {
		line-height: 1;
	}
</style>
