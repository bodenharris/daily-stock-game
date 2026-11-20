<script lang="ts">
  import { untrack } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { Tween, prefersReducedMotion } from 'svelte/motion';
  import { fly } from 'svelte/transition';
  import { isHttpError } from '@sveltejs/kit';
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import { Button } from '#lib/components/ui/button/index.js';
  import { sound } from '#lib/audio/sound.svelte.ts';
  import { START_BALANCE_CENTS, STAKE_OPTIONS } from '#lib/game/config.ts';
  import { stakeCentsFor } from '#lib/game/economy.ts';
  import { pop } from '#lib/transitions.ts';
  import { getDay, getGame, makeCall } from '#lib/remote/game.remote.ts';
  import CallLog from './CallLog.svelte';
  import CallPips from './CallPips.svelte';
  import NameIt from './NameIt.svelte';
  import PriceChart from './PriceChart.svelte';
  import Reveal from './Reveal.svelte';
  import StakePicker from './StakePicker.svelte';
  import { callSpan, chartTimeframe, dollars, paidByCall, wholeDollarCents } from './format.ts';
  import type { Direction, GameView } from './types.ts';

  /** `archive`: a past day played from the archive, not today's chart. */
  let { view, archive = false }: { view: GameView; archive?: boolean } = $props();

  /** How long the chart takes to draw a new stretch. Everything else waits for it. */
  const DRAW_MS = 900;
  /** The fifth call's own beat, after its stretch lands and before the ending takes over. */
  const LAST_CALL_MS = 1800;
  /** How long a named moment stays on screen before the unmasking. */
  const NAMED_MS = 1400;
  /** The middle chip. Every call starts on it, so a big bet is always a choice, never a leftover. */
  const DEFAULT_STAKE = 25;
  const CALL_BUTTONS = [
    { dir: 'up', label: 'Up', Icon: ArrowUp, key: '↑' },
    { dir: 'down', label: 'Down', Icon: ArrowDown, key: '↓' },
  ] as const;

  /** Run `fn` after `ms` (at once under reduced motion); returns the cancel. */
  function after(ms: number, fn: () => void) {
    const id = setTimeout(fn, prefersReducedMotion.current ? 0 : ms);
    return () => clearTimeout(id);
  }

  let stakePercent = $state(DEFAULT_STAKE);
  let pending = $state<Direction | null>(null);
  let error = $state<string | null>(null);
  /** Set once something settles in this session, so it animates (and sounds) as it lands. */
  let fresh = $state(false);

  /*
   * The game as the player has seen it. The server answers at once, but the dots, balance,
   * result and next stakes only update once the chart has drawn the stretch, so nothing gives
   * the outcome away before the line does. Then the fifth call gets a beat of its own.
   */
  let shown = $state(untrack(() => view.results.length));
  let ended = $state(untrack(() => view.finished));
  $effect(() => {
    const total = view.results.length;
    if (total > shown) {
      return after(DRAW_MS, () => {
        shown = total;
        stakePercent = DEFAULT_STAKE;
      });
    }
    if (total < shown) {
      // A different game (a new day): show it as it stands.
      shown = total;
      ended = view.finished;
      stakePercent = DEFAULT_STAKE;
    } else if (view.finished && !ended) {
      return after(LAST_CALL_MS, () => (ended = true));
    }
  });

  const results = $derived(view.results.slice(0, shown));
  const latest = $derived(results.at(-1));
  const revealing = $derived(shown < view.results.length);
  const finished = $derived(view.finished && !revealing && ended);
  const busy = $derived(!!pending || revealing || view.finished);
  /** The call in flight or being revealed, highlighted until the result lands. */
  const chosen = $derived(pending ?? (revealing ? (view.results.at(-1)?.direction ?? null) : null));

  // "Name the moment" sits between the last call and the unmasking. Once answered, the right
  // option stays on screen for a beat before the reveal takes over.
  let nameHold = $state(false);
  const naming = $derived(
    finished && !!view.nameIt && (!view.nameIt.answered || nameHold || !view.reveal),
  );
  const showReveal = $derived(finished && !naming);

  function answered(named: boolean) {
    fresh = true;
    nameHold = true;
    buzz(named ? [8, 60, 16] : 20);
    sound.play(named ? 'right' : 'wrong');
    after(NAMED_MS, () => (nameHold = false));
  }

  const balanceCents = $derived(latest?.balanceAfterCents ?? START_BALANCE_CENTS);
  const shownBalance = new Tween(
    untrack(() => balanceCents),
    { duration: 700, easing: cubicOut },
  );
  $effect(() => {
    void shownBalance.set(balanceCents, prefersReducedMotion.current ? { duration: 0 } : undefined);
  });

  /** The last call's result: the outcome and money first, then how the crowd called it. */
  const result = $derived.by(() => {
    if (!latest) return null;
    const { direction, crowd } = latest;
    const total = crowd.up + crowd.down;
    const same = direction === 'up' ? crowd.up : crowd.down;
    // Short enough to sit on one line of a phone, crowd bonus aside.
    const split =
      total <= 1
        ? `You're the first to call this one.`
        : total <= 20
          ? `${same} of ${total} called ${direction}.`
          : `${Math.round((same / total) * 100)}% called ${direction} too.`;
    // A right call returns the stake, plus a crowd bonus when most players called it wrong.
    // The same amount the scoreboard shows for this call, so the two never disagree, and the
    // bonus is what's left over after the stake, so the sentence adds up.
    const paid = paidByCall(results, START_BALANCE_CENTS).at(-1)!;
    const bonus =
      latest.correct && latest.deltaCents > latest.stakeCents
        ? paid - wholeDollarCents(latest.stakeCents)
        : 0;
    return {
      outcome: `${latest.correct ? 'Right.' : 'Missed.'} ${dollars(paid, { sign: true })}.`,
      crowd: bonus > 0 ? `${split} Crowd bonus ${dollars(bonus, { sign: true })}.` : split,
    };
  });

  const stakeOptions = $derived(
    STAKE_OPTIONS.map((o) => ({
      percent: o.percent,
      cents: stakeCentsFor(balanceCents, o.percent),
    })),
  );

  function buzz(pattern: number | number[]) {
    // Phones only: desktops have no motor, and keyboard play has no tap to unlock it.
    if (matchMedia('(pointer: coarse)').matches && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }

  async function call(direction: Direction) {
    if (busy) return;
    error = null;
    pending = direction;
    buzz(12);
    sound.play(direction === 'up' ? 'call-up' : 'call-down');
    try {
      const { result: settled } = await makeCall({
        puzzleNumber: view.number,
        archive,
        step: view.results.length + 1,
        direction,
        stakePercent,
      });
      fresh = true;
      // The result is felt and heard as the line lands, not when the server answers.
      after(DRAW_MS, () => {
        buzz(settled.correct ? [8, 60, 16] : 40);
        sound.play(settled.correct ? 'right' : 'wrong');
      });
    } catch (e) {
      const status = isHttpError(e) ? e.status : null;
      const message = isHttpError(e) ? e.body.message : null;
      if (status === 409) {
        // A new day started, or this call was already made in another tab: catch up.
        error = message;
        await (archive ? getDay(view.number) : getGame())
          .refresh()
          .catch(() => (error = 'Refresh the page to continue.'));
      } else if ((status === 429 || status === 503) && message) {
        error = message;
      } else {
        error = navigator.onLine
          ? 'That call did not go through. Try again.'
          : 'You are offline. Try again when you are back.';
      }
    } finally {
      pending = null;
    }
  }

  /** Keyboard play: ↑ / ↓ make the call, 1 / 2 / 3 pick the bet. Never while typing or in a sheet. */
  function onkeydown(e: KeyboardEvent) {
    if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey || busy) return;
    const target = e.target as Element | null;
    if (target?.closest('input, textarea, select, [contenteditable], [role="dialog"]')) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      void call(e.key === 'ArrowUp' ? 'up' : 'down');
      return;
    }
    const stake = STAKE_OPTIONS[Number(e.key) - 1];
    if (stake && stakePercent !== stake.percent) {
      stakePercent = stake.percent;
      sound.play('select');
    }
  }

  /**
   * Phones: the quiz and the unmasking land below the chart. Scroll the balance to the top so
   * the balance, the chart and what comes next share one screen. Short phones go straight to
   * the new part instead.
   */
  function bringIntoView(node: HTMLElement) {
    if (!untrack(() => fresh) || !matchMedia('(max-width: 1023px)').matches) return;
    const balance = node.closest('.game')?.querySelector('.balance-row');
    const target = innerHeight < 680 || !balance ? (node.querySelector('h2') ?? node) : balance;
    scrollTo({
      top: target.getBoundingClientRect().top + scrollY - 16,
      behavior: prefersReducedMotion.current ? 'instant' : 'smooth',
    });
  }

  /** The unmasking gets its fanfare and howl, but only when it happens now, not on a reload. */
  function howl() {
    if (untrack(() => fresh)) sound.play('finale');
  }

  /** Keep keyboard focus on the game when the buttons it was on go away. */
  function holdFocus(node: HTMLElement) {
    if (document.activeElement === document.body) node.focus({ preventScroll: true });
  }
