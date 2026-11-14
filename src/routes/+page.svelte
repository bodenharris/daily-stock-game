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
	import WolfScene from '#lib/brand/WolfScene.svelte';

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
			seen = localStorage.getItem('thewolf:seen-help') === '1';
			localStorage.setItem('thewolf:seen-help', '1');
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

<div class="flex min-h-dvh flex-col">
	<WolfScene>
		<h1 class="glitch-text font-pixel text-[1.375rem] leading-none uppercase md:text-[2.5rem]">
			{GAME_NAME}
		</h1>
		<p class="neon-text mt-2 type-title-md md:type-title-lg">The daily hunt</p>
		<p class="type-label-lg tracking-[0.12em] text-on-surface-variant uppercase type-numeric">
			Hunt #{view.number}{#if view.streak > 1}<span title="Daily streak"
					>&ensp;·&ensp;{view.streak} day streak</span
				>{/if}
		</p>
		{#snippet actions()}
			<IconButton
				class="pixel-panel"
				variant="tonal"
				size="xs"
				aria-label="How to play"
				onclick={openHelp}
			>
				<CircleHelp />
			</IconButton>
			<IconButton
				class="pixel-panel hidden sm:inline-flex"
				variant="tonal"
				size="xs"
				href="/archive"
				aria-label="Past charts"
			>
				<CalendarDays />
			</IconButton>
			<IconButton
				class="pixel-panel"
				variant="tonal"
				size="xs"
				href="/stats"
				aria-label="Live stats"
			>
				<ChartColumn />
			</IconButton>
			<IconButton
				class="pixel-panel"
				variant="tonal"
				size="xs"
				aria-label={view.signedIn ? 'Your account' : 'Save your streak'}
				onclick={openAccount}
			>
				<CircleUser />
			</IconButton>
		{/snippet}
	</WolfScene>
	<main
		class="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-4 pb-[env(safe-area-inset-bottom)] md:max-w-2xl md:px-6 lg:max-w-7xl lg:px-8"
	>
		<Game {view} />
	</main>
</div>

{#if HelpSheet}
	<HelpSheet bind:open={helpOpen} {view} />
{/if}
{#if AccountSheet}
	<AccountSheet bind:open={accountOpen} {view} />
{/if}
