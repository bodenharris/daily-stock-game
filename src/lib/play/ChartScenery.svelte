<svelte:options namespace="svg" />

<script module lang="ts">
	/** Pixel art as rows of '#', turned into one path of 1×1 cells (run-length per row). */
	function sprite(rows: string[]): string {
		let d = '';
		rows.forEach((row, y) => {
			for (let x = 0; x < row.length;) {
				if (row[x] !== '#') {
					x++;
					continue;
				}
				let n = 0;
				while (row[x + n] === '#') n++;
				d += `M${x} ${y}h${n}v1h${-n}z`;
				x += n;
			}
		});
		return d;
	}

	/** A fixed pseudo-random number in [0, 1) for (i, salt): the city looks the same every render. */
	function rand(i: number, salt: number): number {
		const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
		return v - Math.floor(v);
	}

	type Light = { x: number; y: number; tone: 'gold' | 'cyan' | 'pink'; blink: number | null };

	/**
	 * Office windows for a building `w` art pixels wide, `h` tall: a column every 2 pixels, a floor
	 * every 3. Most are lit; a few flick on and off (`blink` is their cycle in seconds).
	 * `widthAt(y)` narrows the floors for a stepped tower.
	 */
	function lights(w: number, h: number, seed: number, from = 2, widthAt = (_y: number) => w) {
		const out: Light[] = [];
		let i = 0;
		for (let y = from; y < h - 2; y += 3) {
			const rowW = widthAt(y);
			const pad = (w - rowW) / 2;
			for (let x = Math.ceil(pad) + 1; x < pad + rowW - 1; x += 2) {
				i++;
				const r = rand(i, seed);
				if (r < 0.35) continue; // dark office
				const t = rand(i, seed + 1);
				out.push({
					x,
					y,
					tone: t < 0.75 ? 'gold' : t < 0.92 ? 'cyan' : 'pink',
					blink: r > 0.88 ? 5 + rand(i, seed + 2) * 9 : null
				});
			}
		}
		return out;
	}

	/** A stepped Art Deco tower with a mast, after the Empire State Building. 21 × 64. */
	const TOWER_W = 21;
	const TOWER_H = 64;
	const TOWER_STEPS: [until: number, width: number][] = [
		[10, 1],
		[14, 3],
		[18, 5],
		[24, 7],
		[32, 11],
		[42, 15],
		[TOWER_H, TOWER_W]
	];
	const towerWidthAt = (y: number) => TOWER_STEPS.find(([until]) => y < until)![1];
	const TOWER = sprite(
		Array.from({ length: TOWER_H }, (_, y) => {
			const w = towerWidthAt(y);
			const pad = (TOWER_W - w) / 2;
			return '.'.repeat(pad) + '#'.repeat(w) + '.'.repeat(pad);
		})
	);
	const TOWER_LIGHTS = lights(TOWER_W, TOWER_H, 7, 19, towerWidthAt);

	/** Low blocks around the tower: [x share of the plot, width, height] in art pixels. */
	const BLOCKS = [
		[0.0, 9, 20],
		[0.08, 7, 31],
		[0.17, 11, 15],
		[0.27, 8, 25],
		[0.37, 6, 38],
		[0.46, 10, 28],
		[0.73, 9, 24],
		[0.8, 13, 19],
		[0.89, 8, 36],
		[0.96, 9, 27]
	].map(([share, w, h], k) => ({ share, w, h, lights: lights(w, h, 20 + k) }));

	/** Stars across the sky, as shares of the plot. Some twinkle. */
	const STARS = Array.from({ length: 70 }, (_, i) => ({
		x: rand(i, 101),
		y: rand(i, 102) * 0.7,
		big: rand(i, 103) > 0.85,
		twinkle: rand(i, 104) > 0.45 ? 1.8 + rand(i, 105) * 3.5 : null,
		delay: rand(i, 106) * 4
	}));

	/** Shooting stars: where they start (shares), and their cycle. */
	const METEORS = [
		{ x: 0.42, y: 0.06, every: 9, delay: 2.5 },
		{ x: 0.86, y: 0.16, every: 13, delay: 7.5 },
		{ x: 0.24, y: 0.22, every: 17, delay: 12 }
	];

	/** A little prop plane flying right. 12 × 5. */
	const PLANE = sprite([
		'#...........',
		'##.....##...',
		'###########.',
		'.###########',
		'.......##...'
	]);
	const PLANE_PX = 2.5;

	const SLOGANS = [
		'BUY THE DIP',
		'TO THE MOON',
		'HODL',
		'BUY LOW SELL HIGH',
		'DIAMOND HANDS',
		'BULLS VS BEARS',
		'STONKS ONLY GO UP',
		'SELL IN MAY?',
		'BEARS BEWARE',
		'PAPER HANDS BEWARE'
	];

	/** The header's pixel moon. 15 × 15. */
	const MOON =
		'M5 0h5v1h2v1h1v2h1v1h1v5h-1v1h-1v2h-1v1h-2v1H5v-1H3v-1H2v-2H1v-1H0V5h1V4h1V2h1V1h2z';
	const MOON_CRATERS = 'M4 4h2v2H4zM9 8h3v2H9zM5 10h1v1H5z';
