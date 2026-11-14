<script lang="ts">
	import { cn, type WithElementRef } from '#lib/utils.js';
	import { typeOr } from '#lib/m3/type.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLParagraphElement>> = $props();
</script>

<p
	bind:this={ref}
	data-slot="card-description"
	class={cn(typeOr('type-body-md', className), 'text-on-surface-variant', className)}
	{...restProps}
>
	{@render children?.()}
</p>
