<script lang="ts">
	import { untrack } from 'svelte';
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
		/** The viewer's final balance, or null when they haven't finished. */
		you: number | null;
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

	/** Bar heights, as a share of the plot. A non-empty bar never shrinks out of sight. */
	const heights = $derived(
		chart.groups.map((g) => (g.count === 0 ? 0 : Math.max(6, (g.count / peak) * 100)))
	);
	/** The YOU tag is wider than a bar, so it clears the taller neighbour too. */
	const tagAt = $derived(
		chart.mine < 0 ? 0 : Math.max(...heights.slice(Math.max(0, chart.mine - 1), chart.mine + 2))
	);

	// Grow in once, on a fresh finish. Dropping the class after keeps a resize or a data refresh
	// (which re-keys the bars) from replaying it.
	let growing = $state(untrack(() => animate));
	$effect(() => {
		if (!growing) return;
		const id = setTimeout(() => (growing = false), 3200);
		return () => clearTimeout(id);
	});

	const label = $derived.by(() => {
		const parts = [`Histogram of ${chart.total} final balances.`];
		if (pct != null) parts.push(`You finished ahead of ${pct}% of the other players.`);
		const g = chart.groups[chart.mine];
		if (g) {
			parts.push(
				`Your ${money(you!)} is in the ${g.open ? `${money(g.from)} or more` : `${money(g.from)} to ${money(g.to)}`} bar, with ${g.count - 1} ${g.count === 2 ? 'other' : 'others'}.`
			);
		}
		return parts.join(' ');
	});
</script>

<figure class={['histogram', growing && 'animate']} aria-label="Where everyone finished">
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
					<span class="you font-pixel" style:bottom="calc({tagAt}% + 6px)">YOU</span>
				{/if}
				<div
					class={[
						'bar',
						g.to <= START_BALANCE_CENTS ? 'down' : 'up',
						i === chart.mine && 'mine',
						chart.mine >= 0 && i > chart.mine && 'ahead'
					]}
					style:height="{heights[i]}%"
				></div>
			</div>
		{/each}
		<!-- Where everyone started. -->
		<div class="start" style:left="{startAt}%"></div>
	</div>

	<figcaption class="axis type-label-lg text-on-surface-variant" aria-hidden="true">
		<span class="absolute left-0">$0</span>
		<span class="absolute -translate-x-1/2" style:left="max({startAt}%, 4rem)"
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
		padding-bottom: 0.75rem;
	}
	/* The big number, on the arcade face's 8px grid, with the balance's hard drop. */
	.pct {
		font-size: 2rem;
		line-height: 1;
		color: var(--md-sys-color-primary);
		text-shadow: 0 3px 0 var(--pixel-ink, #000);
	}

	.plot {
		position: relative;
		display: flex;
		align-items: flex-end;
		gap: 4px;
		height: 8rem;
		padding-top: 1.5rem; /* room for the YOU tag over a full-height bar */
		border-bottom: 2px solid var(--md-sys-color-outline-variant);
	}
	@media (min-width: 1024px) {
		.plot {
			height: 10rem;
		}
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
		background: var(--hue);
	}
	.bar.down {
		--hue: var(--down);
	}
	.bar.up {
		--hue: var(--up);
	}
	/* Players who finished above you step back to an outline in the same colour; the ones you
	   beat stay lit. */
	.bar.ahead {
		background: color-mix(in srgb, var(--hue) 30%, transparent);
		box-shadow: inset 0 0 0 2px var(--hue);
	}
	/* Your bar: the ink frame sits inside it, so the gaps stay even. */
	.bar.mine {
		background: var(--md-sys-color-primary);
		box-shadow: inset 0 0 0 2px var(--pixel-ink, #000);
	}
	/* Above your bar and its neighbours (the plot's top padding leaves room over a full one). */
	.you {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
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
		height: 1.25rem;
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