</script>

<script lang="ts">
	interface Props {
		/** The plot area the scenery fills (it is clipped to it). */
		x0: number;
		x1: number;
		top: number;
		bottom: number;
		uid: string;
	}

	let { x0, x1, top, bottom, uid }: Props = $props();

	const w = $derived(Math.max(1, x1 - x0));
	const h = $derived(Math.max(1, bottom - top));
	/** One art pixel: the tower stands about 85% of the plot tall. */
	const p = $derived(Math.max(1, (h * 0.85) / TOWER_H));
	const at = (share: number) => x0 + w * share;
	const star = $derived(Math.max(1.5, Math.round(p * 0.45)));

	/** A big moon, as wide as half the plot height (whole art pixels, so it stays crisp). */
	const moon = $derived.by(() => {
		const size = Math.max(15, Math.round((h * 0.5) / 15) * 15);
		return { size, x: at(0.82) - size / 2, y: top + h * 0.06 };
	});

	// Two planes take turns crossing the sky, each towing the next slogan when it comes round.
	let banners = $state([0, 1]);
	const planes = $derived(
		[
			{ alt: 0.1, every: 26, delay: 1.5 },
			{ alt: 0.24, every: 26, delay: 14.5 }
		].map((plane, k) => {
			const text = SLOGANS[banners[k] % SLOGANS.length];
			const bw = text.length * 8 + 14;
			return { ...plane, k, text, bw, fly: w + bw + 80 };
		})
	);
	function nextBanner(k: number, e: AnimationEvent) {
		if (e.target !== e.currentTarget) return; // the bob inside, not the crossing
		banners[k] += 2;
	}
</script>

<defs>
	<clipPath id="{uid}-scene">
		<rect x={x0} y={top} width={w} height={h} />
	</clipPath>
	<linearGradient id="{uid}-tail" x1="0" y1="1" x2="1" y2="0">
		<stop offset="0" stop-color="#fff2c4" stop-opacity="0.95" />
		<stop offset="1" stop-color="#fff2c4" stop-opacity="0" />
	</linearGradient>
</defs>

