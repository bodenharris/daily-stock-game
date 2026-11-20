<script lang="ts">
  import { Drawer as DrawerPrimitive } from 'vaul-svelte';
  import { cn } from '#lib/utils.js';

  /*
   * A bottom sheet on a 50% scrim, as a pixel panel: surface-container-low with a hard 2px
   * outline edge on top over an ink keyline, square corners, at most 640px wide and centred,
   * 72px clear of the top (56px on windows wider than 640px). Drag handle: a 32 × 8px block
   * with 18px above and below (a 48px touch area).
   */
  let {
    ref = $bindable(null),
    class: className,
    onOpenAutoFocus,
    children,
    ...restProps
  }: DrawerPrimitive.ContentProps = $props();
</script>

<DrawerPrimitive.Portal>
  <DrawerPrimitive.Overlay data-slot="drawer-overlay" class="fixed inset-0 z-50 bg-black/50" />
  <DrawerPrimitive.Content
    bind:ref
    data-slot="drawer-content"
    class={cn(
      'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[calc(100%-72px)] w-full max-w-[640px] flex-col border-t-2 border-outline bg-surface-container-low text-on-surface shadow-[0_-2px_0_0_var(--pixel-ink)] outline-none min-[640px]:max-h-[calc(100%-56px)]',
      // the spring overshoots a little: extend the surface below the bottom edge
      "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-[200%] after:bg-inherit after:content-['']",
      className,
    )}
    onOpenAutoFocus={(e) => {
      onOpenAutoFocus?.(e);
      if (e.defaultPrevented) return;
      // Focus the sheet itself, not its first control (which could pop a soft keyboard);
      // vaul would otherwise leave focus on the trigger, outside the focus trap. `ref` is
      // bound after the focus scope mounts, so wait a frame.
      e.preventDefault();
      requestAnimationFrame(() => {
        if (ref?.isConnected && !ref.contains(document.activeElement))
          ref.focus({ preventScroll: true });
      });
    }}
    {...restProps}
  >
    <DrawerPrimitive.Handle
      class="my-[18px]! h-2! w-8! shrink-0 rounded-none! bg-outline! opacity-100! [&>[data-vaul-handle-hitarea]]:h-12! [&>[data-vaul-handle-hitarea]]:w-12!"
    />
    {@render children?.()}
  </DrawerPrimitive.Content>
</DrawerPrimitive.Portal>

<style>
  /* vaul animates with its own 0.5s cubic-bezier, written inline on release and snap (and
	   `transition: none` while dragging); only the timing is swapped for the M3 springs here, so
	   dragging still follows the pointer 1:1. */
  :global([data-slot='drawer-content'][data-vaul-drawer]) {
    transition-duration: var(--md-sys-motion-spring-default-spatial-duration) !important;
    transition-timing-function: var(--md-sys-motion-spring-default-spatial-easing) !important;
    animation-duration: var(--md-sys-motion-spring-default-spatial-duration);
    animation-timing-function: var(--md-sys-motion-spring-default-spatial-easing);
  }
  :global([data-slot='drawer-content'][data-vaul-drawer][data-state='closed']) {
    transition-duration: var(--md-sys-motion-spring-fast-effects-duration) !important;
    transition-timing-function: var(--md-sys-motion-spring-fast-effects-easing) !important;
    animation-duration: var(--md-sys-motion-spring-fast-effects-duration);
    animation-timing-function: var(--md-sys-motion-spring-fast-effects-easing);
  }
  :global([data-slot='drawer-overlay'][data-vaul-overlay]) {
    transition-duration: var(--md-sys-motion-spring-default-effects-duration) !important;
    transition-timing-function: var(--md-sys-motion-spring-default-effects-easing) !important;
    animation-duration: var(--md-sys-motion-spring-default-effects-duration);
    animation-timing-function: var(--md-sys-motion-spring-default-effects-easing);
  }
  :global([data-slot='drawer-overlay'][data-vaul-overlay][data-state='closed']) {
    animation-duration: var(--md-sys-motion-spring-fast-effects-duration);
    animation-timing-function: var(--md-sys-motion-spring-fast-effects-easing);
  }
</style>
