<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { ToggleGroup as ToggleGroupPrimitive } from 'bits-ui';
	import { cn } from '#lib/utils.js';
	import { Button, buttonVariants, type ButtonVariant } from '#lib/components/ui/button/index.js';
	import { stateLayer } from '#lib/m3/ripple.svelte.js';
	import { getButtonGroupContext } from './context.js';

	/*
	 * A button inside a ButtonGroup. Size and shape come from the group. In a selecting group
	 * (`type="single" | "multiple"`) it is a bits-ui ToggleGroup item styled as an M3 toggle button;
	 * otherwise a plain Button. Put a lucide icon before the label if you want one.
	 */
	let {
		value = '',
		variant,
		disabled = false,
		class: className,
		children,
		...restProps
	}: Omit<HTMLButtonAttributes, 'value'> & {
		/** Item value for selecting groups. */
		value?: string;
		/** Color style; defaults to the group's `itemVariant`. */
		variant?: ButtonVariant;
	} = $props();

	const ctx = getButtonGroupContext();
	// attribute passthrough shared by the toggle-item / Button branches
	const rest = $derived(restProps as Record<string, unknown>);
	const color = $derived(variant ?? ctx.itemVariant);
</script>

{#if ctx.type}
	<ToggleGroupPrimitive.Item {value} {disabled} {...rest}>
		{#snippet child({ props, pressed })}
			<button
				{...props}
				data-slot="button"
				data-size={ctx.size}
				class={cn(
					buttonVariants({
						variant: color,
						size: ctx.size,
						shape: ctx.shape,
						toggle: true,
						selected: pressed
					}),
					className
				)}
				{@attach stateLayer()}
			>
				{@render children?.()}
			</button>
		{/snippet}
	</ToggleGroupPrimitive.Item>
{:else}
	<Button variant={color} size={ctx.size} shape={ctx.shape} class={className} {disabled} {...rest}>
		{@render children?.()}
	</Button>
{/if}
