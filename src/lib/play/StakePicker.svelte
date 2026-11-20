<script lang="ts">
  import { sound } from '#lib/audio/sound.svelte.ts';
  import { dollars } from './format.ts';

  /**
   * The stake chips: a connected row of toggles built on native radio inputs, so it needs no UI
   * library on first paint and works with arrow keys for free. Selected chip: primary fill.
   * Whole dollars only: the chips are a choice of size, not an invoice.
   */
  let {
    value = $bindable(),
    options,
    disabled = false,
  }: {
    /** The chosen stake, in percent of the balance. */
    value: number;
    options: { percent: number; cents: number }[];
    disabled?: boolean;
  } = $props();
</script>

<div class="group" role="radiogroup" aria-label="Stake">
  {#each options as o (o.percent)}
    <label class={['chip state-layer', value === o.percent && 'on', disabled && 'disabled']}>
      <input
        type="radio"
        name="stake"
        value={o.percent}
        bind:group={value}
        onchange={() => sound.play('select')}
        {disabled}
        aria-label="Bet {o.percent}%, {dollars(o.cents)}"
      />
      <span class="flex items-baseline gap-1.5">
        <span class="type-label-lg type-numeric lg:type-title-md">{dollars(o.cents)}</span>
        <span class="pct type-label-sm type-numeric">{o.percent}%</span>
      </span>
    </label>
  {/each}
</div>

<style>
  .group {
    display: flex;
    gap: 2px;
  }
  .chip {
    flex: 1 1 0;
    display: grid;
    place-items: center;
    min-height: 44px;
    cursor: pointer;
    user-select: none;
    background: var(--md-sys-color-surface-container-highest);
    color: var(--md-sys-color-on-surface);
    transition-property: background-color, color;
    transition-duration: var(--md-sys-motion-spring-default-effects-duration);
    transition-timing-function: var(--md-sys-motion-spring-default-effects-easing);
  }
  /* Small phones: a slimmer chip, with the touch target kept at 44px. */
  @media (max-width: 1023px) and (max-height: 620px) {
    .chip {
      min-height: 36px;
    }
    .chip::after {
      content: '';
      position: absolute;
      inset: -4px 0;
    }
  }
  /* An arcade key: it sinks the moment it's pressed, no easing. */
  .chip:active:not(.disabled) {
    translate: 0 2px;
  }
  .chip.on {
    background: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
  }
  .pct {
    opacity: 0.75;
    font-size: 0.75rem;
  }
  .chip.disabled {
    cursor: default;
    opacity: 0.6;
  }
  input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: inherit;
  }
  .chip:has(input:focus-visible) {
    outline: 3px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }
</style>
