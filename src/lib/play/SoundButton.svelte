<script lang="ts">
	import Volume2 from '@lucide/svelte/icons/volume-2';
	import VolumeX from '@lucide/svelte/icons/volume-x';
	import { IconButton } from '#lib/components/ui/icon-button/index.js';
	import { sound } from '#lib/audio/sound.svelte.ts';

	/** The header's speaker: shows whether anything can play, and opens the sound settings. */
	const on = $derived(sound.effects || sound.ambience);

	let open = $state(false);
	// The sheet (and its drawer library) loads on first open, keeping the first paint light.
	let SoundSheet = $state<typeof import('./SoundSheet.svelte').default>();

	async function show() {
		SoundSheet ??= (await import('./SoundSheet.svelte')).default;
		open = true;
	}
</script>

<IconButton
	class="pixel-panel"
	variant="tonal"
	aria-label={on ? 'Sound settings (on)' : 'Sound settings (muted)'}
	onclick={show}
>
	{#if on}<Volume2 />{:else}<VolumeX />{/if}
</IconButton>

{#if SoundSheet}
	<SoundSheet bind:open />
{/if}
