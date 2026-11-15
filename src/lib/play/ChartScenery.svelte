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

	/** A wolf sitting on a ledge, head thrown back, howling up and to the left. 20 × 20. */
	const WOLF = sprite([
		'..#.................',
		'..##................',
		'...##...............',
		'...####.##..........',
		'....######..........',
		'....#######.........',
		'.....######.........',
		'.....######.........',
		'......######........',
		'......#######.......',
		'......########......',
		'......#########.....',
		'......##########....',
		'.....###########....',
		'.....############...',
		'.....###.########...',
		'.....###.#########..',
		'.....###.#########.#',
		'....####.##########.',
		'....####.#########..'
	]);
	/** Where the howl comes out, in wolf cells. */
	const SNOUT = { x: 2.5, y: 0.5 };

	/** A stepped Art Deco tower with a mast, after the Empire State Building. 21 × 64. */
	const TOWER_W = 21;
	const TOWER_H = 64;
	const TOWER = (() => {
		const steps: [until: number, width: number][] = [
			[10, 1],
			[14, 3],
			[18, 5],
			[24, 7],
			[32, 11],
			[42, 15],
			[TOWER_H, TOWER_W]
		];
		const rows: string[] = [];
		for (let y = 0; y < TOWER_H; y++) {
			const w = steps.find(([until]) => y < until)![1];
			const pad = (TOWER_W - w) / 2;
			rows.push('.'.repeat(pad) + '#'.repeat(w) + '.'.repeat(pad));
		}
		return sprite(rows);
	})();
	/** A scatter of lit windows on the tower (fixed, so it never flickers between renders). */
	const TOWER_LIT = sprite(
		Array.from({ length: TOWER_H }, (_, y) =>
			Array.from({ length: TOWER_W }, (_, x) => {
				if (y < 26 || y % 3 !== 0 || x % 2 !== 0) return '.';
				const w = y < 32 ? 11 : y < 42 ? 15 : TOWER_W;
				const pad = (TOWER_W - w) / 2;
				if (x <= pad || x >= TOWER_W - pad - 1) return '.';
				return (x * 7 + y * 13) % 5 === 0 ? '#' : '.';
			}).join('')
		)
	);

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
		/** The last day closed down: the wolf climbs onto the roof and howls. */
		howl: boolean;
		uid: string;
	}

	let { x0, x1, top, bottom, howl, uid }: Props = $props();

	const w = $derived(Math.max(1, x1 - x0));
	const h = $derived(Math.max(1, bottom - top));
	/** One art pixel: the tower stands about 85% of the plot tall. */
	const p = $derived(Math.max(1, (h * 0.85) / TOWER_H));
	const at = (share: number) => x0 + w * share;

	/** Low blocks around the tower, as [x share, width, height] in art pixels. */
	const blocks = [
		[0.03, 8, 18],
		[0.12, 6, 27],
		[0.21, 10, 13],
		[0.34, 7, 21],
		[0.45, 9, 30],
		[0.93, 8, 34]
	] as const;

	// The wolf's perch: a low roof to the right of the tower, with the moon rising behind it.
	const perch = $derived({ x: at(0.8) - 7 * p, w: 14 * p, h: 22 * p });
	const roofY = $derived(bottom - perch.h);
	const wolfPx = $derived(p * 0.8);
	const wolf = $derived({ x: perch.x + perch.w / 2 - 10 * wolfPx, y: roofY - 20 * wolfPx });
	/** A big moon, as wide as half the plot height (whole art pixels, so it stays crisp). */
	const moon = $derived.by(() => {
		const size = Math.max(15, Math.round((h * 0.55) / 15) * 15);
		return { size, cx: perch.x + perch.w / 2 + 2 * p, cy: roofY - size * 0.42 };
	});
	const snout = $derived({ x: wolf.x + SNOUT.x * wolfPx, y: wolf.y + SNOUT.y * wolfPx });
</script>

