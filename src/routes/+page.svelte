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
	import SoundButton from '#lib/play/SoundButton.svelte';

	const view = $derived(await getGame());
	/** The day's date, newspaper style ("Sat, Nov 14, 2026"), in parts so narrow phones can drop
	 * the weekday and year. Fixed locale and zone, so the server and the browser agree. */
	const issueDate = $derived.by(() => {
		const d = new Date(view.date + 'T12:00:00Z');
		const part = (o: Intl.DateTimeFormatOptions) =>
			d.toLocaleDateString('en-US', { ...o, timeZone: 'UTC' });
		return {
			weekday: part({ weekday: 'short' }),
			day: part({ month: 'short', day: 'numeric' }),
			year: part({ year: 'numeric' })
		};
	});
	let helpOpen = $state(false);
	let accountOpen = $state(false);

	// The sheets (and their drawer library) load on first open, keeping the first paint light.
	type Sheet = Component<{ open?: boolean; view: typeof view }>;
	let HelpSheet = $state<Sheet | null>(null);
	let AccountSheet = $state<Sheet | null>(null);

	async function openHelp(auto = false) {
		HelpSheet ??= (await import('#lib/play/HelpSheet.svelte')).default as Sheet;
		// The sheet's code can take a while to load (seconds in dev, or on a slow phone). If the
		// player has started meanwhile, don't drop the help over their game.
		if (auto && view.results.length > 0) return;
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
		if (!seen) void openHelp(true);
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
		<h1
			class="glitch-text font-pixel text-2xl leading-none uppercase [--glitch-drop:3px] md:text-[2.5rem] md:[--glitch-drop:5px]"
		>
			{GAME_NAME}
		</h1>
		<p class="tagline neon-text mt-2 type-title-md md:mt-3 md:type-title-lg">The daily hunt</p>
		<p
			class="mt-0.5 type-label-lg tracking-[0.12em] whitespace-nowrap text-on-surface-variant uppercase type-numeric [text-shadow:0_2px_0_var(--pixel-ink)]"
		>
			Issue #{view.number}&ensp;·&ensp;<time datetime={view.date}
				><span class="max-[374px]:hidden">{`${issueDate.weekday}, `}</span>{issueDate.day}<span
					class="max-[374px]:hidden">{`, ${issueDate.year}`}</span
				></time
			>
		</p>
		{#if view.streak > 1}
			<p
				class="streak text-m3-tertiary type-label-lg tracking-[0.12em] whitespace-nowrap uppercase type-numeric [text-shadow:0_2px_0_var(--pixel-ink)]"
			>
				{view.streak} day streak
			</p>
		{/if}
		{#snippet actions()}
			<IconButton
				class="pixel-panel"
				variant="tonal"
				size="sm"
				aria-label="How to play"
				onclick={() => openHelp()}
			>
				<CircleHelp />
			</IconButton>
			<SoundButton />
			<IconButton
				class="pixel-panel"
				variant="tonal"
				size="sm"
				href="/archive"
				aria-label="Past charts"
			>
				<CalendarDays />
			</IconButton>
			<IconButton
				class="pixel-panel"
				variant="tonal"
				size="sm"
				href="/stats"
				aria-label="Live stats"
			>
				<ChartColumn />
			</IconButton>
			<IconButton
				class="pixel-panel"
				variant="tonal"
				size="sm"
				aria-label={view.signedIn ? 'Your account' : 'Save your streak'}
				onclick={openAccount}
			>
				<CircleUser />
			</IconButton>
		{/snippet}
	</WolfScene>
	<main
		class="mx-auto flex w-full max-w-md flex-1 flex-col pt-4 px-safe pb-safe md:max-w-2xl md:[--gutter:1.5rem] lg:max-w-7xl lg:[--gutter:2rem]"
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
