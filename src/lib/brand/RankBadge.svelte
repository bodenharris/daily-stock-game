<script lang="ts">
  import type { PackRankKey } from '#lib/game/rank.ts';
  import { RANK_BADGES, spriteRuns } from './sprite.ts';

  /**
   * The pixel badge for a Wolf Pack Rank: a paw (Pup), compass (Scout), watchful shield
   * (Sentinel), arrow (Hunter), moon (Elder) or crown (Alpha), at 2px a sprite pixel.
   * Decorative: it always sits next to the rank's name, so screen readers skip it.
   */
  let { rank }: { rank: PackRankKey } = $props();

  const runs = $derived(spriteRuns(RANK_BADGES[rank]));
</script>

<svg viewBox="0 0 16 16" width="32" height="32" shape-rendering="crispEdges" aria-hidden="true">
  {#each runs as r (`${r.x},${r.y}`)}
    <rect x={r.x} y={r.y} width={r.w} height="1" fill={r.fill} />
  {/each}
</svg>

<style>
  svg {
    display: block;
    flex-shrink: 0;
  }
</style>
