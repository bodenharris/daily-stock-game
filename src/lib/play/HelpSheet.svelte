<script lang="ts">
	import { prefersReducedMotion } from 'svelte/motion';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { IconButton } from '#lib/components/ui/icon-button/index.js';
	import Wolf from '#lib/brand/Wolf.svelte';
	import RankBadge from '#lib/brand/RankBadge.svelte';
	import { ALPHA, PACK_RANKS } from '#lib/game/rank.ts';
	import { CALLS_PER_GAME, START_BALANCE_CENTS, STAKE_OPTIONS } from '#lib/game/config.ts';
	import { dollars } from './money.ts';

	/**
	 * How to play, as three quick slides (goal, calls, reveal), each a picture and one line, so a
	 * first-time player has the game in under 20 seconds. Swipe, arrow keys, the dots or the
	 * buttons move between slides; the last slide's button starts the game.
	 */
	// `view` is accepted (and ignored) so both lazily loaded sheets share one prop shape.
	// eslint-disable-next-line svelte/no-unused-props
	let { open = $bindable(false) }: { open?: boolean; view?: unknown } = $props();

	const slides = [
		{ id: 'goal', title: 'The Goal', line: 'Will the mystery stock rise or fall?' },
		{
			id: 'play',
			title: 'How to Play',
			line: `Make ${CALLS_PER_GAME} calls. Pick how much to risk on each.`
		},
		{ id: 'reveal', title: 'The Reveal', line: 'Unmask the stock. See how you ranked in the pack.' }
	] as const;

	const ranks = [...PACK_RANKS, ALPHA];
	const stakes = STAKE_OPTIONS.map((o) => ({
		percent: o.percent,
		cents: Math.floor((START_BALANCE_CENTS * o.percent) / 100)
	}));

	let index = $state(0);
	let track = $state<HTMLElement | null>(null);
	let primary = $state<HTMLElement | null>(null);
	const last = $derived(index === slides.length - 1);

	function go(i: number) {
		const next = Math.max(0, Math.min(slides.length - 1, i));
		index = next;
		track?.scrollTo({
			left: next * track.clientWidth,
			behavior: prefersReducedMotion.current ? 'instant' : 'smooth'
		});
	}

	/** A swipe (native scroll snapping) lands on a slide: follow it. */
	function onscroll() {
		if (!track) return;
		const i = Math.round(track.scrollLeft / track.clientWidth);
		if (i !== index && i >= 0 && i < slides.length) index = i;
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.altKey || e.ctrlKey || e.metaKey) return;
		const to =
			e.key === 'ArrowRight'
				? index + 1
				: e.key === 'ArrowLeft'
					? index - 1
					: e.key === 'Home'
						? 0
						: e.key === 'End'
							? slides.length - 1
							: null;
		if (to == null) return;
		e.preventDefault();
		go(to);
	}
</script>

