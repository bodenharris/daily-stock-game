<script lang="ts">
	import { Label as LabelPrimitive } from 'bits-ui';
	import { cn } from '#lib/utils.js';

	// Field label above an `Input`: label-large, on-surface-variant; 38% when the control is disabled.
	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: LabelPrimitive.RootProps = $props();
</script>

<LabelPrimitive.Root
	bind:ref
	data-slot="label"
	class={cn(
		'flex items-center gap-2 type-label-lg text-on-surface-variant select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:text-on-surface/38 peer-disabled:cursor-default peer-disabled:text-on-surface/38',
		className
	)}
	{...restProps}
/>
