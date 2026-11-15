<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import { GAME_NAME } from '#lib/game/config.ts';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// Link previews (iMessage, WhatsApp, Slack, Discord). The image and icons are drawn by
	// scripts/make-images.py.
	const description =
		'One famous stock chart a day, name hidden. Five up-or-down calls on what it did next.';
	const ogImage = $derived(new URL('/og.png', page.url.origin).href);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={GAME_NAME} />
	<meta property="og:title" content={GAME_NAME} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta
		property="og:image:alt"
		content="{GAME_NAME}: a price line stopping before five empty slots."
	/>
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<svelte:boundary>
	{@render children()}

	{#snippet failed(error, reset)}
		<main class="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6">
			<p class="text-center type-title-lg text-on-surface">Something went sideways.</p>
			<p class="text-center type-body-md text-on-surface-variant">
				{(error as { message?: string })?.message ?? 'Please try again.'}
			</p>
			<Button variant="tonal" size="md" class="pixel-panel mt-4" onclick={reset}>Try again</Button>
		</main>
	{/snippet}
</svelte:boundary>
