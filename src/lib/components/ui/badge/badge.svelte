<script lang="ts" module>
	import { type VariantProps, tv } from 'tailwind-variants';

	/**
	 * A small pill label for facts, not actions: "#142", "Day 7 streak", "+12%", "62% called Up".
	 * (M3's own "badge" is the notification dot; this is closer to a non-interactive assist chip.)
	 * Full-round, tonal fills, emphasized label, tabular figures. Never put a focusable inside it.
	 */
	export const badgeVariants = tv({
		base: 'inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-m3-full whitespace-nowrap tabular-nums select-none [&_svg]:pointer-events-none [&_svg]:shrink-0',
		variants: {
			variant: {
				/** secondary-container: the default, quiet fact */
				tonal: 'bg-secondary-container text-on-secondary-container',
				/** primary-container: the brand fact (puzzle number, streak) */
				primary: 'bg-primary-container text-on-primary-container',
				up: 'bg-up-container text-on-up-container',
				down: 'bg-down-container text-on-down-container',
				/** on the page surface with a hairline: for low-priority metadata */
				outline:
					'bg-transparent text-on-surface-variant shadow-[inset_0_0_0_1px_var(--md-sys-color-outline-variant)]',
				/** inverse-surface: high emphasis on any background (e.g. over the chart) */
				inverse: 'bg-inverse-surface text-inverse-on-surface',
				// shadcn compatibility aliases
				default: 'bg-primary-container text-on-primary-container',
				secondary: 'bg-secondary-container text-on-secondary-container',
				destructive: 'bg-error-container text-on-error-container',
				ghost: 'bg-transparent text-on-surface-variant',
				link: 'bg-transparent text-m3-primary underline-offset-4 hover:underline'
			},
			size: {
				sm: 'h-6 px-2.5 type-label-md-emphasized [&_svg]:size-3.5',
				md: 'h-8 px-3 type-label-lg-emphasized [&_svg]:size-4'
			}
		},
		defaultVariants: { variant: 'tonal', size: 'sm' }
	});

	export type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];
	export type BadgeSize = VariantProps<typeof badgeVariants>['size'];
</script>

<script lang="ts">
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '#lib/utils.js';

	let {
		ref = $bindable(null),
		href,
		class: className,
		variant = 'tonal',
		size = 'sm',
		children,
		...restProps
	}: WithElementRef<HTMLAnchorAttributes> & {
		variant?: BadgeVariant;
		size?: BadgeSize;
	} = $props();
</script>

<svelte:element
	this={href ? 'a' : 'span'}
	bind:this={ref}
	data-slot="badge"
	data-variant={variant}
	{href}
	class={cn(badgeVariants({ variant, size }), className)}
	{...restProps}
>
	{@render children?.()}
</svelte:element>
