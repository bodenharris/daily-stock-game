<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
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
				? ` are kept compressed, ${data.compressionRatio.toFixed(1)}× smaller than raw.`
				: '.')
	);
</script>

<details class="group pixel-panel bg-surface-container-low text-on-surface-variant">
	<summary
		class="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 type-label-lg select-none hover:bg-on-surface/8 [&::-webkit-details-marker]:hidden"
	>
		How this page works
		<ChevronDown
			class="ml-auto size-5 shrink-0 group-open:rotate-180 motion-safe:transition-transform motion-safe:duration-200"
		/>
	</summary>
	<ul class="flex flex-col gap-2 px-4 pt-1 pb-4 type-body-sm">
		<li>Every call is saved to a Tiger Data database the moment it's made.</li>
		<li>The crowd's split and the payouts are running totals, kept current as you play.</li>
		<li>The median and your rank come from a compact summary of every finish, not a recount.</li>
		<li class="type-numeric">{prices}</li>
		<li class="type-numeric">Fetching this page's numbers took {queryMs} ms.</li>
	</ul>
</details>
