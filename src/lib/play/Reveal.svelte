<script lang="ts">
	import { pop, rise } from '#lib/m3/transitions.ts';
	import { MediaQuery } from 'svelte/reactivity';
	import { page } from '$app/state';
	import Share2 from '@lucide/svelte/icons/share-2';
	import Check from '@lucide/svelte/icons/check';
	import { Button } from '#lib/components/ui/button/index.js';
	import { packRank } from '#lib/game/rank.ts';
	import { buildShareText } from '#lib/game/share.ts';
	import { dollars } from './money.ts';
	import { toRecords } from './records.ts';
	import { standingText } from './standing.ts';
	import Countdown from './Countdown.svelte';
	import FinishHistogram from '#lib/stats/FinishHistogram.svelte';
	import Wolf from '#lib/brand/Wolf.svelte';
	import RankBadge from '#lib/brand/RankBadge.svelte';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import ChartColumn from '@lucide/svelte/icons/chart-column';
	import type { GameView } from './types.ts';

	let {
		view,
		fresh = false,
		archive = false
	}: { view: GameView; fresh?: boolean; archive?: boolean } = $props();
	const reveal = $derived(view.reveal!);
	const records = $derived(toRecords(view.results));
	const rank = $derived(packRank(view.standing));
	const standing = $derived(standingText(view.standing, archive ? 'players' : 'today'));
	const n = $derived(view.nameIt);
	const named = $derived(!!n && n.guess != null && n.guess === n.answer);
	const wrongGuess = $derived(
		n && n.guess != null && n.guess !== n.answer ? n.options[n.guess] : null
	);
	const light = new MediaQuery('(prefers-color-scheme: light)');

	const range = $derived.by(() => {
		const fmt = (iso: string, withYear: boolean) =>
			new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				...(withYear ? { year: 'numeric' } : {}),
				timeZone: 'UTC'
			});
		// The whole chart, so it agrees with the axis under it.
		const first = reveal.dates[0];
		const last = reveal.dates.at(-1)!;
		const sameYear = first.slice(0, 4) === last.slice(0, 4);
		return `${fmt(first, !sameYear)} – ${fmt(last, true)}`;
	});

	const shareText = $derived(
		buildShareText({
			puzzleNumber: view.number,
			calls: records,
			rank,
			theme: light.current ? 'light' : 'dark',
			standing,
			named,
			url: page.url.origin
		})
	);

	let copied = $state(false);

	async function share() {
		const text = shareText;
		try {
			if (navigator.share && matchMedia('(pointer: coarse)').matches) {
				await navigator.share({ text });
				return;
			}
		} catch (e) {
			if ((e as DOMException)?.name === 'AbortError') return;
		}
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Clipboard blocked (some in-app browsers): show the text so it can be copied by hand.
			manualCopy = text;
		}
	}

	let manualCopy = $state<string | null>(null);
	function selectAll(node: HTMLElement) {
		const range = document.createRange();
		range.selectNodeContents(node);
		const selection = window.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
	}

	const d = (ms: number) => (fresh ? ms : 0);
	const price = (n: number) =>
		n >= 100 ? `$${Math.round(n)}` : n >= 10 ? `$${n.toFixed(1)}` : `$${n.toFixed(2)}`;
</script>

