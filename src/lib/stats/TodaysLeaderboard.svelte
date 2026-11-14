<script lang="ts">
	import { todaysLeaderboard } from '#lib/remote/stats.remote.ts';
	import Leaderboard from '#lib/play/Leaderboard.svelte';

	// Mounted only while the sheet is open, so the board is read when it's opened, not every tick.
	const board = $derived(await todaysLeaderboard());
</script>

{#if board}
	<Leaderboard {board} heading={false} />
{:else}
	<p class="type-body-md text-on-surface-variant">The leaderboard couldn't be loaded.</p>
{/if}
