<script lang="ts" module>
  import { WOLF, spriteRuns } from './sprite.ts';

  const runs = spriteRuns(WOLF);
  const width = WOLF.rows[0].length;
  const height = WOLF.rows.length;
</script>

<script lang="ts">
  /**
   * The mascot: a wolf on two legs in a navy suit and pink tie, drawn from `wolf.json`.
   * `scale` is CSS pixels per sprite pixel; keep it a whole number so every pixel stays square.
   * An empty `title` hides him from screen readers, for where he is decoration.
   */
  let {
    scale = 3,
    class: className = '',
    title = 'The Wolf, in a suit and tie',
  }: { scale?: number; class?: string; title?: string } = $props();
</script>

<svg
  class={['pixel-art wolf', className]}
  viewBox="0 0 {width} {height}"
  width={width * scale}
  height={height * scale}
  style:--px="{scale}px"
  shape-rendering="crispEdges"
  role={title ? 'img' : undefined}
  aria-label={title || undefined}
  aria-hidden={title ? undefined : 'true'}
>
  {#each runs as r, i (i)}
    <rect x={r.x} y={r.y} width={r.w} height="1" fill={r.fill} />
  {/each}
</svg>

<style>
  /* A two-frame idle bob, one sprite pixel, like a character waiting on a title screen. */
  .wolf {
    display: block;
    overflow: visible;
    animation: bob 1.2s steps(1, end) infinite;
  }
  @keyframes bob {
    50% {
      transform: translateY(var(--px));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .wolf {
      animation: none;
    }
  }
</style>
