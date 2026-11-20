<script lang="ts">
  import './layout.css';
  import { page } from '$app/state';
  import favicon from '#lib/assets/favicon.svg';
  import { sound } from '#lib/audio/sound.svelte.ts';
  import WolfNotice from '#lib/brand/WolfNotice.svelte';
  import { Button } from '#lib/components/ui/button/index.js';
  import { GAME_NAME, SITE_URL } from '#lib/game/config.ts';
  import type { LayoutProps } from './$types';

  let { children }: LayoutProps = $props();

  $effect(() => sound.load());

  /**
   * Every button and link clicks softly. Controls with a sound of their own (the Up and Down
   * calls, the wolf) opt out with `data-sfx="none"`. Runs after the control's own handler, so
   * switching effects on is heard and switching them off is not.
   */
  function onclick(e: MouseEvent) {
    const el = (e.target as Element | null)?.closest('button, a[href], [role="button"]');
    if (el && !el.closest('[data-sfx="none"]')) sound.play('tap');
  }
</script>

<!-- Browsers only allow audio after a tap or key press, so the first one opens it. -->
<svelte:window onpointerdown={() => sound.unlock()} onkeydown={() => sound.unlock()} {onclick} />
<svelte:document onvisibilitychange={() => sound.visibility(document.hidden)} />

<svelte:head>
  <link rel="icon" href={favicon} />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <!-- Search engines index the production domain, not the workers.dev or Preview copies. -->
  <link rel="canonical" href={new URL(page.url.pathname, SITE_URL).href} />
  <!-- Link previews (iMessage, WhatsApp, Slack, Discord), drawn by scripts/make-images.py. -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content={GAME_NAME} />
  <meta property="og:title" content={GAME_NAME} />
  <meta
    property="og:description"
    content="One famous stock chart a day, name hidden. Five up-or-down calls on what it did next."
  />
  <meta property="og:image" content={new URL('/og.png', page.url.origin).href} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta
    property="og:image:alt"
    content="{GAME_NAME}: a price line stopping before five empty slots."
  />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<svelte:boundary onerror={(e) => console.error(e)}>
  {@render children()}

  <!-- A crash while rendering: never show the raw error to players (onerror logs it), just a
	     way back. Reloading, because a query that failed keeps failing until it is asked again. -->
  {#snippet failed()}
    <WolfNotice title="Something went sideways.">
      <Button variant="filled" size="md" onclick={() => location.reload()}>Try again</Button>
      <Button href="/" variant="tonal" size="md">Today's chart</Button>
    </WolfNotice>
  {/snippet}
</svelte:boundary>
