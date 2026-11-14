<script lang="ts">
	import { area, curveMonotoneX, line } from 'd3-shape';
	import { domainFor } from './layout.ts';

	let { values, tone = 'ink' }: { values: number[]; tone?: 'ink' | 'up' | 'down' } = $props();

	let width = $state(320);
	let height = $state(160);
	const pad = 6;

	const geo = $derived.by(() => {
		const [lo, hi] = domainFor(values, 0.08);
		const x = (i: number) => pad + (i / Math.max(1, values.length - 1)) * (width - pad * 2);
		const y = (v: number) => pad + (1 - (v - lo) / (hi - lo || 1)) * (height - pad * 2);
		const pts = values.map((v, i) => [i, v] as [number, number]);
		const l = line<[number, number]>()
			.x((p) => x(p[0]))
			.y((p) => y(p[1]))
			.curve(curveMonotoneX);
		const a = area<[number, number]>()
			.x((p) => x(p[0]))
			.y0(height)
			.y1((p) => y(p[1]))
			.curve(curveMonotoneX);
		return { line: l(pts) ?? '', area: a(pts) ?? '' };
	});
</script>

<div class="relative h-full w-full {tone}" bind:clientWidth={width} bind:clientHeight={height}>
	<svg {width} {height} viewBox="0 0 {width} {height}" aria-hidden="true">
		<path d={geo.area} class="fill" />
		<path d={geo.line} class="stroke" />
	</svg>
</div>

<style>
	div {
		--ink: var(--chart-line);
	}
	.up {
		--ink: var(--chart-up);
	}
	.down {
		--ink: var(--chart-down);
	}
	svg {
		position: absolute;
		inset: 0;
		display: block;
	}
	.stroke {
		fill: none;
		stroke: var(--ink);
		stroke-width: 2.25;
		stroke-linejoin: round;
		stroke-linecap: round;
		transition: stroke 300ms ease;
	}
	.fill {
		fill: var(--ink);
		opacity: 0.08;
	}
</style>
