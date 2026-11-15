<script lang="ts">
	import type { PackRankKey } from '#lib/game/rank.ts';
	import { RANK_BADGES, spriteRuns } from './sprite.ts';

	/**
	 * The pixel badge for a Wolf Pack Rank: a paw (Pup), compass (Scout), watchful shield
	 * (Sentinel), arrow (Hunter), moon (Elder) or crown (Alpha). Decorative next to the rank's
	 * name, so it is hidden from screen readers unless given a `title`.
	 * `scale` is CSS pixels per sprite pixel; keep it a whole number so every pixel stays square.
	 */
	let {
		rank,
		scale = 2,
		title,
		class: className = ''
	}: { rank: PackRankKey; scale?: number; title?: string; class?: string } = $props();

	const sprite = $derived(RANK_BADGES[rank]);
	const runs = $derived(spriteRuns(sprite));
	const size = 16;
</script>

<svg
	class={['badge', className]}
	viewBox="0 0 {size} {size}"
	width={size * scale}
	height={size * scale}
	shape-rendering="crispEdges"
	role={title ? 'img' : undefined}
	aria-label={title}
	aria-hidden={title ? undefined : 'true'}
>
	{#each runs as r (`${r.x},${r.y}`)}
		<rect x={r.x} y={r.y} width={r.w} height="1" fill={r.fill} />
	{/each}
</svg>

<style>
	.badge {
		display: block;
		flex-shrink: 0;
	}
</style>
