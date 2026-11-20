<script lang="ts">
  import { page } from '$app/state';
  import WolfNotice from '#lib/brand/WolfNotice.svelte';
  import { Button } from '#lib/components/ui/button/index.js';
  import { GAME_NAME } from '#lib/game/config.ts';

  const notFound = $derived(page.status === 404);
  // Our own errors carry a message worth showing; a crash only says "Internal Error".
  const detail = $derived(
    page.error?.message && page.error.message !== 'Internal Error' ? page.error.message : undefined,
  );
</script>

<svelte:head>
  <title>{notFound ? 'Not found' : 'Something went wrong'} · {GAME_NAME}</title>
</svelte:head>

{#if notFound}
  <WolfNotice title="This page got delisted.">
    <Button href="/" variant="filled" size="md">Today's chart</Button>
    <Button href="/archive" variant="tonal" size="md">Past charts</Button>
  </WolfNotice>
{:else}
  <WolfNotice title="Something went sideways." {detail}>
    <Button variant="filled" size="md" onclick={() => location.reload()}>Try again</Button>
    <Button href="/" variant="tonal" size="md">Today's chart</Button>
  </WolfNotice>
{/if}
