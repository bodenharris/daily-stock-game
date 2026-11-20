<script lang="ts">
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import WolfScene from '#lib/brand/WolfScene.svelte';
  import { CALLS_PER_GAME, GAME_NAME, START_BALANCE_CENTS } from '#lib/game/config.ts';
  import { dollars, formatDate } from '#lib/play/format.ts';
  import { getArchive } from '#lib/remote/game.remote.ts';

  const archive = $derived(await getArchive());
  const played = $derived(archive.days.filter((d) => d.played?.finished).length);
</script>

<svelte:head>
  <title>Past charts · {GAME_NAME}</title>
  <meta
    name="description"
    content="Every past day of {GAME_NAME}, the daily stock chart game. Play the charts you missed."
  />
</svelte:head>

<div class="flex min-h-dvh flex-col">
  <WolfScene title="Past charts" back={{ href: '/', label: "Back to today's chart" }}>
    {archive.days.length
      ? `${played} of ${archive.days.length} played`
      : `Issue #${archive.today} is today`}
  </WolfScene>

  <main
    class="mx-auto flex w-full max-w-md flex-1 flex-col pt-5 px-safe pb-safe md:max-w-2xl md:[--gutter:1.5rem]"
  >
    <p class="type-body-lg text-on-surface-variant">
      Every chart so far. Past days don't count toward your streak.
    </p>

    <!-- One panel, one row per issue: today leads in cyan, charts still to play sit raised,
		     finished ones sink back. -->
    <ol class="list pixel-panel mt-6">
      <li>
        <a href="/" class="row today state-layer">
          <span class="flex flex-col">
            <span class="type-title-md type-numeric">Issue #{archive.today}</span>
            <span class="type-body-sm text-on-primary-container/80">Today</span>
          </span>
          <span class="ml-auto flex items-center gap-1 type-label-lg text-m3-primary uppercase">
            Today's chart <ChevronRight class="size-5" />
          </span>
        </a>
      </li>
      {#each archive.days as day (day.number)}
        {@const p = day.played}
        <li>
          <a href="/day/{day.number}" class={['row state-layer', p?.finished && 'done']}>
            <span class="flex flex-col">
              <span class="type-title-md type-numeric">Issue #{day.number}</span>
              <span class="type-body-sm text-on-surface-variant">
                {formatDate(day.date, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </span>
            <span class="ml-auto flex items-center gap-3">
              {#if p?.finished}
                <span class="type-body-sm text-on-surface-variant type-numeric">
                  {p.right}/{CALLS_PER_GAME} right
                </span>
                <span
                  class={[
                    'px-2.5 py-0.5 type-label-lg type-numeric',
                    p.balanceCents >= START_BALANCE_CENTS
                      ? 'bg-up-container text-on-up-container'
                      : 'bg-down-container text-on-down-container',
                  ]}
                >
                  {dollars(p.balanceCents)}
                </span>
              {:else if p && p.step > 0}
                <span class="type-label-lg uppercase type-numeric">
                  Call {p.step + 1} of {CALLS_PER_GAME}
                </span>
              {:else}
                <span class="type-label-lg text-m3-primary uppercase">Play</span>
              {/if}
              <ChevronRight class="size-5 text-on-surface-variant" />
            </span>
          </a>
        </li>
      {/each}
    </ol>

    {#if archive.days.length === 0}
      <div class="mt-8 flex flex-col items-start gap-3">
        <p class="type-body-lg text-on-surface">No past charts yet.</p>
        <p class="type-body-md text-on-surface-variant">
          Each day's chart lands here after midnight Eastern, ready to play any time.
        </p>
      </div>
    {/if}
  </main>
</div>

<style>
  .list {
    background: var(--md-sys-color-surface-container-low);
  }
  .list > li + li {
    border-top: 1px solid var(--md-sys-color-outline-variant);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 1rem;
    min-height: 4rem;
    padding: 0.5rem 0.75rem 0.5rem 1rem;
    background: var(--md-sys-color-surface-container);
    color: var(--md-sys-color-on-surface);
  }
  /* inside the panel's frame, so it never runs into the next row */
  .row:focus-visible {
    outline-offset: -3px;
  }
  .row.today {
    background: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
  }
  /* finished: sunk into the panel, the result chip does the talking */
  .row.done {
    background: transparent;
    color: var(--md-sys-color-on-surface-variant);
  }
</style>
