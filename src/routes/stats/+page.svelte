<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import WolfScene from '#lib/brand/WolfScene.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { GAME_NAME, START_BALANCE_CENTS } from '#lib/game/config.ts';
	import { packRank, rankLine } from '#lib/game/rank.ts';
	import { dollars } from '#lib/play/format.ts';
	import { standingText } from '#lib/play/standing.ts';
	import { liveStats } from '#lib/remote/stats.remote.ts';
	import FinishHistogram from '#lib/stats/FinishHistogram.svelte';

	const TICK_MS = 4000;

	const stats = liveStats();
	// `current` keeps the last good numbers when a refresh fails; awaiting would throw instead.
	const s = $derived(stats.current ?? (await stats));
	/** Off from a failed refresh until the next one goes through. */
	const live = $derived(!stats.error);

	function refresh() {
		// A hidden tab doesn't ask, so a forgotten tab never keeps the database awake.
		if (document.visibilityState === 'visible') void stats.refresh();
	}

	$effect(() => {
		const id = setInterval(refresh, TICK_MS);
		return () => clearInterval(id);
	});

	const fmt = (n: number) => n.toLocaleString('en-US');
	/** a as a whole percentage of b; an even split when there is nothing to count yet. */
	const percent = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 50);

	// Built as strings so template whitespace can't eat the space before a separator.
	const playersLine = $derived(
		s.finished === 0
			? 'Nobody has finished yet.'
			: `${fmt(s.finished)} finished, and ${percent(s.inProfit, s.finished)}% of them made money.`
	);
	const last24h = $derived(s.hourly.reduce((n, h) => n + h.calls, 0));
	const busiestHour = $derived(Math.max(1, ...s.hourly.map((h) => h.calls)));
	const prices = $derived(
		s.data.priceRows >= 1_000_000
			? `${(s.data.priceRows / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 })} million`
			: fmt(s.data.priceRows)
	);

	/** The same rank line as the end card and the share text, from the same exact place. */
	const standing = $derived.by(() => {
		const rank = s.you && packRank(s.you);
		if (!rank) return null;
		// Alone on the board there's no place to give, so say what the rank means instead.
		return rankLine(rank, standingText(s.you) ?? 'the first to finish today');
	});
</script>

<!-- Back on the tab: catch up now rather than on the next tick. -->
<svelte:document onvisibilitychange={refresh} />

<svelte:head>
	<title>Live · {GAME_NAME}</title>
</svelte:head>

