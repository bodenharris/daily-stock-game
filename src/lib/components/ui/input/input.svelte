<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '#lib/utils.js';

	/**
	 * The arcade field: a square 48px well with a hard 2px edge (outline, brighter on hover,
	 * `primary` when focused, `error` when `aria-invalid`), state changes instant. Pair it with a
	 * `Label` above it.
	 */
	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		...restProps
	}: WithElementRef<Omit<HTMLInputAttributes, 'value'>> & {
		value?: string | number | null;
	} = $props();
</script>

<input
	bind:this={ref}
	bind:value
	data-slot="input"
	class={cn(
		'block h-12 w-full min-w-0 rounded-none bg-surface-container-lowest px-3 type-body-lg text-on-surface caret-m3-primary outline-none',
		'shadow-[inset_0_0_0_2px_var(--md-sys-color-outline)] hover:shadow-[inset_0_0_0_2px_var(--md-sys-color-on-surface-variant)]',
		'focus-visible:shadow-[inset_0_0_0_2px_var(--md-sys-color-primary)]',
		'placeholder:text-on-surface-variant',
		'aria-invalid:caret-error aria-invalid:shadow-[inset_0_0_0_2px_var(--md-sys-color-error)]',
		'disabled:pointer-events-none disabled:bg-on-surface/4 disabled:text-on-surface/38',
		className
	)}
	{...restProps}
/>

<style>
	/* Autofill: keep the dark well and light text instead of the browser's blue-grey fill (a
	   wide inset shadow paints over it), with the same 2px edge for each state. */
	input:is(:autofill, :-webkit-autofill) {
		-webkit-text-fill-color: var(--md-sys-color-on-surface);
		box-shadow:
			inset 0 0 0 2px var(--md-sys-color-outline),
			inset 0 0 0 100vmax var(--md-sys-color-surface-container-lowest);
	}
	input:is(:autofill, :-webkit-autofill):focus-visible {
		box-shadow:
			inset 0 0 0 2px var(--md-sys-color-primary),
			inset 0 0 0 100vmax var(--md-sys-color-surface-container-lowest);
	}
	input:is(:autofill, :-webkit-autofill)[aria-invalid='true'] {
		box-shadow:
			inset 0 0 0 2px var(--md-sys-color-error),
			inset 0 0 0 100vmax var(--md-sys-color-surface-container-lowest);
	}
</style>
