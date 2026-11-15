<script lang="ts">
	/**
	 * A static sketch of the game screen built only from the design tokens + components, so the
	 * system can be judged in context. Not the real game (that lives in src/lib/play).
	 */
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import CircleHelpIcon from '@lucide/svelte/icons/circle-help';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as ButtonGroup from '#lib/components/ui/button-group/index.js';
	import { IconButton } from '#lib/components/ui/icon-button/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { SpringNumber } from '#lib/m3/spring-number.svelte.js';
	import { pop } from '#lib/m3/transitions.js';

	let { tonal = false }: { tonal?: boolean } = $props();

	let stake = $state('25');
	let result = $state<{ id: number; delta: number } | null>(null);
	const balance = new SpringNumber(112.4);
	let id = 0;

	function call(dir: 'up' | 'down') {
		const amount = Math.round(balance.target * (Number(stake) / 100) * 100) / 100;
		const delta = dir === 'up' ? amount : -amount;
		balance.target = Math.max(1, balance.target + delta);
		result = { id: ++id, delta };
	}

	const money = (v: number) =>
		v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

	// fake price path: 0..1 normalised, the last 30% is still hidden
	const points = [
		0.42, 0.45, 0.43, 0.48, 0.52, 0.5, 0.55, 0.58, 0.54, 0.6, 0.63, 0.61, 0.57, 0.6, 0.66, 0.7,
		0.68, 0.72
	];
	const W = 320;
	const H = 180;
	const revealed = 0.7;
	const path = points
		.map(
			(p, i) =>
				`${i ? 'L' : 'M'}${((i / (points.length - 1)) * W * revealed).toFixed(1)} ${(H - p * H).toFixed(1)}`
		)
		.join(' ');
	const lastX = W * revealed;
	const lastY = H - points[points.length - 1] * H;
</script>

<div class="flex w-full max-w-[400px] flex-col gap-4 rounded-m3-xl bg-surface p-4 shadow-m3-1">
	<!-- top bar -->
	<div class="flex h-12 items-center gap-2">
		<span class="type-title-lg-emphasized text-on-surface">daily stock</span>
		<Badge variant="primary">#142</Badge>
		<span class="flex-1"></span>
		<IconButton aria-label="How to play"><CircleHelpIcon /></IconButton>
	</div>

	<div class="flex items-end justify-between px-1">
		<div>
			<p class="type-label-md text-on-surface-variant">Balance</p>
			<p class="type-display-sm-emphasized text-on-surface type-numeric">
				{money(balance.current)}
			</p>
		</div>
		{#key result?.id}
			{#if result}
				<span
					in:pop
					class={[
						'mb-1.5 rounded-m3-full px-3 py-1 type-title-lg-emphasized type-numeric',
						result.delta >= 0
							? 'bg-up-container text-on-up-container'
							: 'bg-down-container text-on-down-container'
					]}
				>
					{result.delta >= 0 ? '+' : '−'}{money(Math.abs(result.delta))}
				</span>
			{/if}
		{/key}
	</div>

	<!-- chart -->
	<svg
		viewBox="0 0 {W} {H}"
		class="h-auto w-full overflow-visible"
		role="img"
		aria-label="Price chart"
	>
		{#each [0.25, 0.5, 0.75] as g (g)}
			<line x1="0" x2={W} y1={H * g} y2={H * g} class="stroke-chart-grid" stroke-width="1" />
		{/each}
		<line
			x1="0"
			x2={W}
			y1={H - points[0] * H}
			y2={H - points[0] * H}
			class="stroke-chart-baseline"
			stroke-dasharray="4 4"
		/>
		<path d="{path} L{lastX} {H} L0 {H} Z" class="fill-chart-area" />
		<rect x={lastX} y="0" width={W - lastX} height={H} class="fill-chart-mask" />
		<line x1={lastX} x2={lastX} y1="0" y2={H} class="stroke-chart-mask-edge" stroke-width="1" />
		<path
			d={path}
			fill="none"
			class="stroke-chart-line"
			stroke-width="2.5"
			stroke-linejoin="round"
			stroke-linecap="round"
		/>
		<circle cx={lastX} cy={lastY} r="7" class="fill-chart-marker-ring" />
		<circle cx={lastX} cy={lastY} r="4.5" class="fill-chart-marker" />
		<text
			x={lastX + (W - lastX) / 2}
			y={H / 2 + 6}
			text-anchor="middle"
			class="fill-chart-axis type-headline-sm-emphasized">?</text
		>
	</svg>

	<!-- crowd split -->
	<div class="flex flex-col gap-1.5">
		<div class="flex h-2 gap-1 overflow-hidden">
			<span class="rounded-m3-full bg-up" style:flex="62"></span>
			<span class="rounded-m3-full bg-down" style:flex="38"></span>
		</div>
		<div class="flex justify-between type-label-md text-on-surface-variant type-numeric">
			<span>62% called up</span><span>38% called down</span>
		</div>
	</div>

	<!-- stake -->
	<div class="flex flex-col gap-2">
		<p class="text-center type-label-md text-on-surface-variant">Stake</p>
		<ButtonGroup.Root
			type="single"
			variant="connected"
			size="sm"
			itemVariant="tonal"
			required
			bind:value={stake}
		>
			{#each ['10', '25', '50'] as v (v)}
				<ButtonGroup.Item value={v}><span class="type-numeric">{v}%</span></ButtonGroup.Item>
			{/each}
		</ButtonGroup.Root>
	</div>

	<!-- calls -->
	<div class="grid grid-cols-2 gap-3">
		<Button variant={tonal ? 'up-tonal' : 'up'} size="hero" onclick={() => call('up')}>
			<ArrowUpIcon />Up
		</Button>
		<Button variant={tonal ? 'down-tonal' : 'down'} size="hero" onclick={() => call('down')}>
			<ArrowDownIcon />Down
		</Button>
	</div>
</div>
