<script lang="ts">
	import * as Drawer from '#lib/components/ui/drawer/index.js';

	// `view` is accepted (and ignored) so both lazily loaded sheets share one prop shape.
	// eslint-disable-next-line svelte/no-unused-props
	let { open = $bindable(false) }: { open?: boolean; view?: unknown } = $props();
</script>

<Drawer.Root bind:open>
	<Drawer.Content>
		<div class="mx-auto w-full max-w-md px-6 pb-8">
			<Drawer.Header class="px-0">
				<Drawer.Title>How it works</Drawer.Title>
			</Drawer.Header>
			<ol class="flex flex-col gap-4 type-body-lg text-on-surface">
				<li class="flex gap-3">
					<span class="num">1</span>
					<span>A real chart from a famous market moment. Name and dates are hidden.</span>
				</li>
				<li class="flex gap-3">
					<span class="num">2</span>
					<span
						>Call it five times: will it end the next stretch above or below the dashed line?</span
					>
				</li>
				<li class="flex gap-3">
					<span class="num">3</span>
					<span
						>Bet 10%, 25% or 50% of your balance each time. You start with $100. Being right when
						most players called the other way pays more.</span
					>
				</li>
				<li class="flex gap-3">
					<span class="num">4</span>
					<span>Then see what it was. A new chart every day at midnight Eastern.</span>
				</li>
			</ol>
		</div>
	</Drawer.Content>
</Drawer.Root>

<style>
	.num {
		display: grid;
		place-items: center;
		flex: none;
		width: 28px;
		height: 28px;
		border-radius: 9999px;
		background: var(--md-sys-color-primary-container);
		color: var(--md-sys-color-on-primary-container);
		font: 600 14px / 1 var(--md-ref-typeface-brand);
	}
</style>
