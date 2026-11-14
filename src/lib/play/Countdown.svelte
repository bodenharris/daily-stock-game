<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { getGame } from '#lib/remote/game.remote.ts';

	let { to }: { to: number } = $props();
	let now = $state(Date.now());

	$effect(() => {
		const id = setInterval(() => {
			now = Date.now();
			if (now >= to) {
				clearInterval(id);
				// A new puzzle is out: fetch it.
				void getGame().refresh();
				void invalidateAll();
			}
		}, 1000);
		return () => clearInterval(id);
	});

	const left = $derived(Math.max(0, to - now));
	const text = $derived.by(() => {
		const s = Math.floor(left / 1000);
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const sec = s % 60;
		if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
		return `${m}:${String(sec).padStart(2, '0')}`;
	});
</script>

<span class="type-numeric">{text}</span>
