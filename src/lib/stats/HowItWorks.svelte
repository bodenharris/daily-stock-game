<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Database from '@lucide/svelte/icons/database';
	import type { LiveStats } from '#lib/remote/stats.remote.ts';

	let { data, queryMs }: { data: LiveStats['data']; queryMs: number } = $props();

	const millions = (n: number) =>
		n >= 1_000_000
			? `${(n / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 })} million`
			: n.toLocaleString('en-US');

	// Built as one string so the template's whitespace can't eat a space.
	const prices = $derived(
		`${millions(data.priceRows)} daily prices across ${data.tickers} tickers` +
			(data.compressionRatio
				? ` are compressed ${data.compressionRatio.toFixed(1)}× in the columnstore.`
				: '.')
	);
</script>

<details class="group rounded-m3-xl bg-surface-container-low text-on-surface-variant">
	<summary
		class="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-m3-xl px-4 type-label-lg select-none hover:bg-on-surface/8 focus-visible:outline-2 focus-visible:outline-m3-primary [&::-webkit-details-marker]:hidden"
	>
		<Database class="size-4 shrink-0" />
		How this page works
		<ChevronDown
			class="ml-auto size-5 shrink-0 group-open:rotate-180 motion-safe:transition-transform motion-safe:duration-200"
		/>
	</summary>
	<ul class="flex flex-col gap-2 px-4 pt-1 pb-4 type-body-sm">
		<li>Every call is stored in a hypertable on Tiger Data.</li>
		<li>The crowd split and payouts come from continuous aggregates, updated as you play.</li>
		<li>The median and your rank come from a percentile sketch, without scanning every game.</li>
		<li class="type-numeric">{prices}</li>
		<li class="type-numeric">This page's numbers took {queryMs} ms to query.</li>
	</ul>
</details>
