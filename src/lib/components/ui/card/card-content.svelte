<script lang="ts">
	import { cn, type WithElementRef } from '#lib/utils.js';
	import { typeOr } from '#lib/m3/type.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="card-content"
	class={cn(
		'px-(--card-spacing) text-on-surface-variant',
		typeOr('type-body-md', className),
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
