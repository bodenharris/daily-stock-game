<script lang="ts">
	import { cn, type WithElementRef } from '#lib/utils.js';
	import type { HTMLInputAttributes, HTMLInputTypeAttribute } from 'svelte/elements';

	/**
	 * The arcade field: a square 48px well with a hard 2px edge (outline, brighter on hover,
	 * `primary` when focused, `error` when `aria-invalid`), state changes instant. Pair it with a
	 * `Label` above it; this is the field the game's forms use.
	 */
	type InputType = Exclude<HTMLInputTypeAttribute, 'file'>;

	type Props = WithElementRef<
		Omit<HTMLInputAttributes, 'type'> &
			({ type: 'file'; files?: FileList } | { type?: InputType; files?: undefined })
	>;

	let {
		ref = $bindable(null),
		value = $bindable(),
		type,
		files = $bindable(),
		class: className,
		'data-slot': dataSlot = 'input',
		...restProps
	}: Props = $props();

	const classes = $derived(
		cn(
			'block h-12 w-full min-w-0 rounded-none bg-surface-container-lowest px-3 type-body-lg text-on-surface caret-m3-primary outline-none',
			'shadow-[inset_0_0_0_2px_var(--md-sys-color-outline)] hover:shadow-[inset_0_0_0_2px_var(--md-sys-color-on-surface-variant)]',
			'focus-visible:shadow-[inset_0_0_0_2px_var(--md-sys-color-primary)]',
			'placeholder:text-on-surface-variant',
			'aria-invalid:caret-error aria-invalid:shadow-[inset_0_0_0_2px_var(--md-sys-color-error)]',
			'disabled:pointer-events-none disabled:bg-on-surface/4 disabled:text-on-surface/38',
			'file:me-3 file:h-full file:border-0 file:bg-transparent file:type-label-lg file:text-m3-primary',
			className
		)
	);
</script>

{#if type === 'file'}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(classes, 'py-0 ps-0')}
		type="file"
		bind:files
		bind:value
		{...restProps}
	/>
{:else}
	<input bind:this={ref} data-slot={dataSlot} class={classes} {type} bind:value {...restProps} />
{/if}

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
