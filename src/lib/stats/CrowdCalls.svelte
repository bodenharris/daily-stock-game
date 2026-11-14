<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import type { CallSplit } from '#lib/remote/stats.remote.ts';

	let { calls }: { calls: CallSplit[] } = $props();

	const upShare = (c: CallSplit) => (c.calls > 0 ? Math.round((c.ups / c.calls) * 100) : 50);
</script>

<ol class="flex flex-col gap-4">
	{#each calls as call (call.step)}
		{@const up = upShare(call)}
		{@const upWon = call.answer === 'up'}
		<li>
			<p class="sr-only">
				Call {call.step}: {up}% called up, {100 - up}% called down. It went {call.answer}.
			</p>
			<div aria-hidden="true">
				<div class="grid grid-cols-[1fr_auto_1fr] items-baseline gap-2 type-label-lg type-numeric">
					<span
						class={[
							'flex items-center gap-1 justify-self-start',
							upWon ? 'text-up' : 'text-on-surface-variant'
						]}
					>
						{#if upWon}<Check class="size-4" strokeWidth={3} />{/if}
						{up}% up
					</span>
					<span class="type-label-md text-on-surface-variant">Call {call.step}</span>
					<span
						class={[
							'flex items-center gap-1 justify-self-end',
							upWon ? 'text-on-surface-variant' : 'text-up'
						]}
					>
						{100 - up}% down
						{#if !upWon}<Check class="size-4" strokeWidth={3} />{/if}
					</span>
				</div>
				<div class="mt-1.5 flex h-3 gap-0.5">
					<!-- Green is the side that was right, whichever direction that was. -->
					<div
						class={['bar rounded-l-full', upWon ? 'bg-up' : 'bg-surface-container-highest']}
						style:width="{up}%"
					></div>
					<div
						class={['bar flex-1 rounded-r-full', upWon ? 'bg-surface-container-highest' : 'bg-up']}
					></div>
				</div>
			</div>
		</li>
	{/each}
</ol>

<style>
	.bar {
		min-width: 4px;
		transition: width 600ms var(--md-sys-motion-spring-default-spatial-easing, ease);
	}
	@media (prefers-reduced-motion: reduce) {
		.bar {
			transition: none;
		}
	}
</style>