<!-- A fresh unmasking builds top-down in three beats: the name, the verdict, then the rest. -->
<section class="flex flex-col gap-6 pt-6 pb-6">
	<div in:rise={{ delay: d(100) }}>
		<h2
			class="type-headline-sm-emphasized text-balance text-on-surface outline-none"
			tabindex="-1"
			{@attach (node) => {
				// Bring keyboard and screen-reader users to the unmasking when it lands.
				if (fresh) node.focus({ preventScroll: true });
			}}
		>
			{reveal.headline}
		</h2>
		<p class="mt-0.5 type-label-lg text-chart-reveal">
			<span class="type-numeric">{reveal.ticker}</span> · {range}
		</p>
		{#if named}
			<p class="mt-1 flex items-center gap-1.5 type-label-lg text-up">
				<Check class="size-4" strokeWidth={3} aria-hidden="true" /> You named it
			</p>
		{:else if wrongGuess}
			<p class="mt-1 type-label-lg text-on-surface-variant">You guessed {wrongGuess}</p>
		{/if}
	</div>

	<div
		class={[
			'pixel-panel mx-1.5 flex items-center gap-4 px-5 py-3',
			view.balanceCents >= 10000
				? 'bg-primary-container text-on-primary-container'
				: 'bg-surface-container-high text-on-surface'
		]}
		in:pop={{ delay: d(250), start: 0.92 }}
	>
		<div class="wolf shrink-0" aria-hidden="true"><Wolf scale={2} /></div>
		<div class="min-w-0 flex-1">
			<!-- The Wolf Pack Rank. Without a standing there is no rank, so the balance leads. -->
			<div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
				<p class="rank flex items-center gap-2 font-pixel">
					{#if rank}
						<RankBadge rank={rank.key} />
						{rank.label}
					{:else}
						{dollars(view.balanceCents)}
					{/if}
				</p>
				<!-- The same place the share text gives, so the two never disagree. -->
				{#if rank && standing}
					<p class="shrink-0 type-label-lg type-numeric opacity-80">{standing}</p>
				{/if}
			</div>
			{#if rank}
				<p class="mt-2 type-body-md opacity-80">{rank.line}</p>
			{/if}
		</div>
	</div>

	<!-- One beat for everything below the verdict. Transitions inside {#if} blocks are local and
	     would not play on their own, so they ride on this one. -->
	<div class="flex flex-col gap-6" in:rise={{ delay: d(400) }}>
		<div class="flex flex-col gap-3">
			<div class="actions grid grid-cols-2 gap-4 px-1.5 pt-1.5 pb-3">
				<Button
					variant="filled"
					size="md"
					class="pixel-frame [--btn-px:12px]"
					onclick={share}
					aria-live="polite"
				>
					{#if copied}
						<Check /> Copied
					{:else}
						<Share2 /> Share
					{/if}
				</Button>
				<Button variant="tonal" size="md" class="pixel-panel [--btn-px:12px]" href="/archive">
					<CalendarDays /> Past charts
				</Button>
			</div>
			{#if manualCopy}
				<div class="bg-surface-container px-4 py-3">
					<p class="type-label-md text-on-surface-variant">Copy this and paste it to a friend:</p>
					<pre
						class="mt-1 type-body-md whitespace-pre-wrap text-on-surface select-all"
						{@attach selectAll}>{manualCopy}</pre>
				</div>
			{/if}
			<p class="text-center type-body-sm text-on-surface-variant">
				{#if archive}
					<a
						href="/"
						class="inline-flex min-h-11 items-center type-label-lg text-m3-primary underline underline-offset-4"
						>Today's chart</a
					>
				{:else}
					<Countdown to={view.nextPuzzleAt} />
				{/if}
			</p>
		</div>

		<div>
			<p class="type-body-md text-pretty text-on-surface-variant">{reveal.story}</p>
			{#if reveal.hindsight}
				{@const h = reveal.hindsight}
				<p class="hindsight mt-1 type-body-md text-on-surface-variant">
					In hindsight: a year later it was
					<span class="text-on-surface type-numeric">{price(h.close)}</span>
					<span class={['type-numeric', h.change >= 0 ? 'text-up' : 'text-down']}
						>({h.change >= 0 ? '+' : '−'}{Math.abs(Math.round(h.change))}% from where the chart
						ends)</span
					>.
				</p>
			{/if}
		</div>

		{#if view.finishes}
			{@const finished = view.finishes.finished}
			<!-- Where the day's players finished. Nobody is named: just how many landed where. -->
			<section aria-labelledby="finishes-title" class="flex flex-col gap-3">
				<div class="flex items-baseline justify-between gap-3">
					<h3 id="finishes-title" class="type-title-md text-on-surface">Where everyone finished</h3>
					<p class="type-label-md text-on-surface-variant type-numeric">
						{finished}
						{finished === 1 ? 'player' : 'players'}
					</p>
				</div>
				<FinishHistogram finishes={view.finishes.buckets} you={view.balanceCents} animate={fresh} />
				{#if finished === 1}
					<p class="type-body-sm text-on-surface-variant">
						{archive ? 'Nobody else has played this one yet.' : "You're the first to finish today."}
					</p>
				{/if}
			</section>
		{/if}

		<!-- The stats page is today's only, so past days played from the archive don't link to it. -->
		{#if !archive}
			<div class="-mt-2 flex justify-center">
				<Button variant="text" size="md" href="/stats">
					<ChartColumn /> How everyone called it
				</Button>
			</div>
		{/if}
	</div>
</section>

<style>
	/* The rank in the arcade face, on its 8px grid. */
	.rank {
		font-size: 1rem;
		line-height: 1.5rem;
		letter-spacing: 0;
	}
	/* The mascot shows up for the verdict; on the narrowest phones the title needs the room. */
	/* …and the two buttons need their labels more than their icons. */
	@media (max-width: 359px) {
		.wolf,
		.actions :global(svg) {
			display: none;
		}
	}
</style>
