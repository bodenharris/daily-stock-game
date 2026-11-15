<script lang="ts">
	import { Switch } from '#lib/components/ui/switch/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { sound } from '#lib/audio/sound.svelte.ts';
	import Sheet from './Sheet.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	const id = $props.id();
</script>

<Sheet bind:open title="Sound" description="Saved in this browser.">
	<div class="flex flex-col gap-5">
		<div class="flex items-center justify-between gap-4">
			<Label for="{id}-fx" class="flex-col items-start gap-0.5">
				<span class="type-title-md text-on-surface">Sound effects</span>
				<span class="type-body-md text-on-surface-variant">Taps, calls, results and the howl.</span>
			</Label>
			<Switch id="{id}-fx" checked={sound.effects} onCheckedChange={(on) => sound.setEffects(on)} />
		</div>
		<div class="flex items-center justify-between gap-4">
			<Label for="{id}-amb" class="flex-col items-start gap-0.5">
				<span class="type-title-md text-on-surface">Night ambience</span>
				<span class="type-body-md text-on-surface-variant"
					>Wind, crickets and the city far off.</span
				>
			</Label>
			<Switch
				id="{id}-amb"
				checked={sound.ambience}
				onCheckedChange={(on) => sound.setAmbience(on)}
			/>
		</div>
	</div>
	<Button variant="tonal" size="md" class="pixel-panel mt-6 w-full" onclick={() => (open = false)}>
		Done
	</Button>
</Sheet>