<defs>
	<clipPath id="{uid}-scene">
		<rect x={x0} y={top} width={w} height={h} />
	</clipPath>
	<!-- The wolf climbs up from behind the parapet, never through it. -->
	<clipPath id="{uid}-roof">
		<rect x={x0} y={top} width={w} height={Math.max(0, roofY - top)} />
	</clipPath>
</defs>

<g class="scene" clip-path="url(#{uid}-scene)" shape-rendering="crispEdges">
	<g
		class={['moon', howl && 'lit']}
		transform="translate({moon.cx - moon.size / 2} {moon.cy - moon.size / 2}) scale({moon.size /
			15})"
	>
		<path class="moon-face" d={MOON} />
		<path class="moon-craters" d={MOON_CRATERS} />
	</g>

	{#each blocks as [share, bw, bh] (share)}
		<rect class="building" x={at(share)} y={bottom - bh * p} width={bw * p} height={bh * p} />
	{/each}

	<g transform="translate({at(0.62) - (TOWER_W * p) / 2} {bottom - TOWER_H * p}) scale({p})">
		<path class="building" d={TOWER} />
		<path class="window" d={TOWER_LIT} />
	</g>

	{#if howl}
		<g clip-path="url(#{uid}-roof)">
			<g class="wolf" transform="translate({wolf.x} {wolf.y}) scale({wolfPx})">
				<path d={WOLF} />
			</g>
		</g>
		<g class="howl" transform="translate({snout.x} {snout.y})">
			{#each [1, 2, 3] as k (k)}
				{@const r = k * 3.2 * wolfPx}
				<path class="wave" style:--k={k} d="M{-r} 0 A{r} {r} 0 0 1 0 {-r}" />
			{/each}
			<text class="awoo" x={-4 * wolfPx} y={-12 * wolfPx} text-anchor="end">AWOOOO</text>
		</g>
	{/if}

	<rect class="building" x={perch.x} y={roofY} width={perch.w} height={perch.h} />
</g>

<style>
	.scene {
		pointer-events: none;
	}
	.moon {
		opacity: 0.2;
		filter: drop-shadow(0 0 1.5px rgb(255 242 196 / 0.6));
		transition: opacity 1.2s ease;
	}
	.moon.lit {
		opacity: 0.4;
	}
	.moon-face {
		fill: #fff2c4;
	}
	.moon-craters {
		fill: #f0dc96;
	}
	.building {
		fill: color-mix(in srgb, var(--md-sys-color-on-surface) 7%, var(--md-sys-color-surface));
		opacity: 0.85;
	}
	.window {
		fill: var(--md-sys-color-tertiary);
		opacity: 0.35;
	}
	.wolf {
		fill: var(--pixel-ink, #050a14);
		filter: drop-shadow(0 0 2px rgb(255 242 196 / 0.5));
		animation: climb 900ms cubic-bezier(0.2, 0.8, 0.2, 1) 300ms both;
	}
	@keyframes climb {
		from {
			translate: 0 60%;
		}
	}
	.wave {
		fill: none;
		stroke: #fff2c4;
		stroke-width: 2;
		stroke-linecap: square;
		opacity: 0;
		transform-box: view-box;
		animation: wave 1.4s ease-out calc(1.1s + var(--k) * 180ms) 3;
	}
	@keyframes wave {
		0% {
			opacity: 0;
			scale: 0.6;
		}
		30% {
			opacity: 0.9;
		}
		100% {
			opacity: 0;
			scale: 1.5;
		}
	}
	.awoo {
		font: 400 10px/1 var(--md-ref-typeface-pixel, monospace);
		fill: #fff2c4;
		opacity: 0;
		animation: awoo 3.2s ease-out 1.1s both;
	}
	@keyframes awoo {
		0% {
			opacity: 0;
			translate: 0 6px;
		}
		15%,
		75% {
			opacity: 0.9;
		}
		100% {
			opacity: 0;
			translate: -6px -14px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.wolf,
		.wave,
		.awoo {
			animation: none;
		}
		.wave,
		.awoo {
			display: none;
		}
	}
</style>
