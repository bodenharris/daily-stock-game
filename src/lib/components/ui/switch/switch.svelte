<script lang="ts">
	import { Switch as SwitchPrimitive } from 'bits-ui';
	import { cn, type WithoutChildrenOrChild } from '#lib/utils.js';

	/*
	 * The pixel switch: a square 52×32 track with an inked frame and a square thumb that grows
	 * and slides across when on. Off: dark track, outline thumb. On: primary track.
	 */
	let {
		ref = $bindable(null),
		class: className,
		checked = $bindable(false),
		...restProps
	}: WithoutChildrenOrChild<SwitchPrimitive.RootProps> = $props();
</script>

<SwitchPrimitive.Root
	bind:ref
	bind:checked
	data-slot="switch"
	class={cn(
		'relative inline-flex h-8 w-13 shrink-0 cursor-pointer items-center rounded-none outline-none',
		'bg-surface-container-highest shadow-[0_0_0_2px_var(--pixel-ink),0_0_0_4px_var(--md-sys-color-outline)]',
		'data-[state=checked]:bg-m3-primary data-[state=checked]:shadow-[0_0_0_2px_var(--pixel-ink),0_0_0_4px_var(--md-sys-color-primary)]',
		'transition-[background-color] duration-150',
		'focus-visible:outline-2 focus-visible:outline-offset-6 focus-visible:outline-m3-secondary',
		'after:absolute after:-inset-2 after:content-[""]',
		'data-disabled:cursor-not-allowed data-disabled:opacity-38',
		className
	)}
	{...restProps}
>
	<SwitchPrimitive.Thumb
		data-slot="switch-thumb"
		class="pointer-events-none block size-4 translate-x-2 rounded-none bg-outline transition-[translate,width,height,background-color] duration-150 data-[state=checked]:size-6 data-[state=checked]:translate-x-6 data-[state=checked]:bg-on-primary motion-reduce:transition-none"
	/>
</SwitchPrimitive.Root>
