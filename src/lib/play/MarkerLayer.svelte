<script lang="ts">
  import { curveCatmullRom, line } from 'd3-shape';
  import type { ChartPoint } from './layout.ts';
  import type { Marker } from './marker.svelte.ts';

  /**
   * The red marker's strokes over the chart. `toPx` and `fromPx` are the chart's live scale, so
   * when a call widens the chart's range the strokes ease along with the line instead of
   * staying where they were on screen.
   */
  let {
    marker,
    toPx,
    fromPx,
  }: {
    marker: Marker;
    toPx: (p: ChartPoint) => [number, number];
    fromPx: (px: [number, number]) => ChartPoint;
  } = $props();

  let width = $state(0);
  let height = $state(0);
  let drawing = false;
  let lastPx: [number, number] | null = null;

  const toPath = line().curve(curveCatmullRom.alpha(0.5));
  const paths = $derived(
    width > 0 && height > 0
      ? marker.strokes.map((s) => {
          const px = s.map(toPx);
          // A tap leaves a dot: a zero-length segment that the round cap turns into one.
          return px.length === 1 ? `M${px[0][0]} ${px[0][1]}h0.01` : (toPath(px) ?? '');
        })
      : [],
  );

  /** A pointer position on the layer, in pixels and as a point on the chart. */
  function at(e: PointerEvent, el: HTMLElement) {
    const r = el.getBoundingClientRect();
    const clamp = (v: number, max: number) => Math.min(max, Math.max(0, v));
    const px: [number, number] = [
      clamp(e.clientX - r.left, r.width),
      clamp(e.clientY - r.top, r.height),
    ];
    return { p: fromPx(px), px };
  }

  function down(e: PointerEvent & { currentTarget: HTMLDivElement }) {
    if (!marker.active || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing = true;
    const { p, px } = at(e, e.currentTarget);
    lastPx = px;
    marker.start(p);
  }

  function move(e: PointerEvent & { currentTarget: HTMLDivElement }) {
    if (!drawing) return;
    const points: ChartPoint[] = [];
    for (const ev of e.getCoalescedEvents?.() ?? [e]) {
      const { p, px } = at(ev, e.currentTarget);
      // Skip jitter under 2px: fewer points, same line.
      if (lastPx && Math.hypot(px[0] - lastPx[0], px[1] - lastPx[1]) < 2) continue;
      lastPx = px;
      points.push(p);
    }
    marker.extend(points);
  }

  function up() {
    if (!drawing) return;
    drawing = false;
    lastPx = null;
    marker.save();
  }
</script>

<svelte:window
  onkeydown={(e: KeyboardEvent) => {
    if (e.key === 'Escape') marker.active = false;
  }}
/>

<!-- Over the chart, under the ticker tape (and its marker buttons). Only takes the pointer in
     marker mode, so the chart reads as usual otherwise. -->
<div
  class={['layer', marker.active && 'active']}
  bind:clientWidth={width}
  bind:clientHeight={height}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  aria-hidden="true"
>
  {#if width > 0 && height > 0}
    <svg {width} {height} viewBox="0 0 {width} {height}">
      {#each paths as d, i (i)}
        <path {d} />
      {/each}
    </svg>
  {/if}
</div>

<style>
  .layer {
    --marker-red: #ff2d2d;
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
  }
  .layer.active {
    pointer-events: auto;
    touch-action: none; /* draw, don't scroll */
    cursor: crosshair;
    /* a faint red edge says "you're drawing now" */
    box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--marker-red) 55%, transparent);
  }
  svg {
    display: block;
    overflow: visible;
  }
  path {
    fill: none;
    stroke: var(--marker-red);
    stroke-width: 4;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.9;
    filter: drop-shadow(0 0 3px color-mix(in srgb, var(--marker-red) 60%, transparent));
  }
</style>
