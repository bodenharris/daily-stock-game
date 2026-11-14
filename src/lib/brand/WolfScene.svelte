<script lang="ts" module>
	/*
	 * The title-screen backdrop, drawn once at module load: a stepped dusk sky, stars, drifting
	 * clouds and a city skyline with lit windows. One scene unit = PX css pixels, always whole,
	 * so the pixels stay square at every width (the scene is cropped, never stretched).
	 */
	const PX = 3;
	const W = 640; // 1920px: wide enough for any screen, centred
	const H = 64;

	// Deterministic so server and client draw the same city.
	let seed = 20240917;
	function rand() {
		seed = (seed * 1664525 + 1013904223) % 4294967296;
		return seed / 4294967296;
	}

	const SKY = ['#0b1430', '#141a44', '#221c55', '#361f63', '#52226b', '#7a2a72', '#a83a78'];
	const band = Math.ceil(H / SKY.length);

	const stars = Array.from({ length: 70 }, () => ({
		x: Math.floor(rand() * W),
		y: Math.floor(rand() * 26),
		bright: rand() > 0.75
	}));

	type Cloud = { x: number; y: number; rows: [number, number][] };
	function cloud(x: number, y: number, w: number): Cloud {
		// stacked rows, each [offset, width]: a flat-bottomed pixel cloud
		return {
			x,
			y,
			rows: [
				[Math.floor(w * 0.3), Math.floor(w * 0.35)],
				[Math.floor(w * 0.12), Math.floor(w * 0.75)],
				[0, w]
			]
		};
	}
	const clouds = [
		cloud(250, 14, 26),
		cloud(372, 9, 20),
		cloud(150, 20, 18),
		cloud(470, 18, 30),
		cloud(40, 11, 22),
		cloud(560, 8, 16)
	];

	type Building = {
		x: number;
		w: number;
		h: number;
		tone: string;
		windows: { x: number; y: number }[];
		spire: boolean;
	};
	const buildings: Building[] = [];
	for (let x = -2; x < W;) {
		const w = 8 + Math.floor(rand() * 16);
		const h = 9 + Math.floor(rand() * 20);
		const windows: { x: number; y: number }[] = [];
		for (let wy = H - h + 3; wy < H - 2; wy += 3) {
			for (let wx = x + 2; wx < x + w - 2; wx += 3) {
				if (rand() > 0.62) windows.push({ x: wx, y: wy });
			}
		}
		buildings.push({
			x,
			w,
			h,
			tone: rand() > 0.5 ? '#0d1530' : '#111a3a',
			windows,
			spire: h > 24 && rand() > 0.4
		});
		x += w + (rand() > 0.7 ? 1 : 0);
	}
	// a second, darker row in front so the skyline has depth
	const front: { x: number; w: number; h: number }[] = [];
	for (let x = 0; x < W;) {
		const w = 14 + Math.floor(rand() * 22);
		front.push({ x, w, h: 3 + Math.floor(rand() * 6) });
		x += w;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import Wolf from './Wolf.svelte';

	/** `children`: the title block. `actions`: buttons pinned top right. */
	let { children, actions }: { children: Snippet; actions?: Snippet } = $props();
</script>

<header class="scene">
	<svg
		class="backdrop pixel-art"
		viewBox="0 0 {W} {H}"
		width={W * PX}
		height={H * PX}
		shape-rendering="crispEdges"
		aria-hidden="true"
	>
		{#each SKY as fill, i (fill)}
			<rect x="0" y={i * band} width={W} height={band} {fill} />
		{/each}
		{#each stars as s, i (i)}
			<rect class={['star', s.bright && 'bright']} x={s.x} y={s.y} width="1" height="1" />
		{/each}
		<g class="clouds">
			{#each clouds as c, i (i)}
				{#each c.rows as [off, w], r (r)}
					<rect x={c.x + off} y={c.y + r} width={w} height="1" fill="#4a2f7a" />
				{/each}
				<rect
					x={c.x + 1}
					y={c.y + c.rows.length}
					width={c.rows[2][1] - 2}
					height="1"
					fill="#2f2160"
				/>
			{/each}
		</g>
		{#each buildings as b, i (i)}
			<rect x={b.x} y={H - b.h} width={b.w} height={b.h} fill={b.tone} />
			<rect x={b.x} y={H - b.h} width={b.w} height="1" fill="#1d2a55" />
			{#if b.spire}
				<rect x={b.x + Math.floor(b.w / 2)} y={H - b.h - 5} width="1" height="5" fill="#1d2a55" />
				<rect class="beacon" x={b.x + Math.floor(b.w / 2)} y={H - b.h - 6} width="1" height="1" />
			{/if}
			{#each b.windows as w, j (j)}
				<rect
					x={w.x}
					y={w.y}
					width="1"
					height="1"
					fill={j % 5 === 0 ? '#4de3ff' : '#ffd23f'}
					opacity={j % 3 === 0 ? 0.55 : 0.9}
				/>
			{/each}
		{/each}
		{#each front as f, i (i)}
			<rect x={f.x} y={H - f.h} width={f.w} height={f.h} fill="#070d1f" />
		{/each}
	</svg>

	<div class="inner">
		<div class="hero">
			<svg
				class="moon pixel-art"
				viewBox="0 0 15 15"
				shape-rendering="crispEdges"
				aria-hidden="true"
			>
				<path
					fill="#fff2c4"
					d="M5 0h5v1h2v1h1v2h1v1h1v5h-1v1h-1v2h-1v1h-2v1H5v-1H3v-1H2v-2H1v-1H0V5h1V4h1V2h1V1h2z"
				/>
				<path fill="#f0dc96" d="M4 4h2v2H4zM9 8h3v2H9zM5 10h1v1H5z" />
			</svg>
			<Wolf scale={PX} class="wolf" />
		</div>
		<div class="title">
			{@render children()}
		</div>
		{#if actions}
			<div class="actions">{@render actions()}</div>
		{/if}
	</div>
</header>

<style>
	.scene {
		position: relative;
		height: 192px;
		overflow: hidden;
		background: #0b1430;
		/* the street line where the sky meets the game */
		border-bottom: 3px solid var(--pixel-ink);
		box-shadow:
			0 3px 0 0 color-mix(in srgb, var(--md-sys-color-primary) 70%, transparent),
			0 6px 18px 0 color-mix(in srgb, var(--md-sys-color-primary) 25%, transparent);
	}
	.backdrop {
		position: absolute;
		bottom: 0;
		left: 50%;
		translate: -50% 0;
		max-width: none;
	}
	.star {
		fill: #9fb2d3;
		opacity: 0.6;
	}
	.star.bright {
		fill: #e8f1ff;
		opacity: 1;
		animation: twinkle 2.4s steps(1, end) infinite;
	}
	.beacon {
		fill: #ff5d8f;
		animation: twinkle 1.6s steps(1, end) infinite;
	}
	@keyframes twinkle {
		50% {
			opacity: 0.2;
		}
	}
	.clouds {
		animation: drift 60s steps(60, end) infinite alternate;
	}
	@keyframes drift {
		to {
			transform: translateX(20px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.star.bright,
		.beacon,
		.clouds {
			animation: none;
		}
	}

	.inner {
		position: relative;
		height: 100%;
		margin-inline: auto;
		width: 100%;
		max-width: 28rem;
		padding-inline: 1rem;
		padding-top: env(safe-area-inset-top);
	}
	.hero {
		position: absolute;
		bottom: 0;
		left: 0.75rem;
	}
	.moon {
		position: absolute;
		/* up and to the right of his ears: the moon he would howl at, if he weren't at work */
		width: 45px;
		height: 45px;
		left: calc(100% + 6px);
		top: -36px;
		filter: drop-shadow(0 0 14px rgb(255 242 196 / 0.45));
	}
	.hero :global(.wolf) {
		position: relative;
		filter: drop-shadow(3px 0 0 var(--pixel-ink)) drop-shadow(-3px 0 0 var(--pixel-ink));
	}
	.title {
		position: absolute;
		inset: 3rem 0.5rem auto 6.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.25rem;
	}
	.actions {
		position: absolute;
		top: calc(0.5rem + env(safe-area-inset-top));
		right: 0.75rem;
		display: flex;
		gap: 0.5rem;
	}
	@media (min-width: 768px) {
		.scene {
			height: 224px;
		}
		.inner {
			max-width: 42rem;
			padding-inline: 1.5rem;
		}
		.title {
			inset: 3.5rem 0 auto 0;
		}
		.hero {
			left: 1.5rem;
		}
	}
	@media (min-width: 1024px) {
		.inner {
			max-width: 80rem;
			padding-inline: 2rem;
		}
		.hero {
			left: 4rem;
		}
	}
	/* Short phones: the game needs the height more than the sky does. */
	@media (max-height: 700px) and (max-width: 767px) {
		.scene {
			height: 164px;
		}
		.title {
			top: 2.75rem;
		}
	}
</style>
