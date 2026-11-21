<script lang="ts">
  import CalendarDays from '@lucide/svelte/icons/calendar-days';
  import ChartColumn from '@lucide/svelte/icons/chart-column';
  import CircleHelp from '@lucide/svelte/icons/circle-help';
  import CircleUser from '@lucide/svelte/icons/circle-user';
  import GithubIcon from '#lib/brand/GithubIcon.svelte';
  import WolfScene from '#lib/brand/WolfScene.svelte';
  import { IconButton } from '#lib/components/ui/icon-button/index.js';
  import { GAME_NAME, GITHUB_URL } from '#lib/game/config.ts';
  import Game from '#lib/play/Game.svelte';
  import SoundButton from '#lib/play/SoundButton.svelte';
  import { formatDate } from '#lib/play/format.ts';
  import { getGame } from '#lib/remote/game.remote.ts';

  const view = $derived(await getGame());
  /** The day's date, newspaper style ("Sat, Nov 14, 2026"), in parts so narrow phones can drop
   * the weekday and year. */
  const issueDate = $derived({
    weekday: formatDate(view.date, { weekday: 'short' }),
    day: formatDate(view.date, { month: 'short', day: 'numeric' }),
    year: formatDate(view.date, { year: 'numeric' }),
  });

  // The sheets (and their drawer library) load on first open, keeping the first paint light.
  let HelpSheet = $state<typeof import('#lib/play/HelpSheet.svelte').default>();
  let AccountSheet = $state<typeof import('#lib/play/AccountSheet.svelte').default>();
  let helpOpen = $state(false);
  let accountOpen = $state(false);

  async function openHelp(auto = false) {
    HelpSheet ??= (await import('#lib/play/HelpSheet.svelte')).default;
    // The sheet's code can take a while to load (seconds in dev, or on a slow phone). If the
    // player has started meanwhile, don't drop the help over their game.
    if (auto && view.results.length > 0) return;
    helpOpen = true;
  }

  async function openAccount() {
    AccountSheet ??= (await import('#lib/play/AccountSheet.svelte')).default;
    accountOpen = true;
  }

  // First visit ever, before any call: show how to play once, like Wordle does.
  $effect(() => {
    if (view.results.length > 0) return;
    let seen = true;
    try {
      seen = localStorage.getItem('thewolf:seen-help') === '1';
      localStorage.setItem('thewolf:seen-help', '1');
    } catch {
      // Storage blocked: skip the auto-open rather than nag on every visit.
    }
    if (!seen) void openHelp(true);
  });
</script>

<svelte:head>
  <title>{GAME_NAME} #{view.number} · The daily stock chart game</title>
  <meta
    name="description"
    content="One famous stock chart a day, name hidden. Five up-or-down calls on what it did next."
  />
</svelte:head>

<div class="flex min-h-dvh flex-col">
  <WolfScene>
    <h1
      class="glitch-text font-pixel text-2xl leading-none uppercase [--glitch-drop:3px] md:text-[2.5rem] md:[--glitch-drop:5px]"
    >
      {GAME_NAME}
    </h1>
    <p class="tagline neon-text mt-2 type-title-md md:mt-3 md:type-title-lg">The daily hunt</p>
    <p
      class="mt-0.5 type-label-lg tracking-[0.12em] whitespace-nowrap text-on-surface-variant uppercase type-numeric [text-shadow:0_2px_0_var(--pixel-ink)]"
    >
      Issue #{view.number}&ensp;·&ensp;<time datetime={view.date}>
        <span class="max-[374px]:hidden">{`${issueDate.weekday}, `}</span>{issueDate.day}<span
          class="max-[374px]:hidden"
        >
          {`, ${issueDate.year}`}
        </span>
      </time>
    </p>
    {#if view.streak > 1}
      <p
        class="streak type-label-lg tracking-[0.12em] whitespace-nowrap uppercase type-numeric [text-shadow:0_2px_0_var(--pixel-ink)]"
      >
        {view.streak} day streak
      </p>
    {/if}
    {#snippet actions()}
      <IconButton variant="tonal" aria-label="How to play" onclick={() => openHelp()}>
        <CircleHelp />
      </IconButton>
      <SoundButton />
      <IconButton variant="tonal" href="/archive" aria-label="Past charts">
        <CalendarDays />
      </IconButton>
      <IconButton variant="tonal" href="/stats" aria-label="Live stats">
        <ChartColumn />
      </IconButton>
      <IconButton
        variant="tonal"
        aria-label={view.signedIn ? 'Your account' : 'Save your streak'}
        onclick={openAccount}
      >
        <CircleUser />
      </IconButton>
      <IconButton
        variant="tonal"
        href={GITHUB_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Source code on GitHub"
      >
        <GithubIcon />
      </IconButton>
    {/snippet}
  </WolfScene>
  <main
    class="mx-auto flex w-full max-w-md flex-1 flex-col pt-4 px-safe pb-safe md:max-w-2xl md:[--gutter:1.5rem] lg:max-w-7xl lg:[--gutter:2rem]"
  >
    <Game {view} />
  </main>
</div>

{#if HelpSheet}
  <HelpSheet bind:open={helpOpen} />
{/if}
{#if AccountSheet}
  <AccountSheet bind:open={accountOpen} {view} />
{/if}
