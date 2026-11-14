<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { getDay } from '#lib/remote/game.remote.ts';
	import Game from '#lib/play/Game.svelte';
	import { GAME_NAME } from '#lib/game/config.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const view = $derived(await getDay(data.number));

	const date = $derived(
		new Date(`${view.date}T12:00:00Z`).toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			timeZone: 'UTC'
		})
	);
</script>

<svelte:head>
	<title>{GAME_NAME} #{view.number}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main
	class="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] md:max-w-2xl md:px-6 lg:max-w-7xl lg:px-8"
>
	<header class="-mx-2 flex h-14 items-center gap-1">
		<a
			href="/archive"
			class="grid size-12 shrink-0 place-items-center rounded-full text-on-surface-variant hover:bg-on-surface/8"
			aria-label="Back to past charts"
		>
			<ArrowLeft class="size-6" />
		</a>
		<h1 class="type-title-lg-emphasized text-on-surface">
			{GAME_NAME} <span class="type-numeric">#{view.number}</span>
		</h1>
		<span class="ml-auto pr-2 type-label-lg text-on-surface-variant">{date}</span>
	</header>
	<Game {view} archive />
</main>
