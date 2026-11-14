<script lang="ts">
	import { ripple } from '#lib/m3/ripple.svelte.ts';
	import { dollars } from './money.ts';

	/**
	 * The stake chips: an M3 connected button group (small, tonal toggles) built on native radio
	 * inputs, so it needs no UI library on first paint and works with arrow keys for free.
	 * Selected chip: secondary fill, fully round. Others: secondary container, 8px inner corners.
	 */
	let {
		value = $bindable(),
		options,
		disabled = false
	}: {
		value: string;
		options: { value: string; percent: number; cents: number }[];
		disabled?: boolean;
	} = $props();
</script>

<div class="group" role="radiogroup" aria-label="Stake">
	{#each options as o (o.value)}
		<label class="chip" class:on={value === o.value} class:disabled {@attach ripple()}>
			<input
				type="radio"
				name="stake"
				value={o.value}
				bind:group={value}
				{disabled}
				aria-label="Bet {o.percent}%, {dollars(o.cents)}"
			/>
			<span class="type-label-lg type-numeric">{dollars(o.cents, { cents: false })}</span>
		</label>
	{/each}
</div>

<style>
	.group {
		display: flex;
		gap: 2px;
	}
	.chip {
		--h: 40px;
		--inner: var(--md-sys-shape-corner-small, 8px);
		--outer: calc(var(--h) / 2);
		position: relative;
		flex: 1 1 0;
		display: grid;
		place-items: center;
		height: var(--h);
		cursor: pointer;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
		background: var(--md-sys-color-secondary-container);
		color: var(--md-sys-color-on-secondary-container);
		border-radius: var(--inner);
		transition:
			border-radius var(--md-sys-motion-spring-fast-spatial-duration, 300ms)
				var(--md-sys-motion-spring-fast-spatial-easing, ease),
			background-color var(--md-sys-motion-spring-default-effects-duration, 200ms)
				var(--md-sys-motion-spring-default-effects-easing, ease),
			color var(--md-sys-motion-spring-default-effects-duration, 200ms)
				var(--md-sys-motion-spring-default-effects-easing, ease);
	}
	/* 48px touch target without changing the visual size. */
	.chip::after {
		content: '';
		position: absolute;
		inset: -4px 0;
	}
	.chip:first-child {
		border-start-start-radius: var(--outer);
		border-end-start-radius: var(--outer);
	}
	.chip:last-child {
		border-start-end-radius: var(--outer);
		border-end-end-radius: var(--outer);
	}
	.chip:active:not(.disabled) {
		--inner: var(--md-sys-shape-corner-extra-small, 4px);
	}
	.chip.on {
		border-radius: var(--outer);
		background: var(--md-sys-color-secondary);
		color: var(--md-sys-color-on-secondary);
	}
	.chip.disabled {
		cursor: default;
		opacity: 0.6;
	}
	input {
		position: absolute;
		inset: 0;
		opacity: 0;
		margin: 0;
		cursor: inherit;
	}
	.chip:has(input:focus-visible) {
		outline: 3px solid var(--md-sys-color-secondary);
		outline-offset: 2px;
	}
</style>
