<script lang="ts">
	import CircleHelp from '@lucide/svelte/icons/circle-help';
	import ChartColumn from '@lucide/svelte/icons/chart-column';
	import CircleUser from '@lucide/svelte/icons/circle-user';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import { IconButton } from '#lib/components/ui/icon-button/index.js';
	import { getGame } from '#lib/remote/game.remote.ts';
	import Game from '#lib/play/Game.svelte';
	import type { Component } from 'svelte';
	import { GAME_NAME } from '#lib/game/config.ts';

	const view = $derived(await getGame());
	let helpOpen = $state(false);
	let accountOpen = $state(false);

	// The sheets (and their drawer library) load on first open, keeping the first paint light.
	type Sheet = Component<{ open?: boolean; view: typeof view }>;
	let HelpSheet = $state<Sheet | null>(null);
	let AccountSheet = $state<Sheet | null>(null);

	async function openHelp() {
		HelpSheet ??= (await import('#lib/play/HelpSheet.svelte')).default as Sheet;
		helpOpen = true;
	}

	// First visit ever, before any call: show how to play once, like Wordle does.
	$effect(() => {
		if (view.results.length > 0) return;
		let seen = true;
		try {
			seen = localStorage.getItem('hindsight:seen-help') === '1';
			localStorage.setItem('hindsight:seen-help', '1');
		} catch {
			// Storage blocked: skip the auto-open rather than nag on every visit.
		}
		if (!seen) void openHelp();
	});
	async function openAccount() {
		AccountSheet ??= (await import('#lib/play/AccountSheet.svelte')).default as Sheet;
		accountOpen = true;
	}
</script>

<svelte:head>
	<title>{GAME_NAME} #{view.number}</title>
	<meta
		name="description"
		content="One famous chart a day. Five calls. Bet on what happens next."
	/>
</svelte:head>

<main
	class="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] md:max-w-2xl md:px-6 lg:max-w-7xl lg:px-8"
>
	<header class="-mx-2 flex h-14 items-center gap-1">
		<h1 class="px-2 type-title-lg-emphasized text-on-surface">{GAME_NAME}</h1>
		<span class="type-label-lg text-on-surface-variant type-numeric">#{view.number}</span>
		{#if view.streak > 1}
			<span class="ml-1 type-label-lg text-on-surface-variant type-numeric" title="Daily streak"
				>· {view.streak} day streak</span
			>
		{/if}
		<div class="ml-auto flex items-center">
			<IconButton aria-label="How to play" onclick={openHelp}>
				<CircleHelp />
			</IconButton>
			<IconButton href="/archive" aria-label="Past charts" class="hidden sm:inline-flex">
				<CalendarDays />
			</IconButton>
			<IconButton href="/stats" aria-label="Live stats">
				<ChartColumn />
			</IconButton>
			<IconButton
				aria-label={view.signedIn ? 'Your account' : 'Save your streak'}
				onclick={openAccount}
			>
				<CircleUser />
			</IconButton>
		</div>
	</header>
	<Game {view} />
</main>

{#if HelpSheet}
	<HelpSheet bind:open={helpOpen} {view} />
{/if}
{#if AccountSheet}
	<AccountSheet bind:open={accountOpen} {view} />
{/if}