</script>

<svelte:window {onkeydown} />

<!-- One calm announcement per call for screen readers (the visible numbers animate). -->
<p class="sr-only" aria-live="polite">
  {#if result}{result.outcome} {result.crowd} Balance {dollars(balanceCents)}.{/if}
</p>

<!-- Past days have a shorter header than the skyline, so the game can stand taller. -->
<div
  class={['game min-h-0 flex-1', view.finished && 'done']}
  style:--scene-h={archive ? 'var(--scene-h-compact)' : undefined}
>
  <!-- Balance: the one number that matters. -->
  <div class="balance-row flex items-end justify-between gap-3 pt-1">
    <div>
      <p class="neon-text type-label-md lg:type-label-lg">
        {finished ? 'Final balance' : 'Balance'}
      </p>
      <p class="balance type-display-sm-emphasized text-on-surface type-numeric">
        {dollars(Math.round(shownBalance.current))}
      </p>
    </div>
    {#if finished}
      {@const change = view.balanceCents - START_BALANCE_CENTS}
      <span
        class={[
          'mb-1.5 px-3 py-1 type-title-lg-emphasized type-numeric',
          change >= 0
            ? 'bg-up-container text-on-up-container'
            : 'bg-down-container text-on-down-container',
        ]}
        in:pop
      >
        {change >= 0 ? '+' : '−'}{Math.round((Math.abs(change) / START_BALANCE_CENTS) * 100)}%
      </span>
    {/if}
  </div>

  <!-- The chart is the hero. On wide screens it gets the stage and a card of its own. -->
  <div class="chart-area mt-3 flex flex-col">
    <div class="relative min-h-0 flex-1">
      <!-- One chart per game: a new day starts a fresh one. -->
      {#key view.number}
        <PriceChart
          class="absolute inset-0"
          values={view.bars}
          shape={{ contextBars: view.contextBars, stepBars: view.stepBars, calls: view.calls }}
          results={view.results}
          {pending}
          reveal={showReveal ? view.reveal : null}
          span={naming ? (view.nameIt?.span ?? null) : null}
          marks="thewolf:marks:{view.number}"
        />
      {/key}
    </div>
  </div>

  <div class="panel flex min-w-0 flex-col">
    <div class={['pips', !finished && 'hide-wide']}>
      <CallPips {results} calls={view.calls} />
    </div>
    {#if !finished}
      <div class="log">
        <CallLog {results} calls={view.calls} />
      </div>
    {/if}

    {#if showReveal && view.reveal}
      <div {@attach bringIntoView} {@attach howl}>
        <Reveal {view} reveal={view.reveal} {fresh} {archive} />
      </div>
    {:else if naming && view.nameIt}
      <div class="naming flex flex-col" {@attach bringIntoView}>
        <NameIt
          number={view.number}
          nameIt={view.nameIt}
          timeframe={chartTimeframe(view)}
          {archive}
          onAnswered={answered}
        />
      </div>
    {:else}
      <div class="controls flex flex-col pb-4">
        <!-- The last result, then the next question: the ask never leaves the screen. -->
        <div class="flex flex-col gap-1 text-center lg:text-left">
          {#if result}
            {#key latest?.step}
              <p
                class="type-body-md text-balance text-on-surface-variant lg:type-body-lg"
                aria-hidden="true"
                in:fly={{ y: 6, duration: fresh ? 250 : 0 }}
              >
                <span class={latest?.correct ? 'text-up' : 'text-down'}>{result.outcome}</span>
                {result.crowd}
              </p>
            {/key}
          {/if}
          {#if !view.finished}
            <p class="ask type-title-md text-balance text-on-surface lg:type-body-lg">
              Bet on the next {callSpan(view.stepBars)}: up or down?
            </p>
          {/if}
        </div>

        {#if !view.finished}
          <div class="stakes mt-4">
            <StakePicker bind:value={stakePercent} options={stakeOptions} disabled={busy} />
          </div>

          <div class="calls mt-6 grid grid-cols-2 gap-6 px-1.5 pt-1.5 pb-3">
            {#each CALL_BUTTONS as b (b.dir)}
              <Button
                size="hero"
                class={[
                  'call',
                  b.dir,
                  chosen === b.dir && 'chosen',
                  chosen && chosen !== b.dir && 'other',
                ]}
                disabled={busy && chosen !== b.dir}
                aria-label="Call {b.dir}"
                data-sfx="none"
                onclick={() => call(b.dir)}
              >
                <b.Icon strokeWidth={2.5} />
                {b.label}
                <kbd class="key" aria-hidden="true">{b.key}</kbd>
              </Button>
            {/each}
          </div>
        {:else}
          <p
            class="unmasking mt-6 text-center type-title-md text-on-surface-variant lg:text-left"
            tabindex="-1"
            {@attach holdFocus}
          >
            {view.reveal ? 'Unmasking the chart…' : 'One last question…'}
          </p>
        {/if}

        {#if error}
          <p class="mt-2 text-center type-body-sm text-error" role="alert">{error}</p>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .game {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto 1fr auto;
    grid-template-areas: 'balance' 'chart' 'panel';
  }
  .balance-row {
    grid-area: balance;
  }
  .chart-area {
    grid-area: chart;
    min-height: 200px;
  }
  .panel {
    grid-area: panel;
  }
  .pips {
    margin-top: 1rem;
  }
  .controls {
    padding-top: 1rem;
  }
  .naming {
    padding-top: 1.5rem;
  }
  .key,
  .log {
    display: none;
  }
  /* The score readout: chunky 8-bit digits. */
  .balance {
    font-family: var(--md-ref-typeface-pixel);
    font-size: 2rem;
    line-height: 2.75rem;
    letter-spacing: 0;
    text-shadow: 0 3px 0 var(--pixel-ink);
  }

  /* Up and Down are arcade cabinet buttons: a navy face in a green or pink neon frame. The
	   press drops the button onto its base at once, no easing; the tapped one floods with its
	   colour and the other steps back while the stretch is revealed. */
  .calls :global(.call) {
    background: var(--md-sys-color-surface-container);
    color: var(--md-sys-color-on-surface);
    transition:
      background-color 120ms linear,
      color 120ms linear;
  }
  .calls :global(.call.up) {
    --frame: var(--up);
  }
  .calls :global(.call.down) {
    --frame: var(--down);
  }
  /* Mouse only: on touch a tapped button would keep the hover and read as preselected. */
  @media (hover: hover) {
    .calls :global(.call:hover) {
      background: var(--md-sys-color-surface-container-highest);
    }
  }
  .calls :global(.call:active:not(:disabled)) {
    translate: 0 6px;
    box-shadow:
      0 0 0 3px var(--pixel-ink),
      0 0 0 6px var(--frame),
      0 0 26px 0 color-mix(in srgb, var(--frame) 30%, transparent);
  }
  .calls :global(.call.chosen) {
    background: var(--frame);
    color: var(--md-sys-color-surface-container-lowest);
    pointer-events: none;
  }
  .calls :global(.call.other) {
    opacity: 0.5;
  }
  .unmasking {
    outline: none;
    animation: breathe 1.4s ease-in-out infinite;
  }
  @keyframes breathe {
    50% {
      opacity: 0.45;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .unmasking {
      animation: none;
    }
  }

  @media (max-height: 700px) {
    .chart-area {
      min-height: 150px;
    }
    .balance {
      font-size: 1.5rem;
      line-height: 2.25rem;
    }
    .calls :global(.call) {
      --btn-h: 64px;
    }
  }
  /* Once the calls are made, nothing has to fit above the fold: the chart gets its room back. */
  .game.done .chart-area {
    min-height: 200px;
  }
  /* Small phones (an SE, or a phone browser with its bars out): tighter beats all the way down,
	   so the call buttons still make the fold. */
  @media (max-width: 1023px) and (max-height: 620px) {
    .balance-row {
      padding-top: 0;
    }
    .chart-area {
      min-height: 96px;
      margin-top: 0.5rem;
    }
    .pips {
      margin-top: 0.5rem;
    }
    .controls {
      padding-top: 0.5rem;
    }
    .ask {
      font-size: 0.875rem;
      line-height: 1.25rem;
    }
    .stakes {
      margin-top: 0.5rem;
    }
    .calls {
      margin-top: 0.75rem;
    }
  }

  /* Wide screens: the chart takes the stage on the left, the game sits in a rail on the right,
	   with the call buttons level with the bottom of the chart, and both above the fold
	   (--scene-h is the skyline header's height). */
  @media (min-width: 1024px) {
    .game {
      --stage-h: clamp(440px, calc(100dvh - var(--scene-h) - 4rem), 700px);
      flex: none;
      min-height: var(--stage-h);
      margin-top: 0.5rem;
      margin-bottom: 2rem;
      grid-template-columns: minmax(0, 1fr) 22.5rem;
      grid-template-rows: auto 1fr;
      grid-template-areas: 'chart balance' 'chart panel';
      column-gap: 2.5rem;
    }
    /* The chart keeps its play-time size when the reveal makes the rail long, and stays in
		   view while the rail scrolls. */
    .chart-area {
      align-self: start;
      position: sticky;
      top: 1rem;
      height: var(--stage-h);
      margin-top: 0;
      padding: 1.5rem 1.25rem 1rem;
      background: var(--md-sys-color-surface-container-low);
      box-shadow:
        0 0 0 2px var(--pixel-ink),
        0 0 0 4px var(--md-sys-color-outline-variant),
        0 6px 0 4px var(--md-sys-color-shadow);
    }
    .balance-row {
      padding-top: 0.5rem;
    }
    .panel {
      padding-top: 0.75rem;
    }
    .hide-wide {
      display: none;
    }
    /* The log's rows take up the rail's slack, so no dead gap opens above the question. */
    .log {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      max-height: 22.5rem; /* five 4rem rows and their gaps; past that, the gap is fine */
      margin-top: 1.5rem;
    }
    .log > :global(ol) {
      flex: 1 1 auto;
    }
    .controls {
      margin-top: auto;
      padding-top: 1.5rem;
      padding-bottom: 0;
    }
  }
  @media (min-width: 1280px) {
    .game {
      grid-template-columns: minmax(0, 1fr) 26rem;
    }
  }
  /* Short laptops: smaller call buttons, and below ~740px the rail swaps the log for the pips,
	   so the whole game still fits above the fold. */
  @media (min-width: 1024px) and (max-height: 840px) {
    .calls :global(.call) {
      --btn-h: 64px;
    }
    .log {
      margin-top: 1rem;
    }
  }
  @media (min-width: 1024px) and (max-height: 740px) {
    .hide-wide {
      display: block;
    }
    .log {
      display: none;
    }
  }
  @media (min-width: 1024px) and (pointer: fine) {
    .key {
      display: inline-grid;
      place-items: center;
      min-width: 1.5rem;
      height: 1.5rem;
      margin-left: 0.25rem;
      background: color-mix(in srgb, currentColor 12%, transparent);
      font: inherit;
      font-size: 0.875rem;
      line-height: 1;
    }
  }
</style>
