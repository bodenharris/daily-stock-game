<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import { cn } from '#lib/utils.js';

  /*
   * A centred dialog on a 50% scrim: surface-container-high with a hard 2px outline and drop.
   * Enter: fade on default-effects and scale 0.8 to 1 on default-spatial. Exit: fade and scale
   * to 0.9 on fast-effects.
   */
  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: DialogPrimitive.ContentProps = $props();
</script>

<DialogPrimitive.Portal>
  <DialogPrimitive.Overlay
    data-slot="dialog-overlay"
    class="fixed inset-0 isolate z-50 bg-black/50 [transition:opacity_var(--md-sys-motion-spring-default-effects-duration)_var(--md-sys-motion-spring-default-effects-easing)] data-ending-style:opacity-0 data-ending-style:[transition:opacity_var(--md-sys-motion-spring-fast-effects-duration)_var(--md-sys-motion-spring-fast-effects-easing)] data-starting-style:opacity-0"
  />
  <DialogPrimitive.Content
    bind:ref
    data-slot="dialog-content"
    class={cn(
      'fixed inset-0 z-50 m-auto flex h-fit max-h-[calc(100%-160px)] w-fit max-w-[min(560px,calc(100%-48px))] min-w-[min(280px,calc(100%-32px))] flex-col gap-4 bg-surface-container-high p-6 text-on-surface shadow-[0_0_0_2px_var(--md-sys-color-outline),0_8px_0_2px_var(--md-sys-color-shadow)] outline-none',
      '[transition:scale_var(--md-sys-motion-spring-default-spatial-duration)_var(--md-sys-motion-spring-default-spatial-easing),opacity_var(--md-sys-motion-spring-default-effects-duration)_var(--md-sys-motion-spring-default-effects-easing)]',
      'data-starting-style:scale-80 data-starting-style:opacity-0',
      'data-ending-style:scale-90 data-ending-style:opacity-0 data-ending-style:[transition:scale_var(--md-sys-motion-spring-fast-effects-duration)_var(--md-sys-motion-spring-fast-effects-easing),opacity_var(--md-sys-motion-spring-fast-effects-duration)_var(--md-sys-motion-spring-fast-effects-easing)]',
      className,
    )}
    {...restProps}
  />
</DialogPrimitive.Portal>
