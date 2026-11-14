<script lang="ts">
	import { cn, type WithElementRef } from '#lib/utils.js';
	import type { HTMLInputAttributes, HTMLInputTypeAttribute } from 'svelte/elements';

	/**
	 * Bare input with the same look as the filled `TextField` (56px, rounded-lg, surface-container-
	 * highest, 2px `primary` ring when focused, `error` ring when `aria-invalid`), for use with a
	 * separate `Label` above it.
	 * Prefer `TextField` (#lib/components/ui/text-field) for forms: it has the floating label,
	 * supporting text, error state and icons built in.
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
			'block h-14 w-full min-w-0 rounded-m3-lg bg-surface-container-highest px-4 type-body-lg text-on-surface caret-m3-primary outline-none',
			'hover:bg-[color-mix(in_srgb,var(--md-sys-color-on-surface)_8%,var(--md-sys-color-surface-container-highest))]',
			'focus-visible:shadow-[inset_0_0_0_2px_var(--md-sys-color-primary)]',
			'[transition:box-shadow_var(--md-sys-motion-spring-fast-effects-duration)_var(--md-sys-motion-spring-fast-effects-easing),background-color_var(--md-sys-motion-spring-fast-effects-duration)_var(--md-sys-motion-spring-fast-effects-easing)]',
			'placeholder:text-on-surface-variant',
			'aria-invalid:caret-error aria-invalid:shadow-[inset_0_0_0_1px_var(--md-sys-color-error)] aria-invalid:focus-visible:shadow-[inset_0_0_0_2px_var(--md-sys-color-error)]',
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
