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
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { IconButton } from '#lib/components/ui/icon-button/index.js';
	import Wolf from './Wolf.svelte';

	/**
	 * The home page's title screen: `children` is the title block, `actions` the buttons pinned
	 * top right. With `title` it is the compact strip for the inner pages instead: a back button
	 * (`back`), the page `title` with `children` as the line under it, and a smaller wolf;
	 * `maxWidth` lines it up with a page column wider than 42rem.
	 * Heights come from --scene-h / --scene-h-compact in layout.css, which other layouts size
	 * against.
	 */
	let {
		children,
		actions,
		title,
		back,
		maxWidth
	}: {
		children: Snippet;
		actions?: Snippet;
		title?: string;
		back?: { href: string; label: string };
		maxWidth?: string;
	} = $props();

	const compact = $derived(title != null);
</script>

<header class={['scene', compact && 'compact']} style:--scene-max={maxWidth}>
	<div class="sky crt">
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
	</div>

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
			<Wolf scale={compact ? 2 : PX} class="wolf" />
		</div>
		{#if compact}
			<div class="bar">
				{#if back}
					<IconButton
						class="pixel-panel"
						variant="tonal"
						size="sm"
						href={back.href}
						aria-label={back.label}
					>
						<ArrowLeft />
					</IconButton>
				{/if}
				<div class="title">
					<h1 class="page-title glitch-text font-pixel">{title}</h1>
					<p class="sub type-label-lg type-numeric">{@render children()}</p>
				</div>
			</div>
		{:else}
			<div class="title">{@render children()}</div>
		{/if}
		{#if actions}
			<div class="actions">{@render actions()}</div>
		{/if}
	</div>
</header>

<style>
	.scene {
		position: relative;
		height: var(--scene-h);
		overflow: hidden;
		background: #0b1430;
		/* the street line where the sky meets the game */
		border-bottom: 3px solid var(--pixel-ink);
		box-shadow:
			0 3px 0 0 color-mix(in srgb, var(--md-sys-color-primary) 70%, transparent),
			0 6px 18px 0 color-mix(in srgb, var(--md-sys-color-primary) 25%, transparent);
	}
	.scene.compact {
		height: var(--scene-h-compact);
	}
	.sky {
		position: absolute;
		inset: 0;
		overflow: hidden;
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
		padding-top: env(safe-area-inset-top);
	}
	.hero {
		position: absolute;
		bottom: 0;
		left: max(0.75rem, env(safe-area-inset-left));
	}
	.hero :global(.wolf) {
		position: relative;
		filter: drop-shadow(3px 0 0 var(--pixel-ink)) drop-shadow(-3px 0 0 var(--pixel-ink));
	}
	.moon {
		position: absolute;
		width: 45px;
		height: 45px;
		filter: drop-shadow(0 0 14px rgb(255 242 196 / 0.45));
		/* phones: high over his head, clear of the title (117px is his height) */
		left: 2.25rem;
		top: calc(117px + max(0.625rem, env(safe-area-inset-top)) - var(--scene-h));
	}
	.title {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}
	/* Phones: the title sits right of the wolf and below the buttons, so neither covers it. */
	.inner > .title {
		position: absolute;
		top: calc(4rem + env(safe-area-inset-top));
		left: 6rem;
		right: max(0.5rem, env(safe-area-inset-right));
	}
	.actions {
		position: absolute;
		top: calc(0.5rem + env(safe-area-inset-top));
		right: max(0.75rem, env(safe-area-inset-right));
		display: flex;
		/* 40px buttons 8px apart: their 48px touch targets meet but never overlap */
		gap: 0.5rem;
	}
	@media (max-height: 700px) and (max-width: 767px) {
		.inner > .title {
			top: calc(3.75rem + env(safe-area-inset-top));
		}
	}
	@media (min-width: 768px) {
		.inner {
			max-width: 42rem;
			padding-inline: 1.5rem;
		}
		.hero {
			left: 1.5rem;
		}
		/* up and to the right of his ears: the moon he would howl at, if he weren't at work */
		.moon {
			left: calc(100% + 6px);
			top: -36px;
		}
		.inner > .title {
			top: 3.5rem;
			left: 0;
			right: 0;
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
	@media (min-width: 1024px) and (max-height: 960px) {
		.inner > .title {
			top: 1.75rem;
		}
	}

	/* Compact: a back button and the page title on the left, a smaller wolf on the right. The
	   title row ends above his ears, so it may run over him on the narrowest phones. */
	.compact .hero {
		left: auto;
		right: max(1.25rem, env(safe-area-inset-right));
	}
	.compact .moon {
		display: none;
		width: 30px;
		height: 30px;
		left: -42px;
		top: -10px;
	}
	.compact .bar {
		position: absolute;
		top: calc(1rem + env(safe-area-inset-top));
		left: max(1rem, env(safe-area-inset-left));
		right: max(1rem, env(safe-area-inset-right));
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.compact .title {
		align-items: flex-start;
		min-width: 0;
		text-align: start;
	}
	/* Press Start 2P on its 8px grid: 16px, so the 2px split and drop are one font pixel */
	.page-title {
		--glitch-split: 2px;
		--glitch-drop: 2px;
		font-size: 1rem;
		line-height: 1;
		text-transform: uppercase;
		white-space: nowrap;
	}
	.sub {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.5rem;
		color: var(--md-sys-color-on-surface-variant);
		letter-spacing: 0.12em;
		text-transform: uppercase;
		white-space: nowrap;
		text-shadow: 0 2px 0 var(--pixel-ink);
	}
	/* the narrowest phones: a little more room between the title and his ears */
	@media (max-width: 359px) {
		.compact .bar {
			gap: 0.75rem;
		}
		.compact .hero {
			right: max(0.5rem, env(safe-area-inset-right));
		}
	}
	@media (min-width: 768px) {
		.compact .bar {
			top: 1.75rem;
			left: 1.5rem;
		}
		.compact .hero {
			right: 2.5rem;
		}
		.compact .moon {
			display: block;
		}
		.page-title {
			--glitch-split: 3px;
			--glitch-drop: 3px;
			font-size: 1.5rem;
		}
	}
	@media (min-width: 1024px) {
		.compact .inner {
			max-width: var(--scene-max, 42rem);
		}
		.compact .bar {
			left: 2rem;
		}
		.compact .hero {
			right: 4rem;
		}
	}
</style>
