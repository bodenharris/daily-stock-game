<script lang="ts">
	import { rise } from '#lib/m3/transitions.ts';
	import { MediaQuery } from 'svelte/reactivity';
	import { page } from '$app/state';
	import Share2 from '@lucide/svelte/icons/share-2';
	import Check from '@lucide/svelte/icons/check';
	import { Button } from '#lib/components/ui/button/index.js';
	import { classifyArchetype } from '#lib/game/archetype.ts';
	import { buildShareText } from '#lib/game/share.ts';
	import { toRecords } from './records.ts';
	import Countdown from './Countdown.svelte';
	import BonusRound from './BonusRound.svelte';
	import Dices from '@lucide/svelte/icons/dices';
	import type { GameView } from './types.ts';

	let { view, fresh = false }: { view: GameView; fresh?: boolean } = $props();
	const reveal = $derived(view.reveal!);
	const records = $derived(toRecords(view.results));
	const archetype = $derived(classifyArchetype(records));
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
			window.prompt('Copy your result', text);
		}
	}

	const d = (ms: number) => (fresh ? ms : 0);
</script>

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
	<section class="flex flex-col gap-4 pt-1 pb-6">
		<div in:rise={{ delay: d(250) }}>
			<h2 class="type-headline-sm-emphasized text-balance text-on-surface">
				{reveal.headline}
			</h2>
			<p class="mt-0.5 type-label-lg text-chart-reveal">
				<span class="type-numeric">{reveal.ticker}</span> · {range}
			</p>
			<p class="mt-2 type-body-md text-pretty text-on-surface-variant">{reveal.story}</p>
		</div>

		<div class="rounded-m3-lg bg-surface-container px-4 py-3" in:rise={{ delay: d(450) }}>
			<p class="type-title-lg-emphasized text-on-surface">{archetype.label}</p>
			<p class="type-body-sm text-on-surface-variant">{archetype.line}</p>
		</div>

		<div class="flex flex-col gap-2" in:rise={{ delay: d(650) }}>
			<div class="grid grid-cols-[1fr_auto] gap-2">
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
			<p class="text-center type-body-sm text-on-surface-variant">
				{#if view.bonus}
					<span>Real or random {view.bonus.correct}/{view.bonus.total}</span>
					<span aria-hidden="true">&nbsp;·&nbsp;</span>
				{/if}
				<Countdown to={view.nextPuzzleAt} />
			</p>
		</div>
	</section>
{/if}
