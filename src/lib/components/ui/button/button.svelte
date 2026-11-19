<script lang="ts" module>
	import { tv, type VariantProps } from 'tailwind-variants';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import type { WithElementRef } from '#lib/utils.js';

	/*
	 * The arcade button: capitals with tracking, a flat state layer and an instant one-step
	 * press. `filled` (primary actions) wears the cabinet frame and `tonal` the panel, both of
	 * which sink into their drop instead (`.pixel-frame` / `.pixel-panel` in layout.css); give
	 * them 6px of room (12px below). `text` is unframed.
	 *
	 * Sizes are CSS variables, so a caller can re-size one without fighting class order:
	 * --btn-h (height), --btn-px (side padding), --btn-gap (icon to label), --btn-icon.
	 */

	// 48px minimum touch target around the 40px size.
	const TARGET =
		"after:absolute after:top-1/2 after:left-1/2 after:size-full after:min-h-12 after:min-w-12 after:-translate-1/2 after:content-['']";
	const DISABLED_FILL =
		'disabled:bg-on-surface/10 disabled:text-on-surface/38 aria-disabled:bg-on-surface/10 aria-disabled:text-on-surface/38';

	const buttonVariants = tv({
		base: [
			'state-layer inline-flex shrink-0 cursor-pointer items-center justify-center align-middle whitespace-nowrap no-underline select-none',
			'uppercase tracking-[0.12em] active:translate-y-0.5',
			'h-(--btn-h) gap-(--btn-gap) px-(--btn-px)',
			// colours ease; the press (translate, a framed button's drop) is instant
			'transition-[background-color,color] duration-(--md-sys-motion-spring-default-effects-duration) ease-(--md-sys-motion-spring-default-effects-easing)',
			'[&_svg]:pointer-events-none [&_svg]:size-(--btn-icon) [&_svg]:shrink-0',
			'disabled:pointer-events-none disabled:cursor-default aria-disabled:pointer-events-none aria-disabled:cursor-default'
		],
		variants: {
			variant: {
				filled: `pixel-frame bg-m3-primary text-on-primary ${DISABLED_FILL}`,
				tonal: `pixel-panel bg-secondary-container text-on-secondary-container ${DISABLED_FILL}`,
				text: 'bg-transparent text-m3-primary disabled:text-on-surface/38 aria-disabled:text-on-surface/38'
			},
			size: {
				sm: `[--btn-h:40px] [--btn-px:16px] [--btn-gap:8px] [--btn-icon:20px] type-label-lg ${TARGET}`,
				md: '[--btn-h:56px] [--btn-px:24px] [--btn-gap:8px] [--btn-icon:24px] type-title-md',
				/** The Up / Down calls. */
				hero: '[--btn-h:80px] [--btn-px:20px] [--btn-gap:10px] [--btn-icon:28px] type-headline-sm-emphasized'
			}
		},
		defaultVariants: { variant: 'filled', size: 'sm' }
	});

	type ButtonProps = WithElementRef<HTMLButtonAttributes> &
		WithElementRef<HTMLAnchorAttributes> &
		VariantProps<typeof buttonVariants>;
</script>

<script lang="ts">
	import { cn } from '#lib/utils.js';

	let {
		class: className,
		variant,
		size,
		ref = $bindable(null),
		href,
		type = 'button',
		disabled,
		children,
		...restProps
	}: ButtonProps = $props();
</script>

{#if href}
	<a
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		role={disabled ? 'link' : undefined}
		tabindex={disabled ? -1 : undefined}
		{...restProps}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		{type}
		{disabled}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
