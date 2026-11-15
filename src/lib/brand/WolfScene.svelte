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
	import { sound } from '#lib/audio/sound.svelte.ts';
	import Wolf from './Wolf.svelte';

	/**
	 * The home page's title screen: `children` is the title block, `actions` the buttons pinned
	 * top right (left of the wolf on the compact strip). With `title` it is the compact strip for the inner pages instead: a back button
	 * (`back`), the page `title` with `children` as the line under it, and a smaller wolf.
	 * The foreground sits on the same column as the page's `<main>` (max-w-md, md:max-w-2xl,
	 * and from 1024px `maxWidth`, which the home page defaults to 80rem, with px-safe gutters
	 * of 1 / 1.5 / 2rem), so the wolf, back button and icons line up with the content edges.
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
	const wide = $derived(!compact || maxWidth != null);

	// Lit windows and beacons stay dark behind the title block, so no pixel lands between its
	// letters. The hole is measured in scene units, whole windows only.
	const maskId = $props.id();
	let backdrop = $state<SVGSVGElement>();
	let hole = $state<{ x: number; y: number; w: number; h: number } | null>(null);

	function keepClear(block: HTMLElement) {
		const measure = () => {
			if (!backdrop) return;
			const b = backdrop.getBoundingClientRect();
			let [l, t, r, btm] = [Infinity, Infinity, -Infinity, -Infinity];
			for (const el of block.children) {
				const c = el.getBoundingClientRect();
				if (c.width === 0) continue;
				[l, t, r, btm] = [
					Math.min(l, c.left),
					Math.min(t, c.top),
					Math.max(r, c.right),
					Math.max(btm, c.bottom)
				];
			}
			if (l === Infinity) {
				hole = null;
				return;
			}
			const x = Math.floor((l - b.left) / PX) - 1;
			const y = Math.floor((t - b.top) / PX) - 1;
			hole = {
				x,
				y,
				w: Math.ceil((r - b.left) / PX) + 1 - x,
				h: Math.ceil((btm - b.top) / PX) + 1 - y
			};
		};
		const ro = new ResizeObserver(measure);
		ro.observe(block);
		for (const el of block.children) ro.observe(el);
		addEventListener('resize', measure);
		measure();
		return () => {
			ro.disconnect();
			removeEventListener('resize', measure);
		};
	}
</script>

<header class={['scene', compact && 'compact', wide && 'wide']} style:--scene-max={maxWidth}>
	<div class="sky crt">
		<svg
			bind:this={backdrop}
			class="backdrop pixel-art"
			viewBox="0 0 {W} {H}"
			width={W * PX}
			height={H * PX}
			shape-rendering="crispEdges"
			aria-hidden="true"
		>
			<mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
				<rect width={W} height={H} fill="#fff" />
				{#if hole}
					<rect x={hole.x} y={hole.y} width={hole.w} height={hole.h} fill="#000" />
				{/if}
			</mask>
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
				{/if}
			{/each}
			<g mask="url(#{maskId})">
				{#each buildings as b, i (i)}
					{#if b.spire}
						<rect
							class="beacon"
							x={b.x + Math.floor(b.w / 2)}
							y={H - b.h - 6}
							width="1"
							height="1"
						/>
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
			</g>
			{#each front as f, i (i)}
				<rect x={f.x} y={H - f.h} width={f.w} height={f.h} fill="#070d1f" />
			{/each}
		</svg>
	</div>

	<div class="inner">
		<div class="stage">
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
				<!-- Tap him and he barks. Its own sound, so the layout's click sound skips it. -->
				<button
					type="button"
					class="wolf-button"
					data-sfx="none"
					aria-label="Make the wolf bark"
					onclick={() => sound.play('bark')}
				>
					<Wolf scale={compact ? 2 : PX} class="wolf" title="" />
				</button>
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
					<div class="title" {@attach keepClear}>
						<h1 class="page-title glitch-text font-pixel">{title}</h1>
						<p class="sub type-label-lg type-numeric">{@render children()}</p>
					</div>
				</div>
			{:else}
				<div class="title" {@attach keepClear}>{@render children()}</div>
			{/if}
			{#if actions}
				<div class="actions">{@render actions()}</div>
			{/if}
		</div>
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

	/* The foreground column: the same max width and gutters as the page's <main>. */
	.inner {
		--w: 28rem;
		--g: 1rem;
		position: relative;
		height: 100%;
		margin-inline: auto;
		width: 100%;
		max-width: var(--w);
		padding-top: env(safe-area-inset-top);
		padding-inline: max(var(--g), env(safe-area-inset-left))
			max(var(--g), env(safe-area-inset-right));
	}
	.stage {
		position: relative;
		height: 100%;
	}
	@media (min-width: 768px) {
		.inner {
			--w: 42rem;
			--g: 1.5rem;
		}
	}
	@media (min-width: 1024px) {
		.wide .inner {
			--w: var(--scene-max, 80rem);
			--g: 2rem;
		}
	}

	/* Home: the wolf stands on the content's left edge, the icons end on its right edge. */
	.hero {
		position: absolute;
		bottom: 0;
		left: 0;
	}
	.wolf-button {
		display: block;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	.wolf-button:focus-visible {
		outline: 2px solid var(--md-sys-color-primary);
		outline-offset: 4px;
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
		top: calc(117px + 0.625rem - var(--scene-h));
	}
	.title {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}
	/* Phones: the title sits right of the wolf and below the buttons, so neither covers it. */
	.stage > .title {
		position: absolute;
		top: 4.5rem;
		left: 5rem;
		right: 0;
	}
	.actions {
		position: absolute;
		top: 0.75rem;
		right: 0;
		display: flex;
		/* framed 40px buttons: 12px apart, so their 6px frames meet edge to edge */
		gap: 0.75rem;
	}
	/* The narrowest phones: five buttons share their frames instead, clear of the wolf's ears. */
	@media (max-width: 359px) {
		.actions {
			gap: 6px;
		}
	}
	@media (max-height: 700px) and (max-width: 767px) {
		.stage > .title {
			top: 4.25rem;
		}
		/* no room for both: a streak beats the tagline */
		.stage > .title:has(:global(.streak)) :global(.tagline) {
			display: none;
		}
	}
	/* Very short phones: a strip. The wolf one step smaller (2px a pixel), a small moon, the
	   tagline and streak folded away, so the title fits under the icons. */
	@media (max-height: 620px) and (max-width: 767px) {
		.scene:not(.compact) .hero :global(.wolf) {
			width: 48px;
			height: 78px;
			/* the idle bob is one sprite pixel; Wolf sets it inline for its own scale */
			--px: 2px !important;
			filter: drop-shadow(2px 0 0 var(--pixel-ink)) drop-shadow(-2px 0 0 var(--pixel-ink));
		}
		.scene:not(.compact) .moon {
			width: 30px;
			height: 30px;
			left: 1.75rem;
			top: calc(78px + 0.5rem - var(--scene-h));
		}
		.stage > .title {
			top: 4.25rem;
			left: 4rem;
		}
		.stage > .title :global(:is(.tagline, .streak)) {
			display: none;
		}
	}
	@media (min-width: 768px) {
		/* up and to the right of his ears: the moon he would howl at, if he weren't at work */
		.moon {
			left: calc(100% + 6px);
			top: -36px;
		}
		.stage > .title {
			top: 4.5rem;
			left: 0;
			right: 0;
		}
	}
	@media (min-width: 1024px) and (max-height: 960px) {
		.stage > .title {
			top: 1.75rem;
		}
	}

	/* Compact: the back button and page title on the content's left edge, a smaller wolf on its
	   right edge. The title row ends above his ears, so it may run over him on the narrowest
	   phones. */
	.compact .hero {
		left: auto;
		right: 0;
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
		top: 1rem;
		left: 0;
		right: 0;
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	/* Compact actions sit level with the back button, just left of the wolf (48px wide). */
	.compact .actions {
		top: 1rem;
		right: calc(48px + 1rem);
	}
	/* The narrowest phones have no room for both: the buttons take the wolf's spot. */
	@media (max-width: 359px) {
		.compact:has(.actions) .hero {
			display: none;
		}
		.compact .actions {
			right: 0;
		}
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
	@media (min-width: 768px) {
		.compact .bar {
			top: 1.75rem;
		}
		.compact .moon {
			display: block;
		}
		/* ... and of his moon */
		.compact .actions {
			top: 1.75rem;
			right: calc(48px + 3.75rem);
		}
		.page-title {
			--glitch-split: 3px;
			--glitch-drop: 3px;
			font-size: 1.5rem;
		}
	}
</style>
