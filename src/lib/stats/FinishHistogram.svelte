<script lang="ts">
	import { untrack } from 'svelte';
	import { FINISH_CAP_CENTS, START_BALANCE_CENTS } from '#lib/game/config.ts';
	import { dollars } from '#lib/play/format.ts';
	import type { FinishBucket } from '#lib/play/types.ts';
	import { finishCurve, groupFinishes } from './finishes.ts';

	/**
	 * Where everyone finished: a smooth curve over the final balances, pink below the $100 start
	 * and green above it, with a dot for the viewer's exact finish. Nobody is named.
	 */
	let {
		finishes,
		you,
		animate = true
	}: {
		/** Finishes per $10 bucket (lower edge in cents), as the server sends them. */
		finishes: FinishBucket[];
		/** The viewer's final balance, or null when they haven't finished. */
		you: number | null;
		/** Draw the curve in (a fresh finish); off when coming back to a finished day. */
		animate?: boolean;
	} = $props();

	/** Steps along the curve; enough that the straight segments read as one smooth line. */
	const SAMPLES = 120;
	/** The SVG's own units: x runs 0–W, y runs 0–H from the top. */
	const W = 1000;
	const H = 100;

	// The groups set the axis and back the hover readout and the screen-reader text.
	const chart = $derived(groupFinishes(finishes, you, 20));
	const curve = $derived(finishCurve(finishes, chart.end, SAMPLES));

	/** Where along the axis (0–1) everyone started and where the viewer ended. */
	const startAt = $derived(START_BALANCE_CENTS / chart.end);
	const youAt = $derived(you == null ? null : Math.min(you, FINISH_CAP_CENTS) / chart.end);
	/** The curve's height (0–1) at the viewer's finish, read between the two nearest steps. */
	const youHeight = $derived.by(() => {
		if (youAt == null) return 0;
		const at = youAt * SAMPLES;
		const i = Math.min(SAMPLES - 1, Math.floor(at));
		return curve[i] + (curve[i + 1] - curve[i]) * (at - i);
	});

	const points = $derived(curve.map((v, i) => `${(i / SAMPLES) * W},${H - v * H}`).join(' L'));

	/**
	 * The fill, as hard colour stops: pink below the start, green above it, and everything past
	 * the viewer's finish (the players who beat them) stepped back to a faint tint.
	 */
	const fillStops = $derived.by(() => {
		const edges = [...new Set([0, startAt, youAt ?? 1, 1])]
			.filter((e) => e >= 0 && e <= 1)
			.sort((a, b) => a - b);
		return edges.slice(1).flatMap((to, k) => {
			const from = edges[k];
			const mid = (from + to) / 2;
			const hue = mid < startAt ? 'var(--down)' : 'var(--up)';
			const opacity = youAt == null || mid < youAt ? 0.55 : 0.16;
			return [
				{ offset: from, hue, opacity },
				{ offset: to, hue, opacity }
			];
		});
	});

	// Each chart on the page needs its own gradient ids.
	const id = $props.id();

	// Grow in once, on a fresh finish. Dropping the class after keeps a resize or a data refresh
	// from replaying it.
	let growing = $state(untrack(() => animate));
	$effect(() => {
		if (!growing) return;
		const t = setTimeout(() => (growing = false), 3200);
		return () => clearTimeout(t);
	});

	/** The group under the pointer, for the exact count the smooth line can't show. */
	let hovered = $state<number | null>(null);
	function pick(e: PointerEvent & { currentTarget: HTMLElement }) {
		const box = e.currentTarget.getBoundingClientRect();
		const at = (e.clientX - box.left) / box.width;
		hovered = Math.max(0, Math.min(chart.groups.length - 1, Math.floor(at * chart.groups.length)));
	}
	const hover = $derived(hovered == null ? null : chart.groups[hovered]);

	type Group = (typeof chart.groups)[number];
	const range = (g: Group, to = '–') =>
		g.open ? `${dollars(g.from)}+` : `${dollars(g.from)}${to}${dollars(g.to)}`;

	const label = $derived.by(() => {
		const g = chart.groups[chart.mine];
		const mine = g
			? ` Your ${dollars(you!)} is in the ${g.open ? `${dollars(g.from)} or more` : range(g, ' to ')} range, with ${g.count - 1} ${g.count === 2 ? 'other' : 'others'}.`
			: '';
		return `Curve of ${chart.total} final balances.${mine}`;
	});
</script>

