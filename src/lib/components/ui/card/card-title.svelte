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
	// Card headline: title-medium, on-surface (pass `class="type-title-lg"` for a larger heading).
</script>

<div
	bind:this={ref}
	data-slot="card-title"
	class={cn(typeOr('type-title-md', className), 'text-on-surface', className)}
	{...restProps}
>
	{@render children?.()}
</div>
