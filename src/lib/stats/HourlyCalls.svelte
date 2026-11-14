<script lang="ts">
	let { hourly }: { hourly: { at: number; calls: number }[] } = $props();

	const max = $derived(Math.max(1, ...hourly.map((h) => h.calls)));
</script>

<!-- Relative labels, not clock times: the server's hours would not match the viewer's zone. -->
<figure>
	<div
		class="flex h-16 items-end gap-px border-b border-outline-variant lg:h-28 lg:gap-0.5"
		role="img"
		aria-label="Calls per hour over the last 24 hours"
	>
		{#each hourly as h (h.at)}
			<div class="flex h-full flex-1 items-end">
				{#if h.calls > 0}
					<div
						class="bar w-full rounded-t-[3px] bg-m3-primary"
						style:height="{Math.max(8, (h.calls / max) * 100)}%"
					></div>
				{/if}
			</div>
		{/each}
	</div>
	<figcaption
		class="mt-1.5 grid grid-cols-3 type-label-sm text-on-surface-variant"
		aria-hidden="true"
	>
		<span>24h ago</span>
		<span class="text-center">12h ago</span>
		<span class="text-end">Now</span>
	</figcaption>
</figure>

<style>
	.bar {
		transition: height 600ms var(--md-sys-motion-spring-default-spatial-easing, ease);
	}
	@media (prefers-reduced-motion: reduce) {
		.bar {
			transition: none;
		}
	}
</style>
