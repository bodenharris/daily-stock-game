<script lang="ts">
	import { curveCatmullRom, line } from 'd3-shape';
	import type { Marker } from './marker.svelte.ts';

	let { marker }: { marker: Marker } = $props();

	let width = $state(0);
	let height = $state(0);
	let drawing = false;
	let lastPx: [number, number] | null = null;

	const toPath = $derived(
		line<[number, number]>()
			.x((p) => p[0] * width)
			.y((p) => p[1] * height)
			.curve(curveCatmullRom.alpha(0.5))
	);
	const paths = $derived(
		marker.strokes.map((s) =>
			// A tap leaves a dot: a zero-length segment that the round cap turns into one.
			s.length === 1 ? `M${s[0][0] * width} ${s[0][1] * height}h0.01` : (toPath(s) ?? '')
		)
	);

	const clamp = (v: number) => Math.min(1, Math.max(0, v));
	/** A pointer position as rounded shares of the layer (small to store, still smooth). */
	function at(e: PointerEvent, el: HTMLElement): { p: [number, number]; px: [number, number] } {
		const r = el.getBoundingClientRect();
		const px: [number, number] = [e.clientX - r.left, e.clientY - r.top];
		const round = (v: number) => Math.round(clamp(v) * 10_000) / 10_000;
		return { p: [round(px[0] / r.width), round(px[1] / r.height)], px };
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
		const points: [number, number][] = [];
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
		marker.end();
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && marker.active) marker.active = false;
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
	.layer {
		--marker-red: #ff2d2d;
	}
</style>
