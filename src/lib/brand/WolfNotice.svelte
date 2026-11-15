<script lang="ts">
	import type { Snippet } from 'svelte';
	import Wolf from './Wolf.svelte';

	/**
	 * A full-page notice for when things go wrong (404, a crash): the wolf on his street line,
	 * one line in his voice (`title`), an optional `detail` under it, and `children` as a pair of
	 * buttons, primary first.
	 */
	let { title, detail, children }: { title: string; detail?: string; children: Snippet } = $props();
</script>

<main
	class="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center py-12 px-safe text-center"
>
	<div class="street">
		<Wolf />
	</div>
	<h1 class="mt-8 type-headline-sm-emphasized text-balance text-on-surface">{title}</h1>
	{#if detail}
		<p class="mt-2 type-body-lg text-balance text-on-surface-variant">{detail}</p>
	{/if}
	<!-- px-1.5: room for the 6px frames -->
	<div class="mt-10 grid w-full max-w-sm grid-cols-1 gap-6 px-1.5 min-[360px]:grid-cols-2">
		{@render children()}
	</div>
</main>

<style>
	/* The same street line the header ends on, under his feet: ink, then cyan with a glow. */
	.street {
		position: relative;
		display: flex;
		justify-content: center;
		width: 12rem;
		border-bottom: 3px solid var(--pixel-ink);
	}
	.street::after {
		content: '';
		position: absolute;
		inset: 100% 0 auto;
		height: 3px;
		background: color-mix(in srgb, var(--md-sys-color-primary) 70%, transparent);
		box-shadow: 0 3px 18px 0 color-mix(in srgb, var(--md-sys-color-primary) 25%, transparent);
	}
</style>
