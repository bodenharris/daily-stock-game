<script lang="ts">
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import { Button } from '#lib/components/ui/button/index.js';
	import { getBonus, guessBonusRound } from '#lib/remote/game.remote.ts';
	import MiniChart from './MiniChart.svelte';

	let { number, onDone }: { number: number; onDone: () => void } = $props();

	const bonus = $derived(await getBonus(number));
	const total = $derived(bonus.charts.length);

	/** The round on screen. Starts at the first unanswered round, so a reload resumes. */
	// svelte-ignore state_referenced_locally
	let index = $state(Math.min(bonus.answered.length, bonus.charts.length - 1));
	let busy = $state<boolean | null>(null);

	const done = $derived(bonus.answered[index] ?? null);
	const right = $derived(done ? done.guess === done.answer.real : false);
	const score = $derived(bonus.answered.filter((a) => a.guess === a.answer.real).length);

	const fmt = (iso: string) =>
		new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
			month: 'short',
			year: 'numeric',
			timeZone: 'UTC'
		});

	async function guess(real: boolean) {
		if (busy !== null || done) return;
		busy = real;
		try {
			await guessBonusRound({ puzzleNumber: number, index, real });
		} finally {
			busy = null;
		}
	}

	function next() {
		if (index < total - 1) index++;
		else onDone();
	}
</script>

<section class="flex flex-col gap-3 pt-1 pb-6" in:fly={{ y: 16, duration: 400, easing: cubicOut }}>
	<div class="flex items-baseline justify-between gap-3">
		<div>
			<h2 class="type-title-lg-emphasized text-on-surface">Real or random?</h2>
			<p class="type-body-sm text-on-surface-variant">
				A real stock, or a chart a computer made up?
			</p>
		</div>
		<span class="type-label-lg text-on-surface-variant type-numeric">{index + 1} / {total}</span>
	</div>

	{#key index}
		<div
			class="h-36 overflow-hidden rounded-m3-xl bg-surface-container p-3"
			in:fly={{ x: 24, duration: 300, easing: cubicOut }}
		>
			<MiniChart
				values={bonus.charts[index].values}
				tone={done ? (right ? 'up' : 'down') : 'ink'}
			/>
		</div>
	{/key}

	<div class="min-h-[6.5rem]">
		{#if done}
			<div class="flex flex-col gap-3" in:fly={{ y: 8, duration: 250 }}>
				<div class="flex items-center gap-3">
					<span
						class="grid size-8 shrink-0 place-items-center rounded-full {right
							? 'bg-up text-on-up'
							: 'bg-down text-on-down'}"
						aria-hidden="true"
					>
						{#if right}<Check class="size-5" />{:else}<X class="size-5" />{/if}
					</span>
					<p class="type-body-lg text-on-surface" role="status">
						<span class="sr-only">{right ? 'Right.' : 'Wrong.'}</span>
						{#if done.answer.real && done.answer.ticker && done.answer.from && done.answer.to}
							Real: {done.answer.name ?? done.answer.ticker} ({done.answer.ticker}), {fmt(
								done.answer.from
							)} – {fmt(done.answer.to)}
						{:else}
							Random: a computer made this one up.
						{/if}
					</p>
				</div>
				<Button variant="filled" size="md" onclick={next}>
					{#if index < total - 1}Next chart{:else}Done · {score} of {total}{/if}
				</Button>
			</div>
		{:else}
			<div class="grid grid-cols-2 gap-3">
				<Button variant="tonal" size="md" disabled={busy !== null} onclick={() => guess(true)}>
					{busy === true ? 'Checking…' : 'Real'}
				</Button>
				<Button variant="tonal" size="md" disabled={busy !== null} onclick={() => guess(false)}>
					{busy === false ? 'Checking…' : 'Random'}
				</Button>
			</div>
		{/if}
	</div>
</section>
