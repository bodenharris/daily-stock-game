<svelte:options namespace="svg" />

<script module lang="ts">
  /** Pixel art as rows of '#', turned into one path of 1×1 cells (run-length per row). */
  function sprite(rows: string[]): string {
    let d = '';
    rows.forEach((row, y) => {
      for (const run of row.matchAll(/#+/g))
        d += `M${run.index} ${y}h${run[0].length}v1h-${run[0].length}z`;
    });
    return d;
  }

  /** A fixed pseudo-random number in [0, 1) for (i, salt): the city looks the same every render. */
  function rand(i: number, salt: number): number {
    const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
    return v - Math.floor(v);
  }

  type Light = { x: number; y: number; blink: number | null };

  /**
   * Office windows for a building `w` art pixels wide, `h` tall: a column every 2 pixels, a floor
   * every 3. Most are lit; a very few flick off now and then (`blink` is their cycle in seconds).
   * `widthAt(y)` narrows the floors for a stepped tower.
   */
  function lights(
    w: number,
    h: number,
    seed: number,
    from = 2,
    widthAt: (y: number) => number = () => w,
  ): Light[] {
    const out: Light[] = [];
    let i = 0;
    for (let y = from; y < h - 2; y += 3) {
      const pad = (w - widthAt(y)) / 2;
      for (let x = Math.ceil(pad) + 1; x < w - pad - 1; x += 2) {
        const r = rand(++i, seed);
        if (r < 0.35) continue; // dark office
        out.push({ x, y, blink: r > 0.975 ? 9 + rand(i, seed + 2) * 9 : null });
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
    [TOWER_H, TOWER_W],
  ];
  const towerWidthAt = (y: number) => TOWER_STEPS.find(([until]) => y < until)![1];
  const TOWER = sprite(
    Array.from({ length: TOWER_H }, (_, y) => {
      const pad = '.'.repeat((TOWER_W - towerWidthAt(y)) / 2);
      return pad + '#'.repeat(towerWidthAt(y)) + pad;
    }),
  );
  const TOWER_LIGHTS = lights(TOWER_W, TOWER_H, 7, 19, towerWidthAt);
  /** Where the tower stands, as a share of the plot width (its centre). */
  const TOWER_AT = 0.62;

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
    [0.96, 9, 27],
  ].map(([share, w, h], k) => ({ share, w, h, lights: lights(w, h, 20 + k) }));

  /** Stars across the sky, as shares of the plot. Some twinkle. */
  const STARS = Array.from({ length: 70 }, (_, i) => ({
    x: rand(i, 101),
    y: rand(i, 102) * 0.7,
    big: rand(i, 103) > 0.85,
    twinkle: rand(i, 104) > 0.45 ? 1.8 + rand(i, 105) * 3.5 : null,
    delay: rand(i, 106) * 4,
  }));
</script>

<script lang="ts">
  /** The night city behind the price line, filling (and clipped to) the plot area. */
  let {
    x0,
    x1,
    top,
    bottom,
    uid,
  }: { x0: number; x1: number; top: number; bottom: number; uid: string } = $props();

  const w = $derived(Math.max(1, x1 - x0));
  const h = $derived(Math.max(1, bottom - top));
  /**
   * One art pixel, in whole CSS pixels so the city stays crisp. Capped at the header's density:
   * on a tall chart the tower just stands shorter.
   */
  const p = $derived(Math.min(4, Math.max(2, Math.floor((h * 0.85) / TOWER_H))));
  const base = $derived(Math.round(bottom));
  const star = $derived(Math.max(1, Math.floor(p / 2)));
  const at = (share: number) => Math.round(x0 + w * share);
</script>

{#snippet windows(lights: Light[])}
  {#each lights as l (`${l.x},${l.y}`)}
    <rect
      class={['window', l.blink && 'blink']}
      style:--every="{l.blink ?? 0}s"
      x={l.x}
      y={l.y}
      width="1"
      height="1"
    />
  {/each}
{/snippet}

<defs>
  <clipPath id="{uid}-scene">
    <rect x={x0} y={top} width={w} height={h} />
  </clipPath>
</defs>

<g class="scene" clip-path="url(#{uid}-scene)" shape-rendering="crispEdges">
  {#each STARS as s, i (i)}
    <rect
      class={['star', s.twinkle && 'twinkle']}
      style:--every="{s.twinkle ?? 0}s"
      style:--delay="{s.delay}s"
      x={at(s.x)}
      y={Math.round(top + s.y * h)}
      width={s.big ? star * 2 : star}
      height={s.big ? star * 2 : star}
    />
  {/each}

  <g
    transform="translate({at(TOWER_AT) - Math.round((TOWER_W * p) / 2)} {base -
      TOWER_H * p}) scale({p})"
  >
    <path class="building" d={TOWER} />
    {@render windows(TOWER_LIGHTS)}
    <!-- The mast's aircraft warning light. -->
    <rect class="beacon" x={(TOWER_W - 1) / 2} y="0" width="1" height="1" />
  </g>

  {#each BLOCKS as b (b.share)}
    <g transform="translate({at(b.share)} {base - b.h * p}) scale({p})">
      <rect class="building" width={b.w} height={b.h} />
      {@render windows(b.lights)}
    </g>
  {/each}
</g>

<style>
  /* Backdrop only: everything here stays dimmer than the price line. */
  .scene {
    pointer-events: none;
  }
  .star {
    fill: #fff2c4;
    opacity: 0.4;
  }
  .star.twinkle {
    animation: twinkle var(--every) ease-in-out var(--delay) infinite;
  }
  @keyframes twinkle {
    50% {
      opacity: 0.08;
    }
  }
  .building {
    fill: color-mix(in srgb, var(--md-sys-color-on-surface) 7%, var(--md-sys-color-surface));
  }
  .window {
    fill: var(--md-sys-color-tertiary);
    opacity: 0.32;
  }
  .window.blink {
    animation: office var(--every) steps(1) infinite;
  }
  @keyframes office {
    70% {
      opacity: 0.08;
    }
  }
  .beacon {
    fill: var(--md-sys-color-tertiary);
    opacity: 0.8;
    animation: beacon 2.4s steps(1) infinite;
  }
  @keyframes beacon {
    50% {
      opacity: 0.2;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .star.twinkle,
    .window.blink,
    .beacon {
      animation: none;
    }
  }
</style>
