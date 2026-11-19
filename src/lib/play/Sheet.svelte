<script lang="ts">
	import type { Snippet } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import X from '@lucide/svelte/icons/x';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Drawer from '#lib/components/ui/drawer/index.js';
	import { IconButton } from '#lib/components/ui/icon-button/index.js';

	/**
	 * A bottom sheet on phones, a centred dialog from tablet width up (M3: sheets for compact
	 * windows, dialogs for medium and wider). Same title, description and body either way.
	 */
	let {
		open = $bindable(false),
		title,
		description,
		children
	}: { open?: boolean; title: string; description?: string; children: Snippet } = $props();

	const wide = new MediaQuery('(min-width: 768px)', false);
</script>

{#if wide.current}
	<Dialog.Root bind:open>
		<Dialog.Content class="w-[min(440px,calc(100%-48px))]">
			<Dialog.Header class="gap-1 pe-10">
				<Dialog.Title class="type-headline-sm-emphasized">{title}</Dialog.Title>
				{#if description}<Dialog.Description>{description}</Dialog.Description>{/if}
			</Dialog.Header>
			<div>{@render children()}</div>
			<!-- No swipe-down on a dialog, so a visible way out besides Esc and the scrim. Last in
			     the DOM so focus starts on the form, drawn top right. -->
			<Dialog.Close>
				{#snippet child({ props })}
					<IconButton {...props} class="absolute end-3 top-3" aria-label="Close">
						<X />
					</IconButton>
				{/snippet}
			</Dialog.Close>
		</Dialog.Content>
	</Dialog.Root>
{:else}
	<Drawer.Root bind:open>
		<Drawer.Content>
			<div class="mx-auto w-full max-w-md px-6 pb-8">
				<Drawer.Header class="px-0">
					<Drawer.Title class="type-title-lg-emphasized">{title}</Drawer.Title>
					{#if description}<Drawer.Description>{description}</Drawer.Description>{/if}
				</Drawer.Header>
				{@render children()}
			</div>
		</Drawer.Content>
	</Drawer.Root>
{/if}
