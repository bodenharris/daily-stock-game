<script lang="ts">
	import * as Drawer from '#lib/components/ui/drawer/index.js';
	import { Button } from '#lib/components/ui/button/index.js';

	// `view` is accepted (and ignored) so both lazily loaded sheets share one prop shape.
	// eslint-disable-next-line svelte/no-unused-props
	let { open = $bindable(false) }: { open?: boolean; view?: unknown } = $props();
</script>

<Drawer.Root bind:open>
	<Drawer.Content>
		<div class="mx-auto w-full max-w-md px-6 pb-6">
			<Drawer.Header class="px-0">
				<Drawer.Title>How to play</Drawer.Title>
			</Drawer.Header>
			<div class="flex flex-col gap-3 type-body-lg text-on-surface">
				<p>
					Every day, one real chart from a famous market moment. The name and dates stay hidden.
				</p>
				<p>
					Make five calls. Each one asks: does the price end the next stretch above or below the
					dashed line?
				</p>
				<p>
					You start with $100 and bet 10%, 25% or 50% of your balance on each call. Right calls pay
					more when most players called it the other way.
				</p>
				<p class="text-on-surface-variant">
					Then the chart is unmasked. Finish for a bonus round, and come back tomorrow for the next
					one (midnight Eastern).
				</p>
			</div>
			<Button variant="tonal" size="md" class="mt-6 w-full" onclick={() => (open = false)}>
				Got it
			</Button>
		</div>
	</Drawer.Content>
</Drawer.Root>
