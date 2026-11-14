<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import Sheet from './Sheet.svelte';

	// `view` is accepted (and ignored) so both lazily loaded sheets share one prop shape.
	// eslint-disable-next-line svelte/no-unused-props
	let { open = $bindable(false) }: { open?: boolean; view?: unknown } = $props();
</script>

<Sheet bind:open title="How to play">
	<div class="flex flex-col gap-3 type-body-lg text-on-surface">
		<p>Every day, one real chart from a famous market moment. The name and dates stay hidden.</p>
		<p>
			Make five calls. Each one asks: does the price end the next stretch above or below the dashed
			line?
		</p>
		<p>
			You start with $100 and bet 10%, 25% or 50% of your balance on each call. A right call wins
			your bet, plus a crowd bonus when most players called it the other way.
		</p>
		<p class="text-on-surface-variant">
			Then name the moment, just for bragging rights, and the chart is unmasked. A new chart comes
			out every day at midnight Eastern, and you can play past ones any time.
		</p>
		<p class="keys hidden text-on-surface-variant">
			On a keyboard: <span class="whitespace-nowrap"><kbd>↑</kbd> and <kbd>↓</kbd></span> make the
			call, and <span class="whitespace-nowrap"><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd></span> pick the
			bet.
		</p>
	</div>
	<Button variant="tonal" size="md" class="mt-6 w-full" onclick={() => (open = false)}>
		Got it
	</Button>
</Sheet>

<style>
	@media (pointer: fine) and (min-width: 768px) {
		.keys {
			display: block;
		}
	}
	kbd {
		display: inline-grid;
		place-items: center;
		min-width: 1.5rem;
		padding: 0 0.3rem;
		border-radius: 6px;
		background: var(--md-sys-color-surface-container-highest);
		color: var(--md-sys-color-on-surface);
		font: inherit;
		font-size: 0.875em;
		line-height: 1.5rem;
	}
</style>
