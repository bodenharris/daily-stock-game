<script lang="ts">
	import CircleHelp from '@lucide/svelte/icons/circle-help';
	import ChartColumn from '@lucide/svelte/icons/chart-column';
	import CircleUser from '@lucide/svelte/icons/circle-user';
	import { IconButton } from '#lib/components/ui/icon-button/index.js';
	import { getGame } from '#lib/remote/game.remote.ts';
	import Game from '#lib/play/Game.svelte';
	import HelpSheet from '#lib/play/HelpSheet.svelte';
	import AccountSheet from '#lib/play/AccountSheet.svelte';
	import { GAME_NAME } from '#lib/game/config.ts';

	const view = $derived(await getGame());
	let helpOpen = $state(false);
	let accountOpen = $state(false);
</script>

<svelte:head>
	<title>{GAME_NAME} #{view.number}</title>
	<meta
		name="description"
		content="One famous chart a day. Five calls. Bet on what happens next."
	/>
</svelte:head>

<main class="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4">
	<header class="-mx-2 flex h-14 items-center gap-1">
		<h1 class="px-2 type-title-lg-emphasized text-on-surface">{GAME_NAME}</h1>
		<span class="type-label-lg text-on-surface-variant type-numeric">#{view.number}</span>
		{#if view.streak > 1}
			<span class="ml-1 type-label-lg text-on-surface-variant type-numeric" title="Daily streak"
				>· {view.streak} day streak</span
			>
		{/if}
		<div class="ml-auto flex items-center">
			<IconButton aria-label="How to play" onclick={() => (helpOpen = true)}>
				<CircleHelp />
			</IconButton>
			<IconButton href="/stats" aria-label="Live stats">
				<ChartColumn />
			</IconButton>
			<IconButton
				aria-label={view.signedIn ? 'Your account' : 'Save your streak'}
				onclick={() => (accountOpen = true)}
			>
				<CircleUser />
			</IconButton>
		</div>
	</header>
	<Game {view} />
</main>

<HelpSheet bind:open={helpOpen} />
<AccountSheet bind:open={accountOpen} {view} />
