<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import type { CallResult } from './types.ts';

	let { results, calls }: { results: CallResult[]; calls: number } = $props();
</script>

<ol class="flex items-center justify-center gap-2 py-3" aria-label="Your calls">
	{#each { length: calls }, i (i)}
		{@const r = results[i]}
		<li
			class="pip grid size-7 place-items-center rounded-full
			{r
				? r.correct
					? 'bg-up text-on-up'
					: 'bg-down text-on-down'
				: i === results.length
					? 'bg-surface-container-highest ring-2 ring-outline ring-inset'
					: 'bg-surface-container-high'}"
			aria-label={r
				? `Call ${i + 1}: ${r.correct ? 'right' : 'wrong'}`
				: `Call ${i + 1}: ${i === results.length ? 'next' : 'to come'}`}
		>
			{#if r}
				{#if r.correct}<Check class="size-4" strokeWidth={3} />{:else}<X
						class="size-4"
						strokeWidth={3}
					/>{/if}
			{/if}
		</li>
	{/each}
</ol>

<style>
	.pip {
		transition:
			background-color var(--md-sys-motion-spring-default-effects-duration, 200ms)
				var(--md-sys-motion-spring-default-effects-easing, ease),
			transform var(--md-sys-motion-spring-fast-spatial-duration, 300ms)
				var(--md-sys-motion-spring-fast-spatial-easing, ease);
	}
</style>
