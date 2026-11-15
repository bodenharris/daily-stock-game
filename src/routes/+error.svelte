<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '#lib/components/ui/button/index.js';
	import Wolf from '#lib/brand/Wolf.svelte';
	import { GAME_NAME } from '#lib/game/config.ts';

	const notFound = $derived(page.status === 404);
	// Our own errors carry a message worth showing; a crash only says "Internal Error".
	const detail = $derived(
		page.error?.message && page.error.message !== 'Internal Error'
			? page.error.message
			: 'Try again in a moment.'
	);
</script>

<svelte:head>
	<title>{notFound ? 'Not found' : 'Something went wrong'} · {GAME_NAME}</title>
</svelte:head>

<main
	class="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center py-12 px-safe text-center"
>
	<Wolf />
	<h1 class="mt-8 type-headline-sm-emphasized text-balance text-on-surface">
		{notFound ? 'This page got delisted.' : 'Something went sideways.'}
	</h1>
	{#if !notFound}
		<p class="mt-2 type-body-lg text-balance text-on-surface-variant">{detail}</p>
	{/if}
	<div class="mt-10 grid w-full max-w-sm grid-cols-1 gap-6 px-1.5 min-[360px]:grid-cols-2">
		<Button href="/" variant="filled" size="md" class="pixel-frame">Today's chart</Button>
		<Button href="/archive" variant="tonal" size="md" class="pixel-panel">Past charts</Button>
	</div>
</main>
