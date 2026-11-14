<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { getArchive } from '#lib/remote/game.remote.ts';
	import { GAME_NAME, START_BALANCE_CENTS } from '#lib/game/config.ts';
	import { dollars } from '#lib/play/money.ts';
	import { Button } from '#lib/components/ui/button/index.js';
	import { ripple } from '#lib/m3/ripple.svelte.ts';

	const archive = $derived(await getArchive());

	const fmt = (iso: string) =>
		new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			timeZone: 'UTC'
		});
	const played = $derived(archive.days.filter((d) => d.played?.finished).length);
</script>

<svelte:head>
	<title>Past charts · {GAME_NAME}</title>
</svelte:head>

<main
	class="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[env(safe-area-inset-top)] pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:max-w-2xl md:px-6"
>
	<header class="flex h-14 items-center gap-2">
		<a
			href="/"
			class="-ml-2 grid size-12 place-items-center rounded-none text-on-surface-variant hover:bg-on-surface/8"
			aria-label="Back to today's chart"
		>
			<ArrowLeft class="size-6" />
		</a>
		<h1 class="type-title-lg-emphasized text-on-surface">Past charts</h1>
		{#if archive.days.length}
			<span class="ml-auto type-label-lg text-on-surface-variant type-numeric">
				{played} of {archive.days.length} played
			</span>
		{/if}
	</header>

	<p class="pt-1 type-body-lg text-on-surface-variant">
		Every chart so far. Past days don't count toward your streak.
	</p>

	<ol class="mt-5 flex flex-col gap-2">
		<li>
			<a href="/" class="row today" {@attach ripple()}>
				<span class="flex flex-col">
					<span class="type-title-md text-on-surface type-numeric">#{archive.today}</span>
					<span class="type-body-sm text-on-surface-variant">Today</span>
				</span>
				<span class="ml-auto flex items-center gap-1 type-label-lg text-m3-primary">
					Today's chart <ChevronRight class="size-5" />
				</span>
			</a>
		</li>
		{#each archive.days as day (day.number)}
			{@const p = day.played}
			<li>
				<a href="/day/{day.number}" class="row" {@attach ripple()}>
					<span class="flex flex-col">
						<span class="type-title-md text-on-surface type-numeric">#{day.number}</span>
						<span class="type-body-sm text-on-surface-variant">{fmt(day.date)}</span>
					</span>
					<span class="ml-auto flex items-center gap-3">
						{#if p?.finished}
							<span class="type-body-sm text-on-surface-variant type-numeric"
								>{p.right}/5 right</span
							>
							<span
								class={[
									'rounded-none px-3 py-1 type-label-lg type-numeric',
									p.balanceCents >= START_BALANCE_CENTS
										? 'bg-up-container text-on-up-container'
										: 'bg-down-container text-on-down-container'
								]}>{dollars(p.balanceCents, { cents: false })}</span
							>
						{:else if p && p.step > 0}
							<span class="type-label-lg text-on-surface-variant">Call {p.step + 1} of 5</span>
						{:else}
							<span class="type-label-lg text-m3-primary">Play</span>
						{/if}
						<ChevronRight class="size-5 text-on-surface-variant" />
					</span>
				</a>
			</li>
		{/each}
	</ol>

	{#if archive.days.length === 0}
		<div class="mt-6 flex flex-col items-start gap-3">
			<p class="type-body-lg text-on-surface">No past charts yet.</p>
			<p class="type-body-md text-on-surface-variant">
				Each day's chart lands here after midnight Eastern, ready to play any time.
			</p>
			<Button href="/" variant="tonal" size="sm">Play today's chart</Button>
		</div>
	{/if}
</main>

<style>
	.row {
		display: flex;
		align-items: center;
		gap: 1rem;
		min-height: 4rem;
		padding: 0.5rem 0.75rem 0.5rem 1.25rem;
		border-radius: var(--md-sys-shape-corner-large, 16px);
		background: var(--md-sys-color-surface-container-low);
	}
	.row.today {
		background: var(--md-sys-color-surface-container-high);
	}
	.row:focus-visible {
		outline: 2px solid var(--md-sys-color-primary);
		outline-offset: 2px;
	}
</style>