<div class="flex min-h-dvh flex-col">
	<WolfScene
		title="Live stats"
		back={{ href: '/', label: "Back to today's chart" }}
		maxWidth="72rem"
	>
		<span class={['dot', !live && 'off']} aria-hidden="true"></span>
		Issue #{s.number}&ensp;·&ensp;{live ? 'Live' : 'Reconnecting'}
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
							Median finish <span class="text-on-surface type-numeric">
								{dollars(s.medianCents)}
							</span>, best
							<span class="text-on-surface type-numeric">{dollars(s.bestCents)}</span>.
						</p>
					{/if}
				</section>

				{#if s.you}
					<section
						class={[
							'pixel-panel px-5 py-4',
							s.you.balanceCents >= START_BALANCE_CENTS
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
						<ol class="mt-3 flex flex-col gap-5">
							{#each s.calls as call (call.step)}
								{@const up = percent(call.ups, call.calls)}
								{@const upWon = call.answer === 'up'}
								<li>
									<p class="sr-only">
										Call {call.step}: {up}% called up, {100 - up}% called down. It went {call.answer}.
										{#if call.you}You called {call.you}.{/if}
									</p>
									<div aria-hidden="true">
										<!-- Which call, and yours: green if you were right, pink if not. -->
										<p class="type-label-md text-on-surface-variant">
											Call {call.step}{#if call.you}&ensp;·&ensp;you:
												<span class={call.you === call.answer ? 'text-up' : 'text-down'}>
													{call.you}
												</span>{/if}
										</p>
										<div
											class="mt-0.5 flex items-baseline justify-between gap-2 type-label-lg type-numeric"
										>
											<span
												class={[
													'flex items-center gap-1',
													upWon ? 'text-up' : 'text-on-surface-variant'
												]}
											>
												{#if upWon}<Check class="size-4" strokeWidth={3} />{/if}
												{up}% up
											</span>
											<span
												class={[
													'flex items-center gap-1',
													upWon ? 'text-on-surface-variant' : 'text-up'
												]}
											>
												{100 - up}% down
												{#if !upWon}<Check class="size-4" strokeWidth={3} />{/if}
											</span>
										</div>
										<!-- Green is the side that was right, whichever direction that was. -->
										<div class="mt-1.5 flex h-3 gap-0.5">
											<div
												class={['split', upWon ? 'bg-up' : 'bg-surface-container-highest']}
												style:width="{up}%"
											></div>
											<div
												class={['split flex-1', upWon ? 'bg-surface-container-highest' : 'bg-up']}
											></div>
										</div>
									</div>
								</li>
							{/each}
						</ol>
					{:else}
						<p class="mt-1 type-body-md text-on-surface-variant">
							Finish today's chart to see how everyone called each move.
						</p>
						<Button href="/" variant="filled" size="sm" class="mt-4">Play today's chart</Button>
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
					<!-- Relative labels, not clock times: the server's hours would not match the viewer's zone. -->
					<figure class="mt-3">
						<div
							class="flex h-16 items-end gap-px border-b border-outline-variant lg:h-28 lg:gap-0.5"
							role="img"
							aria-label="Calls per hour over the last 24 hours"
						>
							{#each s.hourly as h (h.at)}
								<div class="flex h-full flex-1 items-end">
									{#if h.calls > 0}
										<div
											class="hour w-full bg-m3-primary"
											style:height="{Math.max(8, (h.calls / busiestHour) * 100)}%"
										></div>
									{/if}
								</div>
							{/each}
						</div>
						<figcaption
							class="mt-1.5 grid grid-cols-3 type-label-sm text-on-surface-variant"
							aria-hidden="true"
						>
							<span>24h ago</span>
							<span class="text-center">12h ago</span>
							<span class="text-end">Now</span>
						</figcaption>
					</figure>
				</section>
			</div>
		</div>

		<footer class="pt-10 lg:pt-12">
			<details class="group pixel-panel bg-surface-container-low text-on-surface-variant">
				<summary
					class="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 type-label-lg select-none hover:bg-on-surface/8 [&::-webkit-details-marker]:hidden"
				>
					How this page works
					<ChevronDown
						class="ml-auto size-5 shrink-0 group-open:rotate-180 motion-safe:transition-transform motion-safe:duration-200"
					/>
				</summary>
				<ul class="flex flex-col gap-2 px-4 pt-1 pb-4 type-body-sm">
					<li>Every call is saved to a Postgres database, on Neon, the moment it's made.</li>
					<li>The crowd's split and the payouts are counted straight from those calls.</li>
					<li>
						The median, the curve and your rank come from one SQL query over today's finishes.
					</li>
					<li class="type-numeric">
						{`${prices} daily prices across ${s.data.tickers} tickers sit in the same database.`}
					</li>
					<li class="type-numeric">Fetching this page's numbers took {s.queryMs} ms.</li>
				</ul>
			</details>
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
	/* The bars ease to each tick's numbers. */
	.split {
		min-width: 4px;
		transition: width 600ms var(--md-sys-motion-spring-default-spatial-easing);
	}
	.hour {
		transition: height 600ms var(--md-sys-motion-spring-default-spatial-easing);
	}
	@media (prefers-reduced-motion: reduce) {
		.dot {
			animation: none;
		}
		.split,
		.hour {
			transition: none;
		}
	}
</style>
