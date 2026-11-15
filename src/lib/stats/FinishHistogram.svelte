<script lang="ts">
	import { START_BALANCE_CENTS } from '#lib/game/config.ts';
	import { dollars } from '#lib/play/money.ts';
	import { groupFinishes, type FinishBucket } from './finishes.ts';

	let {
		finishes,
		you,
		betterThan,
		among = 'today',
		animate = true
	}: {
		/** Finishes per $10 bucket (lower edge in cents), as the server sends them. */
		finishes: FinishBucket[];
		/** The viewer's final balance. */
		you: number;
		/** Share of the other finishers the viewer beat (0–1), or null when they're alone. */
		betterThan: number | null;
		/** 'today' for today's chart, 'players' for a past day from the archive. */
		among?: 'today' | 'players';
		/** Grow the bars in (a fresh finish); off when coming back to a finished day. */
		animate?: boolean;
	} = $props();

	const chart = $derived(groupFinishes(finishes, you, 20));
	const peak = $derived(Math.max(1, ...chart.groups.map((g) => g.count)));
	const startAt = $derived((START_BALANCE_CENTS / chart.end) * 100);
	const pct = $derived(betterThan == null ? null : Math.round(betterThan * 100));

	const money = (cents: number) => dollars(cents, { cents: false });

	const label = $derived.by(() => {
		const parts = [`Histogram of ${chart.total} final balances.`];
		if (pct != null) parts.push(`You finished ahead of ${pct}% of the other players.`);
		const g = chart.groups[chart.mine];
		if (g) {
			parts.push(
				`Your ${money(you)} is in the ${g.open ? `${money(g.from)} or more` : `${money(g.from)} to ${money(g.to)}`} bar, with ${g.count - 1} ${g.count === 2 ? 'other' : 'others'}.`
			);
		}
		return parts.join(' ');
	});
</script>

<figure class={['histogram', animate && 'animate']}>
	{#if pct != null}
		<!-- The headline: the share of players the viewer finished above. -->
		<p class="headline">
			<span class="pct font-pixel">{pct}%</span>
			<span class="type-label-lg text-on-surface-variant">
				of {among === 'today' ? "today's" : 'the'} players finished below you
			</span>
		</p>
	{/if}

	<div class="plot" role="img" aria-label={label}>
		{#each chart.groups as g, i (g.from)}
			<div class="col" style:--i={i}>
				{#if i === chart.mine}
					<span class="you font-pixel">YOU</span>
				{/if}
				<div
					class={[
						'bar',
						g.to <= START_BALANCE_CENTS ? 'down' : 'up',
						i === chart.mine && 'mine',
						chart.mine >= 0 && i > chart.mine && 'ahead'
					]}
					style:height="{g.count === 0 ? 0 : Math.max(6, (g.count / peak) * 100)}%"
				></div>
			</div>
		{/each}
		<!-- Where everyone started. -->
		<div class="start" style:left="{startAt}%"></div>
	</div>

	<figcaption class="axis type-label-sm text-on-surface-variant" aria-hidden="true">
		<span class="absolute left-0">$0</span>
		<span class="absolute -translate-x-1/2" style:left="max({startAt}%, 2.5rem)"
			>Start {money(START_BALANCE_CENTS)}</span
		>
		<span class="absolute right-0"
			>{chart.capped ? `${money(chart.groups.at(-1)!.from)}+` : money(chart.end)}</span
		>
	</figcaption>
</figure>

<style>
	.headline {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.25rem 0.75rem;
		padding: 0 0.25rem 0.75rem;
	}
	.pct {
		font-size: 1.75rem;
		line-height: 1;
		color: var(--md-sys-color-primary);
		text-shadow:
			0 0 12px color-mix(in srgb, var(--md-sys-color-primary) 55%, transparent),
			0 3px 0 var(--pixel-ink, #000);
	}

	.plot {
		position: relative;
		display: flex;
		align-items: flex-end;
		gap: 3px;
		height: 8rem;
		padding-top: 1.5rem; /* room for the YOU tag over a full-height bar */
		border-bottom: 2px solid var(--md-sys-color-outline-variant);
		/* terminal graph paper, like the price chart */
		background-image:
			linear-gradient(var(--chart-grid) 1px, transparent 1px),
			linear-gradient(90deg, var(--chart-grid) 1px, transparent 1px);
		background-size: 16px 16px;
		background-position: bottom left;
		background-blend-mode: normal;
	}
	@media (min-width: 1024px) {
		.plot {
			height: 10rem;
		}
	}
	.plot::before {
		/* fade the grid back so the bars lead */
		content: '';
		position: absolute;
		inset: 0;
		background: color-mix(in srgb, var(--md-sys-color-surface) 75%, transparent);
		pointer-events: none;
	}
	.col {
		position: relative;
		z-index: 1;
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		height: 100%;
		min-width: 0;
	}
	.bar {
		width: 100%;
		transform-origin: bottom;
	}
	.bar.down {
		background: var(--down);
	}
	.bar.up {
		background: var(--up);
	}
	/* Players who finished above you step back; the ones you beat stay lit. */
	.bar.ahead {
		opacity: 0.3;
	}
	.bar.mine {
		background: var(--md-sys-color-primary);
		box-shadow:
			0 0 0 2px var(--pixel-ink, #000),
			0 0 14px color-mix(in srgb, var(--md-sys-color-primary) 70%, transparent);
	}
	/* Sits right on top of your bar (the plot's top padding leaves room over a full one). */
	.you {
		margin: -1.5rem -1rem 0.35rem;
		padding-top: 1.5rem;
		font-size: 8px;
		line-height: 1;
		color: var(--md-sys-color-primary);
		white-space: nowrap;
	}
	.start {
		position: absolute;
		top: 1.25rem;
		bottom: 0;
		z-index: 2;
		border-left: 2px dashed var(--md-sys-color-outline);
		pointer-events: none;
	}
	.axis {
		position: relative;
		display: block;
		height: 1rem;
		margin-top: 0.375rem;
	}

	/* A fresh finish: bars grow in left to right, then your bar flashes and the tag drops in. */
	.animate .bar {
		animation: grow 500ms cubic-bezier(0.2, 0.8, 0.2, 1) calc(200ms + var(--i) * 45ms) both;
	}
	.animate .bar.mine {
		animation:
			grow 500ms cubic-bezier(0.2, 0.8, 0.2, 1) calc(200ms + var(--i) * 45ms) both,
			flash 300ms steps(1) calc(900ms + var(--i) * 45ms) 4;
	}
	.animate .you {
		animation: drop 400ms cubic-bezier(0.2, 0.8, 0.2, 1) calc(900ms + var(--i) * 45ms) both;
	}
	.animate .pct {
		animation: drop 400ms cubic-bezier(0.2, 0.8, 0.2, 1) 150ms both;
	}
	@keyframes grow {
		from {
			transform: scaleY(0);
		}
	}
	@keyframes flash {
		50% {
			background: var(--md-sys-color-on-surface);
		}
	}
	@keyframes drop {
		from {
			opacity: 0;
			translate: 0 -8px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.animate .bar,
		.animate .bar.mine,
		.animate .you,
		.animate .pct {
			animation: none;
		}
	}
</style>
