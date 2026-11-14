<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<svelte:boundary>
	{@render children()}

	{#snippet failed(error, reset)}
		<main class="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6">
			<p class="text-center type-title-lg text-on-surface">Something went sideways.</p>
			<p class="text-center type-body-md text-on-surface-variant">
				{(error as { message?: string })?.message ?? 'Please try again.'}
			</p>
			<button class="type-label-lg text-m3-primary underline" onclick={reset}>Try again</button>
		</main>
	{/snippet}
</svelte:boundary>
