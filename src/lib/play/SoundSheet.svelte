<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.js';
  import { Label } from '#lib/components/ui/label/index.js';
  import { Switch } from '#lib/components/ui/switch/index.js';
  import { sound } from '#lib/audio/sound.svelte.ts';
  import Sheet from './Sheet.svelte';

  let { open = $bindable(false) }: { open?: boolean } = $props();

  const id = $props.id();
</script>

{#snippet setting(
  key: string,
  title: string,
  line: string,
  on: boolean,
  set: (on: boolean) => void,
)}
  <div class="flex items-center justify-between gap-4">
    <Label for="{id}-{key}" class="flex-col items-start gap-0.5">
      <span class="type-title-md text-on-surface">{title}</span>
      <span class="type-body-md text-on-surface-variant">{line}</span>
    </Label>
    <Switch id="{id}-{key}" checked={on} onCheckedChange={set} />
  </div>
{/snippet}

<Sheet bind:open title="Sound" description="Saved in this browser.">
  <div class="flex flex-col gap-5">
    {@render setting(
      'fx',
      'Sound effects',
      'Taps, calls, results and the howl.',
      sound.effects,
      (on) => sound.setEffects(on),
    )}
    {@render setting(
      'amb',
      'Night ambience',
      'Wind, crickets and the city far off.',
      sound.ambience,
      (on) => sound.setAmbience(on),
    )}
  </div>
  <Button variant="tonal" size="md" class="mt-6 w-full" onclick={() => (open = false)}>Done</Button>
</Sheet>