<Dialog.Root bind:open onOpenChangeComplete={(o) => !o && (index = 0)}>
	<Dialog.Content
		class="max-h-[calc(100%-40px)] w-[min(400px,calc(100%-44px))] max-w-none min-w-0 gap-0 overflow-visible rounded-none bg-transparent p-0 shadow-none"
		onOpenAutoFocus={(e) => {
			e.preventDefault();
			primary?.focus();
		}}
		{onkeydown}
	>
		<div class="frame pixel-frame flex min-h-0 flex-col">
			<header class="flex items-center justify-between gap-2 ps-4 pe-1 pt-1">
				<Dialog.Title class="neon-text type-label-md">How to play</Dialog.Title>
				<Dialog.Description class="sr-only">
					Three short slides. Use the arrow keys or swipe to move between them.
				</Dialog.Description>
				<Dialog.Close>
					{#snippet child({ props })}
						<IconButton {...props} shape="square" size="sm" aria-label="Close">
							<X />
						</IconButton>
					{/snippet}
				</Dialog.Close>
			</header>

			<div
				class="track"
				bind:this={track}
				{onscroll}
				role="region"
				aria-roledescription="carousel"
				aria-label="How to play"
			>
				{#each slides as s, i (s.id)}
					<section
						class={['slide', i === index && 'active']}
						role="group"
						aria-roledescription="slide"
						aria-label="{i + 1} of {slides.length}: {s.title}"
						inert={i !== index}
					>
						<div class="stage" aria-hidden="true">
							<span class="moon"></span>
							{#if s.id === 'goal'}
								{@render goal()}
							{:else if s.id === 'play'}
								{@render play()}
							{:else}
								{@render reveal()}
							{/if}
						</div>
						<div class="px-5 pt-4 text-center">
							<h3 class="glitch-text font-pixel text-base leading-tight uppercase">
								{s.title}
							</h3>
							<p class="mt-2 type-body-lg text-balance text-on-surface">{s.line}</p>
							{#if s.id === 'play'}
								<p class="keys mt-1.5 type-body-sm text-on-surface-variant">
									<kbd>↑</kbd> <kbd>↓</kbd> to call · <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> to bet
								</p>
							{/if}
						</div>
					</section>
				{/each}
			</div>
			<p class="sr-only" aria-live="polite">
				Slide {index + 1} of {slides.length}: {slides[index].title}
			</p>

			<footer class="flex items-center gap-2 px-3 pt-3 pb-4">
				<IconButton
					shape="square"
					size="sm"
					aria-label="Previous slide"
					disabled={index === 0}
					onclick={() => go(index - 1)}
				>
					<ChevronLeft />
				</IconButton>
				<div class="dots flex flex-1 justify-center">
					{#each slides as s, i (s.id)}
						<button
							type="button"
							class={['dot', i === index && 'on']}
							aria-label="Slide {i + 1}: {s.title}"
							aria-current={i === index ? 'step' : undefined}
							onclick={() => go(i)}
						></button>
					{/each}
				</div>
				<!-- One button that becomes "Let's play", so focus stays put on the last slide. -->
				<Button
					bind:ref={primary}
					variant={last ? 'filled' : 'tonal'}
					size="sm"
					class={['next min-w-34', last ? 'pixel-frame' : 'pixel-panel']}
					onclick={() => (last ? (open = false) : go(index + 1))}
				>
					{#if last}Let's play{:else}Next<ChevronRight data-icon="inline-end" />{/if}
				</Button>
			</footer>
		</div>
	</Dialog.Content>
</Dialog.Root>

<!-- Slide 1: a mystery chart, the wolf beside it, and the two calls. -->
{#snippet goal()}
	<div class="flex items-end gap-3">
		<Wolf scale={2} title="" />
		<div class="flex flex-col items-center gap-2">
			<div class="ticker font-pixel">????</div>
			<svg class="chart" viewBox="0 0 64 32" width="128" height="64" shape-rendering="crispEdges">
				<path
					d="M0 24 H8 V20 H16 V22 H24 V14 H32 V16 H40 V10"
					fill="none"
					stroke="var(--md-sys-color-primary)"
					stroke-width="2"
				/>
				<rect
					x="42"
					y="2"
					width="20"
					height="28"
					fill="color-mix(in srgb, var(--md-sys-color-primary) 10%, transparent)"
					stroke="var(--md-sys-color-outline)"
					stroke-dasharray="2 2"
				/>
				<text
					x="52"
					y="21"
					text-anchor="middle"
					class="font-pixel"
					font-size="12"
					fill="var(--md-sys-color-tertiary)">?</text
				>
			</svg>
		</div>
		<div class="flex flex-col gap-2">
			<span class="call up"><ArrowUp strokeWidth={3} /></span>
			<span class="call down"><ArrowDown strokeWidth={3} /></span>
		</div>
	</div>
{/snippet}

<!-- Slide 2: the five-call scoreboard, the stake chips, and the Up / Down buttons. -->
{#snippet play()}
	<div class="flex w-full max-w-64 flex-col gap-3">
		<div class="flex justify-center gap-1.5">
			{#each { length: CALLS_PER_GAME }, i (i)}
				<span
					class={[
						'pip',
						i === 0 || i === 1 ? 'bg-up text-on-up' : i === 2 ? 'bg-down text-on-down' : '',
						i === 3 && 'next-pip',
						i === 4 && 'empty'
					]}
				>
					{#if i < 2}<Check strokeWidth={3} />{:else if i === 2}<X strokeWidth={3} />{/if}
				</span>
			{/each}
		</div>
		<div class="flex gap-0.5">
			{#each stakes as o (o.percent)}
				<span class={['chip', o.percent === 25 && 'on']}>
					<span class="type-label-lg type-numeric">{dollars(o.cents, { cents: false })}</span>
					<span class="type-label-sm type-numeric opacity-80">{o.percent}%</span>
				</span>
			{/each}
		</div>
		<div class="grid grid-cols-2 gap-2">
			<span class="mini-call bg-up type-label-lg tracking-[0.12em] text-on-up uppercase"
				><ArrowUp strokeWidth={3} />Up</span
			>
			<span class="mini-call bg-down type-label-lg tracking-[0.12em] text-on-down uppercase"
				><ArrowDown strokeWidth={3} />Down</span
			>
		</div>
	</div>
{/snippet}

<!-- Slide 3: the final balance, and the Wolf Pack Ranks from Pup to Alpha. -->
{#snippet reveal()}
	<div class="flex flex-col items-center gap-3">
		<div class="flex items-center gap-2">
			<span class="type-title-md text-on-surface-variant type-numeric line-through decoration-2">
				{dollars(START_BALANCE_CENTS, { cents: false })}
			</span>
			<span class="type-headline-sm-emphasized text-on-surface type-numeric">$142</span>
			<span class="bg-up-container px-2 py-0.5 type-label-lg text-on-up-container type-numeric"
				>+42%</span
			>
		</div>
		<ol class="ranks flex items-end gap-1.5">
			{#each ranks as r (r.key)}
				<li class={['rank', r.key === 'hunter' && 'you']}>
					<RankBadge rank={r.key} scale={2} />
				</li>
			{/each}
		</ol>
		<p class="neon-text type-label-sm">Wolf Pack Ranks</p>
	</div>
{/snippet}

<style>
	.frame {
		--frame: var(--md-sys-color-primary);
		overflow: hidden;
		background: var(--md-sys-color-surface-container-high);
		color: var(--md-sys-color-on-surface);
		/* the 6px frame and its 12px drop sit outside the box */
		margin: 6px 6px 12px;
	}

	/* Native scroll snapping gives touch swipe (and trackpad swipe) for free. */
	.track {
		display: flex;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
	}
	.track::-webkit-scrollbar {
		display: none;
	}
	.slide {
		flex: 0 0 100%;
		min-width: 0;
		scroll-snap-align: start;
		scroll-snap-stop: always;
	}

	/* The stage: a slice of the night sky, stars and a pixel moon, behind each little preview. */
	.stage {
		position: relative;
		display: grid;
		place-items: center;
		height: 168px;
		margin: 8px 16px 0;
		overflow: hidden;
		background:
			radial-gradient(
				120% 90% at 85% 0%,
				color-mix(in srgb, var(--md-sys-color-primary) 16%, transparent),
				transparent 60%
			),
			var(--md-sys-color-surface-container-lowest);
		box-shadow:
			inset 0 0 0 2px var(--pixel-ink),
			inset 0 -3px 0 0 color-mix(in srgb, var(--md-sys-color-primary) 70%, transparent);
	}
	.stage::before {
		content: '';
		position: absolute;
		top: 18px;
		left: 22px;
		width: 2px;
		height: 2px;
		background: var(--md-sys-color-on-surface);
		box-shadow:
			60px 12px 0 0 var(--md-sys-color-on-surface-variant),
			140px -6px 0 0 var(--md-sys-color-on-surface),
			190px 40px 0 0 var(--md-sys-color-on-surface-variant),
			30px 70px 0 0 var(--md-sys-color-on-surface-variant),
			250px 90px 0 0 var(--md-sys-color-on-surface);
		opacity: 0.7;
	}
	.moon {
		position: absolute;
		top: 12px;
		right: 14px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		/* a crescent: the lit edge of a dark disc */
		box-shadow:
			5px 3px 0 0 var(--md-sys-color-tertiary),
			6px 4px 16px 0 color-mix(in srgb, var(--md-sys-color-tertiary) 40%, transparent);
	}

	.ticker {
		padding: 2px 8px;
		font-size: 12px;
		letter-spacing: 0.15em;
		background: var(--md-sys-color-surface-container-highest);
		color: var(--md-sys-color-tertiary);
		box-shadow: 0 0 0 2px var(--pixel-ink);
	}
	.chart {
		display: block;
	}
	.call {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		box-shadow: 0 0 0 2px var(--pixel-ink);
	}
	.call :global(svg) {
		width: 22px;
		height: 22px;
	}
	.call.up {
		background: var(--md-ext-color-up);
		color: var(--md-ext-color-on-up);
	}
	.call.down {
		background: var(--md-ext-color-down);
		color: var(--md-ext-color-on-down);
	}

	.pip {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
	}
	.pip :global(svg) {
		width: 16px;
		height: 16px;
	}
	.pip.next-pip {
		background: var(--md-sys-color-surface-container-highest);
		box-shadow: inset 0 0 0 2px var(--md-sys-color-primary);
	}
	.pip.empty {
		box-shadow: inset 0 0 0 2px var(--md-sys-color-outline);
	}
	.chip {
		flex: 1 1 0;
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 4px;
		padding: 6px 0;
		background: var(--md-sys-color-surface-container-highest);
		color: var(--md-sys-color-on-surface);
	}
	.chip.on {
		background: var(--md-sys-color-primary);
		color: var(--md-sys-color-on-primary);
	}
	.mini-call {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		height: 36px;
		box-shadow: 0 0 0 2px var(--pixel-ink);
	}
	.mini-call :global(svg) {
		width: 18px;
		height: 18px;
	}

	.rank {
		display: grid;
		place-items: center;
		padding: 3px;
		opacity: 0.55;
	}
	.rank.you {
		opacity: 1;
		background: var(--md-sys-color-surface-container-highest);
		box-shadow:
			0 0 0 2px var(--md-sys-color-tertiary),
			0 0 14px 0 color-mix(in srgb, var(--md-sys-color-tertiary) 40%, transparent);
	}

	.dot {
		position: relative;
		display: grid;
		place-items: center;
		width: 28px;
		height: 44px;
		cursor: pointer;
	}
	.dot::before {
		content: '';
		width: 10px;
		height: 10px;
		background: var(--md-sys-color-outline);
		transition: width 150ms steps(3, end);
	}
	.dot.on::before {
		width: 22px;
		background: var(--md-sys-color-primary);
		box-shadow: 0 0 10px 0 color-mix(in srgb, var(--md-sys-color-primary) 55%, transparent);
	}
	.dot:focus-visible {
		outline: 3px solid var(--md-sys-color-on-surface);
		outline-offset: -6px;
	}

	/* The active slide's preview pops in, two steps, like a sprite. */
	.slide.active .stage > :global(:not(.moon)) {
		animation: pop-in 240ms steps(3, end) both;
	}
	@keyframes pop-in {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}
	.slide.active .call.up {
		animation: blink 1.2s steps(1, end) infinite;
	}
	.slide.active .call.down {
		animation: blink 1.2s steps(1, end) 0.6s infinite;
	}
	@keyframes blink {
		50% {
			filter: brightness(1.35);
			transform: translateY(-2px);
		}
	}

	.keys {
		display: none;
	}
	@media (pointer: fine) and (min-width: 768px) {
		.keys {
			display: block;
		}
	}
	kbd {
		display: inline-grid;
		place-items: center;
		min-width: 1.25rem;
		padding: 0 0.25rem;
		background: var(--md-sys-color-surface-container-highest);
		color: var(--md-sys-color-on-surface);
		font: inherit;
		line-height: 1.25rem;
	}

	/* Short phones: a shorter stage, so the buttons stay on screen. */
	@media (max-height: 560px) {
		.stage {
			height: 132px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.slide.active .stage > :global(*),
		.slide.active .call {
			animation: none;
		}
		.dot::before {
			transition: none;
		}
	}
</style>
