<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { liveStats } from '#lib/remote/stats.remote.ts';
	import { GAME_NAME } from '#lib/game/config.ts';
	import { dollars } from '#lib/play/money.ts';
	import { Button } from '#lib/components/ui/button/index.js';
	import CrowdCalls from '#lib/stats/CrowdCalls.svelte';
	import HourlyCalls from '#lib/stats/HourlyCalls.svelte';
	import HowItWorks from '#lib/stats/HowItWorks.svelte';
	import FinishCurve from '#lib/stats/FinishCurve.svelte';

	const live = liveStats();
	const s = $derived(await live);

	const fmt = (n: number) => n.toLocaleString('en-US');
	const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

	// Built as strings so template whitespace can't eat the space before a separator.
	const playersLine = $derived(
		s.finished === 0
			? 'Nobody has finished yet.'
			: `${fmt(s.finished)} finished, and ${pct(s.inProfit, s.finished)}% of them made money.`
	);
	const last24h = $derived(s.hourly.reduce((n, h) => n + h.calls, 0));

	const standing = $derived.by(() => {
		const you = s.you;
		if (!you) return null;
		if (s.finished > 1 && s.bestCents != null && you.balanceCents >= s.bestCents) {
			return 'The best finish today';
		}
		if (you.betterThan == null) return you.finished <= 1 ? 'The first to finish today' : null;
		// Small crowds read better as a place than a percentile ("3rd of 4", not "better than 0%").
		// The place and count are exact, the same ones the game's end screen uses.
		if (you.finished <= 20) {
			const place = Math.max(1, you.finished - Math.round(you.betterThan * (you.finished - 1)));
			const suffix =
				place % 10 === 1 && place % 100 !== 11
					? 'st'
					: place % 10 === 2 && place % 100 !== 12
						? 'nd'
						: place % 10 === 3 && place % 100 !== 13
							? 'rd'
							: 'th';
			return `${place}${suffix} of ${you.finished} players today`;
		}
		const pct = Math.round(you.betterThan * 100);
		return pct >= 50
			? `Better than ${pct}% of players today`
			: 'In the bottom half today. Tomorrow is another chart.';
	});
</script>

<svelte:head>
	<title>Live · {GAME_NAME}</title>
</svelte:head>

<main
	class="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[env(safe-area-inset-top)] pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:max-w-2xl md:px-6 lg:max-w-6xl lg:px-8"
>
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

	<!-- Wide screens: today's numbers on the left, the crowd's calls on the right. -->
	<div class="lg:mt-6 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-x-16">
		<div>
			<section class="pt-2">
				<p class="text-on-surface">
					<span class="type-display-md-emphasized type-numeric">{fmt(s.players)}</span>
					<span class="type-title-lg">{s.players === 1 ? 'player' : 'players'} today</span>
				</p>
				<p class="mt-1 type-body-lg text-on-surface-variant">{playersLine}</p>
			</section>

			{#if s.you}
				<section
					class={[
						'mt-6 rounded-m3-xl px-5 py-4',
						s.you.balanceCents >= 10000
							? 'bg-up-container text-on-up-container'
							: 'bg-surface-container-high text-on-surface'
					]}
				>
					<p>
						<span class="type-display-sm-emphasized type-numeric"
							>{dollars(s.you.balanceCents, { cents: false })}</span
						>
						<span class="type-title-md">your finish</span>
					</p>
					{#if standing}
						<p class="type-body-lg">{standing}</p>
					{/if}
				</section>
			{/if}

			{#if s.finished > 0 && s.medianCents != null && s.bestCents != null}
				<p class="mt-3 type-body-lg text-on-surface-variant">
					Median finish <span class="text-on-surface type-numeric"
						>{dollars(s.medianCents, { cents: false })}</span
					>, best
					<span class="text-on-surface type-numeric">{dollars(s.bestCents, { cents: false })}</span
					>.
				</p>
			{/if}

			<!-- Read straight from today's games, so it can be a tick ahead of the counts above. -->
			{#if s.finishes.length > 0}
				<section class="mt-8">
					<h2 class="type-title-md text-on-surface">Where everyone finished</h2>
					<div class="mt-3">
						<FinishCurve finishes={s.finishes} you={s.you?.balanceCents} />
					</div>
				</section>
			{/if}
		</div>
		<div>
			<section class="mt-8 lg:mt-2">
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
			</section>
		</div>
	</div>

	<footer class="mt-auto pt-10 lg:mt-0 lg:pt-12">
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
