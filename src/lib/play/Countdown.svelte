<script lang="ts">
	import { getGame } from '#lib/remote/game.remote.ts';

	/**
	 * Time until the next chart. At zero it offers the new chart instead of swapping it in, so
	 * nobody loses the result they are looking at.
	 */
	let { to }: { to: number } = $props();

	// Unknown until the browser ticks, so the server and the first paint agree.
	let now = $state<number | null>(null);
	$effect(() => {
		now = Date.now();
		const id = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(id);
	});

	const left = $derived(now === null ? null : Math.max(0, to - now));
	const text = $derived.by(() => {
		if (left === null) return '';
		const s = Math.floor(left / 1000);
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
		return `${m}:${String(s % 60).padStart(2, '0')}`;
	});
</script>

{#if left === 0}
	<button
		class="type-label-lg text-m3-primary underline underline-offset-4"
		onclick={() => getGame().refresh()}
	>
		Today's chart is out. Play it
	</button>
{:else}
	<span>Next chart in <span class="type-numeric">{text}</span></span>
{/if}
