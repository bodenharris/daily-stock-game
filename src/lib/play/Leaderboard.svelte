<script lang="ts">
	import { archetypeByKey, type Archetype } from '#lib/game/archetype.ts';
	import { dollars } from './money.ts';
	import type { Leaderboard } from './types.ts';

	let {
		board,
		yours,
		archive = false,
		heading = true
	}: {
		board: Leaderboard;
		/**
		 * The viewer's archetype as the ending card shows it, so their row always agrees.
		 * Without it, their row shows the archetype stored on their game.
		 */
		yours?: Archetype;
		archive?: boolean;
		/** Show the title and player count; off when a sheet around the board already does. */
		heading?: boolean;
	} = $props();

	const rows = $derived(
		board.rows.map((r, i) => ({
			...r,
			archetype: (r.you && yours) || archetypeByKey(r.archetype),
			// The viewer's own row, when it didn't make the top, comes after a gap.
			gapBefore: i > 0 && r.pos > board.rows[i - 1].pos + 1
		}))
	);
</script>

<!-- The day's best finishes. Nobody is named: each row shows how that player played. -->
<section aria-labelledby={heading ? 'leaderboard-title' : undefined} class="flex flex-col gap-2">
	{#if heading}
		<div class="flex items-baseline justify-between gap-3 px-1">
			<h3 id="leaderboard-title" class="type-title-md text-on-surface">
				{archive ? 'Leaderboard' : "Today's leaderboard"}
			</h3>
			<p class="type-label-md text-on-surface-variant type-numeric">
				{board.finished}
				{board.finished === 1 ? 'player' : 'players'}
			</p>
		</div>
	{/if}

	<ol class="flex flex-col gap-0.5 overflow-hidden rounded-m3-xl bg-surface-container">
		{#each rows as row (row.pos)}
			{#if row.gapBefore}
				<li aria-hidden="true" class="py-0.5 text-center type-label-md text-on-surface-variant">
					⋯
				</li>
			{/if}
			<li
				class={[
					'grid grid-cols-[minmax(2.25rem,auto)_1fr_auto] items-center gap-2 px-4 py-2',
					row.you ? 'bg-primary-container text-on-primary-container' : 'text-on-surface'
				]}
				aria-current={row.you ? 'true' : undefined}
			>
				<span class="type-label-lg type-numeric opacity-80">
					<span class="sr-only">{row.tied ? 'Tied for place' : 'Place'}</span>
					{row.place}
				</span>
				<span class="min-w-0 truncate type-body-md">
					{#if row.archetype}<span aria-hidden="true">{row.archetype.emoji}</span>{/if}
					{#if row.you}
						<span class="type-label-lg">You</span>
						{#if row.archetype}<span class="opacity-80">· {row.archetype.label}</span>{/if}
					{:else}
						{row.archetype?.label ?? 'Player'}
					{/if}
				</span>
				<span class="type-label-lg type-numeric">{dollars(row.balanceCents, { cents: false })}</span
				>
			</li>
		{/each}
	</ol>

	{#if board.finished === 1}
		<p class="px-1 type-body-sm text-on-surface-variant">
			{archive ? 'Nobody else has played this one yet.' : "You're the first to finish today."}
		</p>
	{/if}
</section>
