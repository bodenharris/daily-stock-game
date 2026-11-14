<script lang="ts">
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import { Button } from '#lib/components/ui/button/index.js';
	import { finishBonus, getBonus, revealBonusRound } from '#lib/remote/game.remote.ts';
	import MiniChart from './MiniChart.svelte';

	let { onDone }: { onDone: () => void } = $props();

	const bonus = $derived(await getBonus());
	let index = $state(0);
	let guesses = $state<boolean[]>([]);
	let answer = $state<{
		real: boolean;
		ticker: string | null;
		from: string | null;
		to: string | null;
	} | null>(null);
	let busy = $state(false);
	let score = $state<{ correct: number; total: number } | null>(null);

	const total = $derived(bonus.charts.length);
	const right = $derived(answer && guesses[index] === answer.real);

	const fmt = (iso: string) =>
		new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
			month: 'short',
			year: 'numeric',
			timeZone: 'UTC'
		});

	async function guess(real: boolean) {
		if (busy || answer) return;
		busy = true;
		guesses[index] = real;
		try {
			answer = await revealBonusRound({ puzzleNumber: bonus.number, index });
			if (index === total - 1) {
				score = await finishBonus({ puzzleNumber: bonus.number, guesses });
			}
		} finally {
			busy = false;
		}
	}

	function next() {
		if (index < total - 1) {
			index++;
			answer = null;
		} else {
			onDone();
		}
	}
</script>

<section class="flex flex-col gap-4 pt-1 pb-6" in:fly={{ y: 16, duration: 400, easing: cubicOut }}>
	<div class="flex items-baseline justify-between">
		<h2 class="type-title-lg-emphasized text-on-surface">Real or random?</h2>
		<span class="type-label-lg text-on-surface-variant type-numeric">{index + 1} / {total}</span>
	</div>

	{#key index}
		<div
			class="h-40 overflow-hidden rounded-m3-xl bg-surface-container p-3"
			in:fly={{ x: 24, duration: 300, easing: cubicOut }}
		>
			<MiniChart
				values={bonus.charts[index].values}
				tone={answer ? (right ? 'up' : 'down') : 'ink'}
			/>
		</div>
	{/key}

	{#if answer}
		<div class="flex items-center gap-3" in:fly={{ y: 8, duration: 250 }}>
			<span
				class="grid size-8 place-items-center rounded-full {right
					? 'bg-up text-on-up'
					: 'bg-down text-on-down'}"
			>
				{#if right}<Check class="size-5" />{:else}<X class="size-5" />{/if}
			</span>
			<p class="type-body-lg text-on-surface">
				{#if answer.real && answer.ticker && answer.from && answer.to}
					Real: {answer.ticker}, {fmt(answer.from)} – {fmt(answer.to)}
				{:else}
					Random: a computer made this one up.
				{/if}
			</p>
		</div>
		<Button variant="filled" size="md" onclick={next}>
			{#if index < total - 1}Next chart{:else}You got {score?.correct ?? 0} of {total}{/if}
		</Button>
	{:else}
		<div class="grid grid-cols-2 gap-3">
			<Button variant="tonal" size="md" disabled={busy} onclick={() => guess(true)}>Real</Button>
			<Button variant="tonal" size="md" disabled={busy} onclick={() => guess(false)}>Random</Button>
		</div>
	{/if}
</section>