<figure class={['histogram', growing && 'animate']} aria-label="Where everyone finished">
	<div
		class="plot"
		role="img"
		aria-label={label}
		onpointermove={pick}
		onpointerdown={pick}
		onpointerleave={() => (hovered = null)}
	>
		<div class="frame">
			{#if hover}
				<div
					class="band"
					style:left="{(hover.from / chart.end) * 100}%"
					style:width="{((hover.to - hover.from) / chart.end) * 100}%"
				></div>
			{/if}

			<svg class="curve" viewBox="0 0 {W} {H}" preserveAspectRatio="none" aria-hidden="true">
				<defs>
					<linearGradient id="{id}-fill" gradientUnits="userSpaceOnUse" x1="0" x2={W} y1="0" y2="0">
						{#each fillStops as s, k (k)}
							<stop offset={s.offset} style:stop-color={s.hue} stop-opacity={s.opacity} />
						{/each}
					</linearGradient>
					<linearGradient id="{id}-line" gradientUnits="userSpaceOnUse" x1="0" x2={W} y1="0" y2="0">
						<stop offset="0" style:stop-color="var(--down)" />
						<stop offset={startAt} style:stop-color="var(--down)" />
						<stop offset={startAt} style:stop-color="var(--up)" />
						<stop offset="1" style:stop-color="var(--up)" />
					</linearGradient>
				</defs>
				<path d="M0,{H} L{points} L{W},{H} Z" fill="url(#{id}-fill)" />
				<path
					d="M{points}"
					fill="none"
					stroke="url(#{id}-line)"
					stroke-width="2"
					stroke-linejoin="round"
					vector-effect="non-scaling-stroke"
				/>
			</svg>

			<!-- Where everyone started. -->
			<div class="start" style:left="{startAt * 100}%"></div>

			{#if youAt != null}
				<!-- The viewer's exact finish: a stem up to the curve, a dot on it, the tag above. -->
				<div class="stem" style:left="{youAt * 100}%" style:height="{youHeight * 100}%"></div>
				<div class="dot" style:left="{youAt * 100}%" style:bottom="{youHeight * 100}%"></div>
				<span
					class={['you font-pixel', hover && 'hidden']}
					style:left="clamp(0.75rem, {youAt * 100}%, 100% - 0.75rem)"
					style:bottom="calc({youHeight * 100}% + 10px)"
				>
					YOU
				</span>
			{/if}

			{#if hover}
				<p
					class="tip type-label-md type-numeric"
					style:--at="{((hover.from + hover.to) / 2 / chart.end) * 100}%"
				>
					<span class="text-on-surface">
						{hover.count}
						{hover.count === 1 ? 'player' : 'players'}
					</span>
					<span class="text-on-surface-variant">{range(hover)}</span>
				</p>
			{/if}
		</div>
	</div>

	<figcaption class="axis type-label-lg text-on-surface-variant" aria-hidden="true">
		<span class="absolute left-0">$0</span>
		<span class="absolute -translate-x-1/2" style:left="max({startAt * 100}%, 4rem)">
			Start {dollars(START_BALANCE_CENTS)}
		</span>
		<span class="absolute right-0">
			{chart.capped ? `${dollars(chart.groups.at(-1)!.from)}+` : dollars(chart.end)}
		</span>
	</figcaption>
</figure>

<style>
	.plot {
		height: 8rem;
		padding-top: 1.5rem; /* room for the YOU tag over the peak */
		border-bottom: 2px solid var(--md-sys-color-outline-variant);
		touch-action: pan-y;
	}
	@media (min-width: 1024px) {
		.plot {
			height: 10rem;
		}
	}
	/* The curve's own box: 0% is the baseline, 100% the peak. */
	.frame {
		position: relative;
		height: 100%;
	}
	.curve {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	.band {
		position: absolute;
		top: -1.5rem;
		bottom: 0;
		background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent);
		pointer-events: none;
	}
	.start {
		position: absolute;
		top: -0.25rem;
		bottom: 0;
		border-left: 2px dashed var(--md-sys-color-outline);
		pointer-events: none;
	}
	.stem {
		position: absolute;
		bottom: 0;
		width: 2px;
		translate: -50% 0;
		background: var(--md-sys-color-primary);
	}
	/* Your dot: the ink ring keeps it off the line it sits on. */
	.dot {
		position: absolute;
		width: 10px;
		height: 10px;
		translate: -50% 50%;
		background: var(--md-sys-color-primary);
		box-shadow: 0 0 0 2px var(--pixel-ink);
	}
	.you {
		position: absolute;
		translate: -50% 0;
		font-size: 8px;
		line-height: 1;
		color: var(--md-sys-color-primary);
		white-space: nowrap;
	}
	.tip {
		position: absolute;
		top: -1.5rem;
		/* centred over the group, kept inside the plot */
		left: clamp(3.5rem, var(--at), 100% - 3.5rem);
		z-index: 1;
		display: flex;
		gap: 0.375rem;
		translate: -50% 0;
		padding: 0.125rem 0.375rem;
		white-space: nowrap;
		background: var(--md-sys-color-surface-container-highest);
		box-shadow: 0 0 0 2px var(--pixel-ink);
		pointer-events: none;
	}
	.axis {
		position: relative;
		display: block;
		height: 1.25rem;
		margin-top: 0.375rem;
	}

	/* A fresh finish: the curve draws in left to right, then your dot flashes and the tag drops
	   in. */
	.animate .curve {
		animation: reveal 900ms cubic-bezier(0.4, 0, 0.2, 1) 200ms both;
	}
	.animate .stem {
		transform-origin: bottom;
		animation: grow 300ms cubic-bezier(0.2, 0.8, 0.2, 1) 1100ms both;
	}
	.animate .dot {
		animation:
			pop 200ms steps(2) 1300ms both,
			flash 300ms steps(1) 1500ms 4;
	}
	.animate .you {
		animation: drop-tag 400ms cubic-bezier(0.2, 0.8, 0.2, 1) 1400ms both;
	}
	@keyframes reveal {
		from {
			clip-path: inset(-10% 100% -10% 0);
		}
		to {
			clip-path: inset(-10% 0 -10% 0);
		}
	}
	@keyframes grow {
		from {
			transform: scaleY(0);
		}
	}
	@keyframes pop {
		from {
			opacity: 0;
		}
	}
	@keyframes flash {
		50% {
			background: var(--md-sys-color-on-surface);
		}
	}
	/* The tag keeps its centring while it drops. */
	@keyframes drop-tag {
		from {
			opacity: 0;
			translate: -50% -8px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.animate .curve,
		.animate .stem,
		.animate .dot,
		.animate .you {
			animation: none;
		}
	}
</style>