<g class="scene" clip-path="url(#{uid}-scene)" shape-rendering="crispEdges">
	{#each STARS as s, i (i)}
		<rect
			class={['star', s.twinkle && 'twinkle']}
			style:--every="{s.twinkle ?? 0}s"
			style:--delay="{s.delay}s"
			x={Math.round(at(s.x))}
			y={Math.round(top + s.y * h)}
			width={s.big ? star * 2 : star}
			height={s.big ? star * 2 : star}
		/>
	{/each}

	<g class="moon" transform="translate({moon.x} {moon.y}) scale({moon.size / 15})">
		<path class="moon-face" d={MOON} />
		<path class="moon-craters" d={MOON_CRATERS} />
	</g>

	{#each METEORS as m, i (i)}
		{@const len = Math.max(40, w * 0.12)}
		<g
			class="meteor"
			style:--every="{m.every}s"
			style:--delay="{m.delay}s"
			style:--dx="{-len * 1.6}px"
			style:--dy="{len * 0.8}px"
			transform="translate({at(m.x)} {top + m.y * h})"
		>
			<path d="M0 0 L{len * 0.9} {-len * 0.45}" stroke="url(#{uid}-tail)" />
			<rect x="-1.5" y="-1.5" width="3" height="3" />
		</g>
	{/each}

	{#each planes as plane (plane.k)}
		<g
			class="plane"
			style:--every="{plane.every}s"
			style:--delay="{plane.delay}s"
			style:--fly="{plane.fly}px"
			transform="translate({x0 - 40} {Math.round(top + plane.alt * h)})"
			onanimationiteration={(e) => nextBanner(plane.k, e)}
		>
			<g class="bob">
				<rect class="banner" x={-12 - plane.bw} y="-1" width={plane.bw} height="14" />
				<text class="banner-text" x={-12 - plane.bw / 2} y="9" text-anchor="middle"
					>{plane.text}</text
				>
				<line class="rope" x1="-12" y1="6" x2="0" y2="6" />
				<path class="plane-body" d={PLANE} transform="scale({PLANE_PX})" />
				<rect class="nav-light" x={9 * PLANE_PX} y={1 * PLANE_PX} width="2" height="2" />
			</g>
		</g>
	{/each}

	<g transform="translate({at(0.62) - (TOWER_W * p) / 2} {bottom - TOWER_H * p}) scale({p})">
		<path class="building" d={TOWER} />
		{#each TOWER_LIGHTS as l, i (i)}
			<rect
				class={['window', l.tone, l.blink && 'blink']}
				style:--every="{l.blink ?? 0}s"
				x={l.x}
				y={l.y}
				width="1"
				height="1"
			/>
		{/each}
		<!-- The mast's aircraft warning light. -->
		<rect class="beacon" x={(TOWER_W - 1) / 2} y="0" width="1" height="1" />
	</g>

	{#each BLOCKS as b (b.share)}
		<g transform="translate({at(b.share)} {bottom - b.h * p}) scale({p})">
			<rect class="building" width={b.w} height={b.h} />
			{#each b.lights as l, i (i)}
				<rect
					class={['window', l.tone, l.blink && 'blink']}
					style:--every="{l.blink ?? 0}s"
					x={l.x}
					y={l.y}
					width="1"
					height="1"
				/>
			{/each}
		</g>
	{/each}
</g>

<style>
	.scene {
		pointer-events: none;
	}

	/* Sky. */
	.star {
		fill: #fff2c4;
		opacity: 0.55;
	}
	.star.twinkle {
		animation: twinkle var(--every) ease-in-out var(--delay) infinite;
	}
	@keyframes twinkle {
		50% {
			opacity: 0.08;
		}
	}
	.moon {
		opacity: 0.22;
		filter: drop-shadow(0 0 1.5px rgb(255 242 196 / 0.6));
	}
	.moon-face {
		fill: #fff2c4;
	}
	.moon-craters {
		fill: #f0dc96;
	}
	.meteor {
		opacity: 0;
		animation: meteor var(--every) linear var(--delay) infinite;
	}
	.meteor path {
		fill: none;
		stroke-width: 2;
	}
	.meteor rect {
		fill: #fff2c4;
	}
	@keyframes meteor {
		0% {
			opacity: 0;
			translate: 0 0;
		}
		1% {
			opacity: 1;
		}
		7% {
			opacity: 0;
			translate: var(--dx) var(--dy);
		}
		100% {
			opacity: 0;
			translate: var(--dx) var(--dy);
		}
	}

	/* Planes towing banners: across the sky in the first 60% of each cycle, then a quiet gap. */
	.plane {
		opacity: 0.85;
		translate: -200vw 0;
		animation: fly var(--every) linear var(--delay) infinite;
	}
	@keyframes fly {
		0% {
			translate: 0 0;
		}
		60%,
		100% {
			translate: var(--fly) 0;
		}
	}
	.bob {
		animation: bob 2.4s ease-in-out infinite;
	}
	@keyframes bob {
		50% {
			translate: 0 2px;
		}
	}
	.banner {
		fill: #fff2c4;
	}
	.banner-text {
		font: 400 8px/1 var(--md-ref-typeface-pixel, monospace);
		fill: var(--pixel-ink, #050a14);
	}
	.rope {
		stroke: #fff2c4;
		stroke-width: 1;
		opacity: 0.6;
	}
	.plane-body {
		fill: var(--md-sys-color-on-surface-variant);
	}
	.nav-light {
		fill: var(--down);
		animation: blink-light 1s steps(1) infinite;
	}

	/* City. */
	.building {
		fill: color-mix(in srgb, var(--md-sys-color-on-surface) 7%, var(--md-sys-color-surface));
	}
	.window {
		opacity: 0.55;
	}
	.window.gold {
		fill: var(--md-sys-color-tertiary);
	}
	.window.cyan {
		fill: var(--md-sys-color-primary);
	}
	.window.pink {
		fill: var(--down);
	}
	.window.blink {
		animation: office var(--every) steps(1) infinite;
	}
	@keyframes office {
		60% {
			opacity: 0.05;
		}
	}
	.beacon {
		fill: var(--down);
		animation: blink-light 1.6s steps(1) infinite;
	}
	@keyframes blink-light {
		50% {
			opacity: 0.15;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.star,
		.window,
		.beacon,
		.nav-light,
		.bob {
			animation: none;
		}
		.meteor,
		.plane {
			display: none;
		}
	}
</style>
