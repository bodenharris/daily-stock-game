<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { liveStats } from '#lib/remote/stats.remote.ts';
	import { GAME_NAME } from '#lib/game/config.ts';
	import { dollars } from '#lib/play/money.ts';
	import { Button } from '#lib/components/ui/button/index.js';
	import CrowdCalls from '#lib/stats/CrowdCalls.svelte';
	import HourlyCalls from '#lib/stats/HourlyCalls.svelte';
	import HowItWorks from '#lib/stats/HowItWorks.svelte';

	const live = liveStats();
	const s = $derived(await live);

	const fmt = (n: number) => n.toLocaleString('en-US');
	const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

	// Built as strings so template whitespace can't eat the space before a separator.
	const playersLine = $derived(
		(s.players === 1 ? 'player today' : 'players today') +
			(s.finished > 0 ? ` · ${pct(s.inProfit, s.finished)}% finished up` : '')
	);
	const last24h = $derived(s.hourly.reduce((n, h) => n + h.calls, 0));

	const standing = $derived.by(() => {
		const you = s.you;
		if (!you) return null;
		if (s.finished > 1 && s.bestCents != null && you.balanceCents >= s.bestCents) {
			return 'The best finish today';
		}
		if (you.betterThan == null) return s.finished <= 1 ? 'The first to finish today' : null;
		return `Better than ${Math.round(you.betterThan * 100)}% of players today`;
	});
</script>

<svelte:head>
	<title>Live · {GAME_NAME}</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-6">
	<header class="flex h-14 items-center gap-2">
		<a
			href="/"
			class="-ml-2 grid size-12 place-items-center rounded-full text-on-surface-variant hover:bg-on-surface/8"
			aria-label="Back to the game"
		>
			<ArrowLeft class="size-6" />
		</a>
		<h1 class="type-title-lg-emphasized text-on-surface">Today, live</h1>
		<span
			class="ml-auto flex items-center gap-1.5 type-label-md text-on-surface-variant"
			title={live.connected ? 'Updating live' : 'Reconnecting'}
		>
			<span class={['dot', !live.connected && 'off']}></span>
			#{s.number}
		</span>
	</header>

	<section class="pt-2">
		<p class="type-display-md-emphasized text-on-surface type-numeric">{fmt(s.players)}</p>
		<p class="type-body-lg text-on-surface-variant">{playersLine}</p>
	</section>

	{#if s.you}
		<section class="mt-6 rounded-m3-xl bg-primary-container p-5 text-on-primary-container">
			<h2 class="type-label-lg">You finished with</h2>
			<p class="type-display-sm-emphasized type-numeric">
				{dollars(s.you.balanceCents, { cents: false })}
			</p>
			{#if standing}
				<p class="mt-1 type-body-lg">{standing}</p>
			{/if}
		</section>
	{/if}

	{#if s.finished > 0}
		<section class="mt-3 grid grid-cols-2 gap-3">
			<div class="rounded-m3-xl bg-surface-container p-4">
				<h2 class="type-label-md text-on-surface-variant">Median finish</h2>
				<p class="type-headline-sm-emphasized text-on-surface type-numeric">
					{s.medianCents == null ? '–' : dollars(s.medianCents, { cents: false })}
				</p>
			</div>
			<div class="rounded-m3-xl bg-surface-container p-4">
				<h2 class="type-label-md text-on-surface-variant">Best finish</h2>
				<p class="type-headline-sm-emphasized text-on-surface type-numeric">
					{s.bestCents == null ? '–' : dollars(s.bestCents, { cents: false })}
				</p>
			</div>
		</section>
	{/if}

	<section class="mt-8">
		<h2 class="type-title-md text-on-surface">How the crowd called it</h2>
		{#if s.calls}
			<div class="mt-3">
				<CrowdCalls calls={s.calls} />
			</div>
		{:else}
			<p class="mt-1 type-body-md text-on-surface-variant">
				Finish today's chart to see how everyone called each move.
			</p>
			<Button href="/" variant="tonal" size="sm" class="mt-3">Play today's chart</Button>
		{/if}
	</section>

	<section class="mt-8">
		<div class="flex items-baseline justify-between gap-2">
			<h2 class="type-title-md text-on-surface">Last 24 hours</h2>
			<p class="type-label-lg text-on-surface-variant type-numeric">
				{last24h === 0 ? 'No calls yet' : `${fmt(last24h)} ${last24h === 1 ? 'call' : 'calls'}`}
			</p>
		</div>
		<div class="mt-3">
			<HourlyCalls hourly={s.hourly} />
		</div>
		<p class="mt-3 type-body-sm text-on-surface-variant type-numeric">
			{fmt(s.allTime.calls)}
			{s.allTime.calls === 1 ? 'call' : 'calls'} since launch
		</p>
	</section>

	<footer class="mt-auto pt-10">
		<HowItWorks data={s.data} queryMs={s.queryMs} />
	</footer>
</main>

<style>
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 9999px;
		background: var(--up);
		box-shadow: 0 0 0 0 color-mix(in srgb, var(--up) 50%, transparent);
		animation: pulse 2s infinite;
	}
	.dot.off {
		background: var(--md-sys-color-outline);
		animation: none;
	}
	@keyframes pulse {
		70% {
			box-shadow: 0 0 0 8px transparent;
		}
		100% {
			box-shadow: 0 0 0 0 transparent;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.dot {
			animation: none;
		}
	}
</style>
