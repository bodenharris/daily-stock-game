<script lang="ts" module>
	import { tv, type VariantProps } from 'tailwind-variants';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import type { WithElementRef } from '#lib/utils.js';

	/*
	 * A square button holding one lucide icon (sized here, so no classes on the icon). Always
	 * give it an `aria-label`. `tonal` wears the pixel panel (layout.css). With `toggle` it is a
	 * toggle button: `pressed` (bindable) lights the icon in the primary colour.
	 */

	// 48px minimum touch target around the 32 and 40px sizes.
	const TARGET =
		"after:absolute after:top-1/2 after:left-1/2 after:size-full after:min-h-12 after:min-w-12 after:-translate-1/2 after:content-['']";

	const iconButtonVariants = tv({
		base: [
			`state-layer inline-flex shrink-0 cursor-pointer items-center justify-center p-0 align-middle select-none ${TARGET}`,
			'transition-[background-color,color] duration-(--md-sys-motion-spring-default-effects-duration) ease-(--md-sys-motion-spring-default-effects-easing)',
			'[&_svg]:pointer-events-none [&_svg]:shrink-0',
			'disabled:pointer-events-none disabled:cursor-default disabled:text-on-surface/38 aria-disabled:pointer-events-none aria-disabled:cursor-default aria-disabled:text-on-surface/38'
		],
		variants: {
			variant: {
				standard: 'bg-transparent text-on-surface-variant',
				tonal:
					'pixel-panel bg-secondary-container text-on-secondary-container disabled:bg-on-surface/10 aria-disabled:bg-on-surface/10'
			},
			size: {
				xs: 'size-8 [&_svg]:size-5',
				sm: 'size-10 [&_svg]:size-6'
			}
		},
		defaultVariants: { variant: 'standard', size: 'sm' }
	});

	type IconButtonProps = WithElementRef<HTMLButtonAttributes> &
		WithElementRef<HTMLAnchorAttributes> &
		VariantProps<typeof iconButtonVariants> & {
			/** A toggle button: clicking flips `pressed`. */
			toggle?: boolean;
			pressed?: boolean;
		};
</script>

<script lang="ts">
	import { cn } from '#lib/utils.js';

	let {
		class: className,
		variant,
		size,
		toggle = false,
		pressed = $bindable(false),
		ref = $bindable(null),
		href,
		type = 'button',
		disabled,
		onclick,
		children,
		...restProps
	}: IconButtonProps = $props();

	const classes = $derived(
		cn(iconButtonVariants({ variant, size }), toggle && pressed && 'text-m3-primary', className)
	);
</script>

{#if href}
	<a
		bind:this={ref}
		data-slot="icon-button"
		class={classes}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		role={disabled ? 'link' : undefined}
		tabindex={disabled ? -1 : undefined}
		{onclick}
		{...restProps}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		bind:this={ref}
		data-slot="icon-button"
		class={classes}
		aria-pressed={toggle ? pressed : undefined}
		{type}
		{disabled}
		onclick={(e) => {
			onclick?.(e);
			if (toggle && !e.defaultPrevented) pressed = !pressed;
		}}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
