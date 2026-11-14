<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { liveStats } from '#lib/remote/stats.remote.ts';
	import { GAME_NAME } from '#lib/game/config.ts';
	import { dollars } from '#lib/play/money.ts';

	const live = liveStats();
	const s = $derived(await live);

	const maxHourly = $derived(Math.max(1, ...s.hourly.map((h) => h.calls)));
	const fmt = (n: number) => n.toLocaleString('en-US');
	const compact = (n: number) =>
		n.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });
	const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
</script>

<svelte:head>
	<title>Live · {GAME_NAME}</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-10">
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
			<span class="dot" class:off={!live.connected}></span>
			#{s.number}
		</span>
	</header>

	<section class="pt-4">
		<p class="type-display-md-emphasized text-on-surface type-numeric">{fmt(s.players)}</p>
		<p class="type-body-lg text-on-surface-variant">
			{s.players === 1 ? 'player' : 'players'} today{#if s.finished > 0}
				· {pct(s.inProfit, s.finished)}% finished up{/if}
		</p>
	</section>

	{#if s.finished > 0}
		<section class="mt-6 grid grid-cols-2 gap-3">
			<div class="rounded-m3-xl bg-surface-container p-4">
				<p class="type-label-md text-on-surface-variant">Median finish</p>
				<p class="type-headline-sm-emphasized text-on-surface type-numeric">
					{s.medianCents == null ? '–' : dollars(s.medianCents, { cents: false })}
				</p>
			</div>
			<div class="rounded-m3-xl bg-surface-container p-4">
				<p class="type-label-md text-on-surface-variant">Best finish</p>
				<p class="type-headline-sm-emphasized text-on-surface type-numeric">
					{s.bestCents == null ? '–' : dollars(s.bestCents, { cents: false })}
				</p>
			</div>
		</section>
	{/if}

	<section class="mt-8">
		<h2 class="type-title-md text-on-surface">How the crowd called it</h2>
		{#if !s.viewerFinished}
			<p class="mt-2 type-body-md text-on-surface-variant">
				Finish today's game to see how everyone else called each move.
			</p>
		{:else if s.steps.length === 0}
			<p class="mt-2 type-body-md text-on-surface-variant">No calls yet.</p>
		{:else}
			<ol class="mt-3 flex flex-col gap-3">
				{#each s.steps as step (step.step)}
					{@const up = pct(step.ups, step.calls)}
					<li>
						<div class="flex justify-between type-label-md text-on-surface-variant">
							<span>Call {step.step}</span>
							<span class="type-numeric">{pct(step.correct, step.calls)}% got it right</span>
						</div>
						<div class="mt-1 flex h-3 gap-0.5 overflow-hidden rounded-full">
							<div class="bar bg-up" style:width="{up}%"></div>
							<div class="bar flex-1 bg-down"></div>
						</div>
						<div class="mt-1 flex justify-between type-label-sm type-numeric">
							<span class="text-up">{up}% up</span>
							<span class="text-down">{100 - up}% down</span>
						</div>
					</li>
				{/each}
			</ol>
		{/if}
	</section>

	<section class="mt-8">
		<h2 class="type-title-md text-on-surface">Calls in the last 24 hours</h2>
		<div class="mt-3 flex h-20 items-end gap-0.5" aria-hidden="true">
			{#each s.hourly as h (h.at)}
				<div
					class="bar flex-1 rounded-t-sm {h.calls > 0
						? 'bg-m3-primary'
						: 'bg-surface-container-high'}"
					style:height="{Math.max(4, (h.calls / maxHourly) * 100)}%"
				></div>
			{/each}
		</div>
		<p class="mt-2 type-body-sm text-on-surface-variant">
			{fmt(s.allTime.calls)} calls since launch.
		</p>
	</section>

	<footer class="mt-auto pt-10 type-body-sm text-on-surface-variant">
		<p>
			Every call lands in a TimescaleDB hypertable on Tiger Data; this page reads continuous
			aggregates of it, refreshed live.
		</p>
		<p class="mt-2 type-numeric">
			{compact(s.data.priceRows)} daily prices · {s.data.tickers} tickers{#if s.data.compressionRatio}
				· {s.data.compressionRatio.toFixed(1)}× compressed{/if} · queried in {s.queryMs} ms
		</p>
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
	.bar {
		transition:
			width 600ms var(--md-sys-motion-spring-default-spatial-easing, ease),
			height 600ms var(--md-sys-motion-spring-default-spatial-easing, ease);
	}
	@media (prefers-reduced-motion: reduce) {
		.dot {
			animation: none;
		}
	}
</style>
