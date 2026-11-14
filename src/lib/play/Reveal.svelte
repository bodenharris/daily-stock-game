<script lang="ts">
	import { pop, rise } from '#lib/m3/transitions.ts';
	import { MediaQuery } from 'svelte/reactivity';
	import { page } from '$app/state';
	import Share2 from '@lucide/svelte/icons/share-2';
	import Check from '@lucide/svelte/icons/check';
	import { Button } from '#lib/components/ui/button/index.js';
	import { classifyArchetype } from '#lib/game/archetype.ts';
	import { buildShareText } from '#lib/game/share.ts';
	import { toRecords } from './records.ts';
	import { standingText } from './standing.ts';
	import Countdown from './Countdown.svelte';
	import BonusRound from './BonusRound.svelte';
	import Dices from '@lucide/svelte/icons/dices';
	import type { GameView } from './types.ts';

	let { view, fresh = false }: { view: GameView; fresh?: boolean } = $props();
	const reveal = $derived(view.reveal!);
	const records = $derived(toRecords(view.results));
	const archetype = $derived(classifyArchetype(records));
	const standing = $derived(standingText(view.standing));
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
		const first = reveal.dates[view.contextBars - 1];
		const last = reveal.dates.at(-1)!;
		const sameYear = first.slice(0, 4) === last.slice(0, 4);
		return `${fmt(first, !sameYear)} – ${fmt(last, true)}`;
	});

	const shareText = $derived(
		buildShareText({
			puzzleNumber: view.number,
			calls: records,
			archetype,
			theme: light.current ? 'light' : 'dark',
			bonus: view.bonus ? { label: 'Real or Random', ...view.bonus } : undefined,
			standing,
			named,
			url: page.url.origin
		})
	);

	let copied = $state(false);
	let playingBonus = $state(false);

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

<section class="flex flex-col gap-4 pt-1 pb-6">
	<div in:rise={{ delay: d(250) }}>
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
			<p class="mt-1 type-label-lg text-up">🎯 You named it</p>
		{:else if wrongGuess}
			<p class="mt-1 type-label-lg text-on-surface-variant">You guessed {wrongGuess}</p>
		{/if}
		{#if !playingBonus}
			<p class="mt-2 type-body-md text-pretty text-on-surface-variant">{reveal.story}</p>
		{/if}
		{#if reveal.hindsight && !playingBonus}
			{@const h = reveal.hindsight}
			<p class="hindsight mt-1 type-body-md text-on-surface-variant">
				In hindsight: a year later it was
				<span class="text-on-surface type-numeric">{price(h.close)}</span>
				<span class={['type-numeric', h.change >= 0 ? 'text-up' : 'text-down']}
					>({h.change >= 0 ? '+' : '−'}{Math.abs(Math.round(h.change))}% from here)</span
				>.
			</p>
		{/if}
	</div>

	{#if playingBonus}
		<svelte:boundary>
			<BonusRound number={view.number} onDone={() => (playingBonus = false)} />
			{#snippet failed(error, reset)}
				<div class="flex flex-col items-start gap-2 py-6">
					<p class="type-body-lg text-on-surface">The bonus round didn't load.</p>
					<p class="sr-only">{String((error as { message?: string })?.message ?? '')}</p>
					<div class="flex gap-2">
						<Button variant="tonal" size="sm" onclick={reset}>Try again</Button>
						<Button variant="text" size="sm" onclick={() => (playingBonus = false)}>Back</Button>
					</div>
				</div>
			{/snippet}
		</svelte:boundary>
	{:else}
		<div
			class={[
				'rounded-m3-xl px-5 py-4',
				view.balanceCents >= 10000
					? 'bg-primary-container text-on-primary-container'
					: 'bg-surface-container-high text-on-surface'
			]}
			in:pop={{ delay: d(450), start: 0.92 }}
		>
			<div class="flex items-baseline justify-between gap-3">
				<p class="type-title-lg-emphasized">{archetype.label}</p>
				{#if standing}
					<p class="shrink-0 type-label-lg type-numeric opacity-80">{standing}</p>
				{/if}
			</div>
			<p class="type-body-sm opacity-80">{archetype.line}</p>
		</div>

		<div class="flex flex-col gap-2" in:rise={{ delay: d(650) }}>
			<div class={['grid gap-2', view.bonus ? 'grid-cols-1' : 'grid-cols-[1fr_auto]']}>
				<Button variant="filled" size="md" onclick={share} aria-live="polite">
					{#if copied}
						<Check /> Copied
					{:else}
						<Share2 /> Share
					{/if}
				</Button>
				{#if !view.bonus}
					<Button variant="tonal" size="md" onclick={() => (playingBonus = true)}>
						<Dices /> Bonus
					</Button>
				{/if}
			</div>
			{#if manualCopy}
				<div class="rounded-m3-lg bg-surface-container px-4 py-3">
					<p class="type-label-md text-on-surface-variant">Copy this and paste it to a friend:</p>
					<pre
						class="mt-1 type-body-md whitespace-pre-wrap text-on-surface select-all"
						{@attach selectAll}>{manualCopy}</pre>
				</div>
			{/if}
			<p class="text-center type-body-sm text-on-surface-variant">
				{#if view.bonus}
					<span>Real or Random {view.bonus.correct}/{view.bonus.total}</span>
					<span aria-hidden="true">&nbsp;·&nbsp;</span>
				{/if}
				<Countdown to={view.nextPuzzleAt} />
			</p>
		</div>
	{/if}
</section>

<style>
	@media (max-height: 640px) {
		.hindsight {
			display: none;
		}
	}
</style>
