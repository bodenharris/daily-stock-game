<script lang="ts">
	import WolfScene from '#lib/brand/WolfScene.svelte';
	import { GAME_NAME } from '#lib/game/config.ts';
	import Game from '#lib/play/Game.svelte';
	import SoundButton from '#lib/play/SoundButton.svelte';
	import { formatDate } from '#lib/play/format.ts';
	import { getDay } from '#lib/remote/game.remote.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const view = $derived(await getDay(data.number));
</script>

<svelte:head>
	<title>{GAME_NAME} #{view.number}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex min-h-dvh flex-col">
	<WolfScene
		title="Issue #{view.number}"
		back={{ href: '/archive', label: 'Back to past charts' }}
		maxWidth="80rem"
	>
		<time datetime={view.date}>
			{formatDate(view.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
		</time>
		{#snippet actions()}
			<SoundButton />
		{/snippet}
	</WolfScene>
	<main
		class="mx-auto flex w-full max-w-md flex-1 flex-col pt-4 px-safe pb-safe md:max-w-2xl md:[--gutter:1.5rem] lg:max-w-7xl lg:[--gutter:2rem]"
	>
		<Game {view} archive />
	</main>
</div>
