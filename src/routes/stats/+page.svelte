<script lang="ts">
	import { liveStats } from '#lib/remote/stats.remote.ts';
	import { GAME_NAME } from '#lib/game/config.ts';
	import { dollars } from '#lib/play/money.ts';
	import { standingText } from '#lib/play/standing.ts';
	import { packRank, rankLine } from '#lib/game/rank.ts';
	import { Button } from '#lib/components/ui/button/index.js';
	import CrowdCalls from '#lib/stats/CrowdCalls.svelte';
	import HourlyCalls from '#lib/stats/HourlyCalls.svelte';
	import HowItWorks from '#lib/stats/HowItWorks.svelte';
	import FinishHistogram from '#lib/stats/FinishHistogram.svelte';
	import WolfScene from '#lib/brand/WolfScene.svelte';

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

	/** The same rank line as the end card and the share text, from the same exact place. */
	const standing = $derived.by(() => {
		const rank = s.you && packRank(s.you);
		return rank ? rankLine(rank, standingText(s.you)) : null;
	});
</script>

<svelte:head>
	<title>Live · {GAME_NAME}</title>
</svelte:head>

<div class="flex min-h-dvh flex-col">
	<WolfScene
		title="Live stats"
		back={{ href: '/', label: "Back to today's chart" }}
		maxWidth="72rem"
	>
		<span class={['dot', !live.connected && 'off']} aria-hidden="true"></span>
		Issue #{s.number}&ensp;·&ensp;{live.connected ? 'Live' : 'Reconnecting'}
	</WolfScene>

	<main
		class="mx-auto flex w-full max-w-md flex-1 flex-col pt-6 px-safe pb-safe md:max-w-2xl md:[--gutter:1.5rem] lg:max-w-6xl lg:pt-8 lg:[--gutter:2rem]"
	>
		<!-- Wide screens: today's numbers on the left, the crowd's calls on the right. -->
		<div class="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-x-12">
			<div class="flex flex-col gap-7">
				<section>
					<p class="text-on-surface">
						<span class="type-display-md-emphasized type-numeric">{fmt(s.players)}</span>
						<span class="type-title-lg">{s.players === 1 ? 'player' : 'players'} today</span>
					</p>
					<p class="mt-1 type-body-lg text-on-surface-variant">{playersLine}</p>
					{#if s.finished > 0 && s.medianCents != null && s.bestCents != null}
						<p class="type-body-lg text-on-surface-variant">
							Median finish <span class="text-on-surface type-numeric"
								>{dollars(s.medianCents)}</span
							>, best
							<span class="text-on-surface type-numeric">{dollars(s.bestCents)}</span>.
						</p>
					{/if}
				</section>

				{#if s.you}
					<section
						class={[
							'pixel-panel px-5 py-4',
							s.you.balanceCents >= 10000
								? 'bg-up-container text-on-up-container'
								: 'bg-surface-container-high text-on-surface'
						]}
					>
						<!-- A sentence, not a second big number: the player count above is the headline. -->
						<p class="type-title-lg">
							You finished on <span class="type-numeric">{dollars(s.you.balanceCents)}</span>.
						</p>
						{#if standing}
							<p class="type-body-lg">{standing}</p>
						{/if}
					</section>
				{/if}

				<!-- Read straight from today's games, so it can be a tick ahead of the counts above. -->
				{#if s.finishes.length > 0}
					<section class="panel pixel-panel">
						<h2 class="type-title-md text-on-surface">Where everyone finished</h2>
						<div class="mt-3">
							<FinishHistogram
								finishes={s.finishes}
								you={s.you?.balanceCents ?? null}
								animate={false}
							/>
						</div>
					</section>
				{/if}
			</div>
			<div class="mt-7 flex flex-col gap-7 lg:mt-0">
				<section class="panel pixel-panel">
					<h2 class="type-title-md text-on-surface">How the crowd called it</h2>
					{#if s.calls}
						<div class="mt-3">
							<CrowdCalls calls={s.calls} />
						</div>
					{:else}
						<p class="mt-1 type-body-md text-on-surface-variant">
							Finish today's chart to see how everyone called each move.
						</p>
						<Button href="/" variant="filled" size="sm" class="pixel-frame mt-4"
							>Play today's chart</Button
						>
					{/if}
				</section>

				<section class="panel pixel-panel">
					<div class="flex items-baseline justify-between gap-2">
						<h2 class="type-title-md text-on-surface">Last 24 hours</h2>
						<p class="type-label-lg text-on-surface-variant type-numeric">
							{last24h === 0
								? 'No calls yet'
								: `${fmt(last24h)} ${last24h === 1 ? 'call' : 'calls'}`}
						</p>
					</div>
					<div class="mt-3">
						<HourlyCalls hourly={s.hourly} />
					</div>
				</section>
			</div>
		</div>

		<footer class="pt-10 lg:pt-12">
			<HowItWorks data={s.data} queryMs={s.queryMs} />
		</footer>
	</main>
</div>

<style>
	.panel {
		padding: 1rem 1rem 1.25rem;
		background: var(--md-sys-color-surface-container-low);
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 0;
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
