<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, note, children }: { title: string; note?: string; children: Snippet } = $props();
</script>

<section class="flex flex-col gap-4">
	<header class="flex flex-col gap-1">
		<h2 class="type-title-lg-emphasized text-on-surface">{title}</h2>
		{#if note}<p class="type-body-md text-on-surface-variant">{note}</p>{/if}
	</header>
	{@render children()}
</section>
