<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '#lib/components/ui/button/index.js';
	import { GAME_NAME } from '#lib/game/config.ts';
</script>

<svelte:head>
	<title>{page.status === 404 ? 'Not found' : 'Something went wrong'} · {GAME_NAME}</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-3 px-6">
	<p class="type-label-lg text-on-surface-variant type-numeric">{page.status}</p>
	<h1 class="type-headline-sm-emphasized text-on-surface">
		{page.status === 404 ? 'Nothing here' : 'Something went wrong'}
	</h1>
	<p class="type-body-lg text-on-surface-variant">
		{page.error?.message ?? 'Try again in a moment.'}
	</p>
	<div class="mt-3 flex gap-2">
		<Button href="/" variant="filled" size="sm">Today's chart</Button>
		<Button href="/archive" variant="text" size="sm">Past charts</Button>
	</div>
</main>
