<script lang="ts">
	/*
	 * DEV ONLY (404 in production, see +page.ts). Design-foundation showcase: every token and
	 * component, in light and dark. Delete once the game screens cover it.
	 */
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ShareIcon from '@lucide/svelte/icons/share';
	import MailIcon from '@lucide/svelte/icons/mail';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import CircleHelpIcon from '@lucide/svelte/icons/circle-help';
	import ChartLineIcon from '@lucide/svelte/icons/chart-line';
	import XIcon from '@lucide/svelte/icons/x';
	import FlameIcon from '@lucide/svelte/icons/flame';
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as ButtonGroup from '#lib/components/ui/button-group/index.js';
	import { IconButton } from '#lib/components/ui/icon-button/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Drawer from '#lib/components/ui/drawer/index.js';
	import { TextField } from '#lib/components/ui/text-field/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Progress } from '#lib/components/ui/progress/index.js';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import { Skeleton } from '#lib/components/ui/skeleton/index.js';
	import { Toaster } from '#lib/components/ui/sonner/index.js';
	import { pop, rise } from '#lib/m3/transitions.js';
	import { SPRING_TOKENS } from '#lib/m3/motion.js';
	import Section from './Section.svelte';
	import RankBadge from '#lib/brand/RankBadge.svelte';
	import { ALPHA, PACK_RANKS } from '#lib/game/rank.ts';
	import Swatch from './Swatch.svelte';
	import GameMock from './GameMock.svelte';

	type Mode = 'system' | 'light' | 'dark' | 'both';
	let mode = $state<Mode>('both');

	// Force a scheme on <html> so portalled overlays (sheet, dialog, snackbar) follow it too.
	$effect(() => {
		const root = document.documentElement;
		root.classList.toggle('light', mode === 'light');
		root.classList.toggle('dark', mode === 'dark');
		return () => root.classList.remove('light', 'dark');
	});

	let showPassword = $state(false);
	let email = $state('');
	let progress = $state(60);
	let motionKey = $state(0);
	let springsOn = $state(false);

	const md = (role: string) => `--md-sys-color-${role}`;

	const groups: { title: string; pairs: [string, string | undefined, string][] }[] = [
		{
			title: 'Up / down',
			pairs: [
				['--up', '--on-up', 'up'],
				['--up-container', '--on-up-container', 'up-container'],
				['--down', '--on-down', 'down'],
				['--down-container', '--on-down-container', 'down-container']
			]
		},
		{
			title: 'Accents',
			pairs: [
				[md('primary'), md('on-primary'), 'primary'],
				[md('primary-container'), md('on-primary-container'), 'primary-container'],
				[md('secondary'), md('on-secondary'), 'secondary'],
				[md('secondary-container'), md('on-secondary-container'), 'secondary-container'],
				[md('tertiary'), md('on-tertiary'), 'tertiary'],
				[md('tertiary-container'), md('on-tertiary-container'), 'tertiary-container'],
				[md('error'), md('on-error'), 'error'],
				[md('error-container'), md('on-error-container'), 'error-container']
			]
		},
		{
			title: 'Fixed',
			pairs: [
				[md('primary-fixed'), md('on-primary-fixed'), 'primary-fixed'],
				[md('primary-fixed-dim'), md('on-primary-fixed-variant'), 'primary-fixed-dim'],
				[md('secondary-fixed'), md('on-secondary-fixed'), 'secondary-fixed'],
				[md('secondary-fixed-dim'), md('on-secondary-fixed-variant'), 'secondary-fixed-dim'],
				[md('tertiary-fixed'), md('on-tertiary-fixed'), 'tertiary-fixed'],
				[md('tertiary-fixed-dim'), md('on-tertiary-fixed-variant'), 'tertiary-fixed-dim']
			]
		},
		{
			title: 'Surfaces',
			pairs: [
				[md('surface-dim'), md('on-surface'), 'surface-dim'],
				[md('surface'), md('on-surface'), 'surface'],
				[md('surface-bright'), md('on-surface'), 'surface-bright'],
				[md('surface-container-lowest'), md('on-surface'), 'container-lowest'],
				[md('surface-container-low'), md('on-surface'), 'container-low'],
				[md('surface-container'), md('on-surface'), 'container'],
				[md('surface-container-high'), md('on-surface'), 'container-high'],
				[md('surface-container-highest'), md('on-surface-variant'), 'container-highest'],
				[md('surface-variant'), md('on-surface-variant'), 'surface-variant'],
				[md('inverse-surface'), md('inverse-on-surface'), 'inverse-surface'],
				[md('inverse-surface'), md('inverse-primary'), 'inverse-primary'],
				[md('surface'), md('outline'), 'outline'],
				[md('surface'), md('outline-variant'), 'outline-variant']
			]
		},
		{
			title: 'Chart',
			pairs: [
				['--md-sys-color-surface', '--chart-line', 'chart-line'],
				['--chart-mask', '--chart-axis', 'chart-mask / axis'],
				['--md-sys-color-surface', '--chart-grid', 'chart-grid'],
				['--md-sys-color-surface', '--chart-baseline', 'chart-baseline'],
				['--md-sys-color-surface', '--chart-marker', 'chart-marker'],
				['--md-sys-color-surface', '--chart-up', 'chart-up'],
				['--md-sys-color-surface', '--chart-down', 'chart-down'],
				['--md-sys-color-surface', '--chart-reveal', 'chart-reveal']
			]
		}
	];

	// literal class names so Tailwind generates them
	const typeStyles: [string, string, string][] = [
		['display-lg', 'type-display-lg', 'type-display-lg-emphasized'],
		['display-md', 'type-display-md', 'type-display-md-emphasized'],
		['display-sm', 'type-display-sm', 'type-display-sm-emphasized'],
		['headline-lg', 'type-headline-lg', 'type-headline-lg-emphasized'],
		['headline-md', 'type-headline-md', 'type-headline-md-emphasized'],
		['headline-sm', 'type-headline-sm', 'type-headline-sm-emphasized'],
		['title-lg', 'type-title-lg', 'type-title-lg-emphasized'],
		['title-md', 'type-title-md', 'type-title-md-emphasized'],
		['title-sm', 'type-title-sm', 'type-title-sm-emphasized'],
		['body-lg', 'type-body-lg', 'type-body-lg-emphasized'],
		['body-md', 'type-body-md', 'type-body-md-emphasized'],
		['body-sm', 'type-body-sm', 'type-body-sm-emphasized'],
		['label-lg', 'type-label-lg', 'type-label-lg-emphasized'],
		['label-md', 'type-label-md', 'type-label-md-emphasized'],
		['label-sm', 'type-label-sm', 'type-label-sm-emphasized']
	];

	const shapes: [string, string][] = [
		['xs', 'rounded-m3-xs'],
		['sm', 'rounded-m3-sm'],
		['md', 'rounded-m3-md'],
		['lg', 'rounded-m3-lg'],
		['lg-increased', 'rounded-m3-lg-increased'],
		['xl', 'rounded-m3-xl'],
		['xl-increased', 'rounded-m3-xl-increased'],
		['xxl', 'rounded-m3-xxl'],
		['full', 'rounded-m3-full']
	];

	const springClass: Record<string, string> = {
		'fast-spatial': 'ease-spring-fast-spatial duration-spring-fast-spatial',
		'default-spatial': 'ease-spring-default-spatial duration-spring-default-spatial',
		'slow-spatial': 'ease-spring-slow-spatial duration-spring-slow-spatial',
		'fast-effects': 'ease-spring-fast-effects duration-spring-fast-effects',
		'default-effects': 'ease-spring-default-effects duration-spring-default-effects',
		'slow-effects': 'ease-spring-slow-effects duration-spring-slow-effects'
	};
</script>

<svelte:head>
	<title>Design foundation (dev)</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<Toaster />

{#snippet sheet(scheme: string)}
	<div
		class={[
			scheme,
			'flex min-w-0 flex-1 flex-col gap-12 bg-surface px-4 py-8 text-on-surface sm:px-8'
		]}
	>
		{#if mode === 'both'}
			<p class="type-label-lg-emphasized text-on-surface-variant uppercase">{scheme}</p>
		{/if}

		<Section
			title="Game screen sketch"
			note="Strong fills (left) vs. container fills for the calls."
		>
			<div class="flex flex-wrap gap-6">
				<GameMock />
				<GameMock tonal />
			</div>
		</Section>

		<Section
			title="Color roles"
			note="49 M3 roles from seed #2E6B3A (TonalSpot) + the custom down color. Ratio = content on container."
		>
			{#each groups as group (group.title)}
				<h3 class="type-title-sm text-on-surface-variant">{group.title}</h3>
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
					{#each group.pairs as [bg, fg, label] (label)}
						<Swatch {bg} {fg} {label} scheme={scheme + mode} />
					{/each}
				</div>
			{/each}
		</Section>

		<Section
			title="Type"
			note="VT323 everywhere (one weight, so emphasized differs by size only) · Press Start 2P for the wordmark (font-pixel)."
		>
			<div class="flex flex-col gap-3">
				{#each typeStyles as [name, base, emphasized] (name)}
					<div class="flex flex-wrap items-baseline gap-x-6 gap-y-1">
						<span class="w-24 shrink-0 type-label-sm text-on-surface-variant">{name}</span>
						<span class={[base, 'min-w-0 truncate']}>Up or down?</span>
						<span class={[emphasized, 'min-w-0 truncate text-m3-primary']}>Up or down?</span>
					</div>
				{/each}
				<div class="flex flex-wrap items-baseline gap-6">
					<span class="w-24 shrink-0 type-label-sm text-on-surface-variant">type-numeric</span>
					<span class="type-headline-lg-emphasized type-numeric">$1,111.11</span>
					<span class="type-headline-lg-emphasized type-numeric">$8,888.88</span>
					<span class="type-headline-lg-emphasized text-down type-numeric">−$12.40</span>
				</div>
			</div>
		</Section>

		<Section
			title="Wolf Pack Ranks"
			note="One pixel badge per rank, shown beside it on the end card."
		>
			<div class="flex flex-wrap gap-4">
				{#each [...PACK_RANKS, ALPHA] as r (r.key)}
					<div class="flex flex-col items-center gap-1.5">
						<RankBadge rank={r.key} scale={3} />
						<span class="type-label-sm text-on-surface-variant">{r.label}</span>
					</div>
				{/each}
			</div>
		</Section>

		<Section title="Shape" note="Expressive corner scale. rounded-m3-*.">
			<div class="flex flex-wrap gap-3">
				{#each shapes as [name, cls] (name)}
					<div class="flex flex-col items-center gap-1.5">
						<div class={[cls, 'size-16 bg-primary-container']}></div>
						<span class="type-label-sm text-on-surface-variant">{name}</span>
					</div>
				{/each}
			</div>
		</Section>

		<Section title="Elevation" note="Used sparingly: tonal surfaces do most of the separation.">
			<div class="flex flex-wrap gap-4">
				{#each ['shadow-m3-0', 'shadow-m3-1', 'shadow-m3-2', 'shadow-m3-3', 'shadow-m3-4', 'shadow-m3-5'] as l, i (l)}
					<div
						class={[
							l,
							'grid size-20 place-items-center rounded-m3-lg bg-surface-container-low type-label-lg'
						]}
					>
						{i}
					</div>
				{/each}
			</div>
		</Section>

		<Section
			title="Motion"
			note="Springs as CSS linear() (ease-spring-* + duration-spring-*) and Svelte transitions (pop, rise). Spatial overshoots, effects never do. Reduced motion drops spatial movement."
		>
			<Button variant="tonal" onclick={() => (springsOn = !springsOn)}>Run springs</Button>
			<div class="flex flex-col gap-2">
				{#each SPRING_TOKENS as token (token)}
					<div class="flex items-center gap-3">
						<span class="w-28 shrink-0 type-label-md text-on-surface-variant">{token}</span>
						<div class="relative h-8 flex-1 rounded-m3-full bg-surface-container">
							<div
								class={[
									'absolute top-1 left-1 size-6 rounded-m3-full bg-m3-primary transition-[left,opacity]',
									springClass[token],
									springsOn && 'left-[calc(100%-1.75rem)]',
									token.endsWith('effects') && !springsOn && 'opacity-30'
								]}
							></div>
						</div>
					</div>
				{/each}
			</div>
			<div class="flex flex-wrap items-center gap-4">
				<Button variant="outlined" onclick={() => motionKey++}>Replay pop / rise</Button>
				{#key motionKey}
					<span
						in:pop
						class="rounded-m3-full bg-up-container px-4 py-2 type-headline-sm-emphasized text-on-up-container type-numeric"
						>+$12</span
					>
					<span in:rise class="rounded-m3-lg bg-surface-container-high px-4 py-2 type-body-md"
						>rise</span
					>
				{/key}
			</div>
		</Section>

		<Section
			title="Buttons"
			note="Ripple + press morph (full → pressed corner). hero is the call size."
		>
			<div class="flex flex-wrap items-center gap-3">
				<Button>Filled</Button>
				<Button variant="tonal">Tonal</Button>
				<Button variant="outlined">Outlined</Button>
				<Button variant="elevated">Elevated</Button>
				<Button variant="text">Text</Button>
				<Button disabled>Disabled</Button>
			</div>
			<div class="flex flex-wrap items-center gap-3">
				<Button size="xs">XS 32</Button>
				<Button size="sm">S 40</Button>
				<Button size="md"><ShareIcon />Share 56</Button>
				<Button size="md" shape="square" variant="tonal">Square</Button>
				<Button variant="tonal" toggle>Toggle</Button>
			</div>
			<div class="grid max-w-md grid-cols-2 gap-3">
				<Button variant="up" size="hero"><ArrowUpIcon />Up</Button>
				<Button variant="down" size="hero"><ArrowDownIcon />Down</Button>
				<Button variant="up-tonal" size="hero"><ArrowUpIcon />Up</Button>
				<Button variant="down-tonal" size="hero"><ArrowDownIcon />Down</Button>
				<Button variant="up" size="hero" disabled><ArrowUpIcon />Up</Button>
				<Button variant="down-tonal" size="hero" toggle pressed><ArrowDownIcon />Picked</Button>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<IconButton aria-label="Help"><CircleHelpIcon /></IconButton>
				<IconButton variant="tonal" aria-label="Stats"><ChartLineIcon /></IconButton>
				<IconButton variant="filled" aria-label="Share"><ShareIcon /></IconButton>
				<IconButton variant="outlined" aria-label="Close"><XIcon /></IconButton>
				<IconButton variant="tonal" size="md" shape="square" aria-label="Stats"
					><ChartLineIcon /></IconButton
				>
			</div>
		</Section>

		<Section
			title="Button groups"
			note="connected + type=single is the stake selector; standard squeezes on press."
		>
			<div class="flex max-w-md flex-col gap-4">
				<ButtonGroup.Root
					type="single"
					variant="connected"
					size="sm"
					itemVariant="tonal"
					required
					value="25"
				>
					<ButtonGroup.Item value="10">10%</ButtonGroup.Item>
					<ButtonGroup.Item value="25">25%</ButtonGroup.Item>
					<ButtonGroup.Item value="50">50%</ButtonGroup.Item>
				</ButtonGroup.Root>
				<ButtonGroup.Root
					type="single"
					variant="connected"
					size="md"
					itemVariant="filled"
					value="10"
				>
					<ButtonGroup.Item value="10">$11</ButtonGroup.Item>
					<ButtonGroup.Item value="25">$28</ButtonGroup.Item>
					<ButtonGroup.Item value="50">$56</ButtonGroup.Item>
				</ButtonGroup.Root>
				<ButtonGroup.Root size="hero" class="flex w-full [&>*]:flex-1">
					<ButtonGroup.Item variant="up"><ArrowUpIcon />Up</ButtonGroup.Item>
					<ButtonGroup.Item variant="down"><ArrowDownIcon />Down</ButtonGroup.Item>
				</ButtonGroup.Root>
			</div>
		</Section>

		<Section title="Badges">
			<div class="flex flex-wrap items-center gap-2">
				<Badge>Tonal</Badge>
				<Badge variant="primary">#142</Badge>
				<Badge variant="up"><ArrowUpIcon />+12%</Badge>
				<Badge variant="down"><ArrowDownIcon />−8%</Badge>
				<Badge variant="outline">Mar 2020</Badge>
				<Badge variant="inverse">The Contrarian</Badge>
				<Badge variant="primary" size="md"><FlameIcon />7 day streak</Badge>
			</div>
		</Section>

		<Section title="Text fields">
			<div class="flex max-w-md flex-col gap-4">
				<TextField
					class="w-full"
					label="Email"
					type="email"
					autocomplete="email"
					leadingIcon={MailIcon}
					bind:value={email}
				/>
				<TextField
					class="w-full"
					label="Password"
					type={showPassword ? 'text' : 'password'}
					trailingIcon={showPassword ? EyeOffIcon : EyeIcon}
					trailingIconLabel={showPassword ? 'Hide password' : 'Show password'}
					ontrailingclick={() => (showPassword = !showPassword)}
					supportingText="At least 8 characters"
				/>
				<TextField class="w-full" variant="outlined" label="Display name" value="Bull Run" />
				<TextField
					class="w-full"
					label="Email"
					value="nope"
					error
					errorText="That doesn't look like an email"
				/>
				<div class="flex flex-col gap-2">
					<Label for="plain-{scheme}">Input + Label</Label>
					<Input id="plain-{scheme}" placeholder="you@example.com" />
				</div>
			</div>
		</Section>

		<Section title="Card" note="The reveal card: elevated, extra-large corners.">
			<Card.Root shape="xl" class="max-w-md">
				<Card.Header>
					<Badge variant="outline">Feb 19 – Mar 23, 2020</Badge>
					<Card.Title class="type-display-sm-emphasized">ZM</Card.Title>
					<Card.Description>Zoom Video Communications</Card.Description>
				</Card.Header>
				<Card.Content>
					The world went home and everyone needed a meeting link. While the market fell a third,
					this one nearly doubled.
				</Card.Content>
				<Card.Content class="flex items-end justify-between">
					<div>
						<p class="type-label-md text-on-surface-variant">Final balance</p>
						<p class="type-headline-lg-emphasized text-on-surface type-numeric">$148.20</p>
					</div>
					<Badge variant="inverse" size="md">The Contrarian</Badge>
				</Card.Content>
				<Card.Footer>
					<Button size="md" class="w-full" onclick={() => toast('Copied to clipboard')}>
						<ShareIcon />Share
					</Button>
				</Card.Footer>
			</Card.Root>
			<div class="flex flex-wrap gap-3">
				<Card.Root variant="filled" class="w-40"><Card.Content>Filled</Card.Content></Card.Root>
				<Card.Root variant="outlined" class="w-40"><Card.Content>Outlined</Card.Content></Card.Root>
			</div>
		</Section>

		<Section title="Overlays">
			<div class="flex flex-wrap gap-3">
				<Drawer.Root>
					<Drawer.Trigger>
						{#snippet child({ props })}
							<Button variant="tonal" {...props}>Sign-in sheet</Button>
						{/snippet}
					</Drawer.Trigger>
					<Drawer.Content>
						<Drawer.Header>
							<Drawer.Title>Save your streak</Drawer.Title>
							<Drawer.Description>Sign in to keep your stats on every device.</Drawer.Description>
						</Drawer.Header>
						<div class="flex flex-col gap-4 px-6">
							<TextField class="w-full" label="Email" type="email" leadingIcon={MailIcon} />
							<TextField class="w-full" label="Password" type="password" />
						</div>
						<Drawer.Footer>
							<Drawer.Close>
								{#snippet child({ props })}
									<Button variant="text" {...props}>Not now</Button>
								{/snippet}
							</Drawer.Close>
							<Button>Sign in</Button>
						</Drawer.Footer>
					</Drawer.Content>
				</Drawer.Root>

				<Dialog.Root>
					<Dialog.Trigger>
						{#snippet child({ props })}
							<Button variant="outlined" {...props}>Help dialog</Button>
						{/snippet}
					</Dialog.Trigger>
					<Dialog.Content icon={CircleHelpIcon}>
						<Dialog.Header>
							<Dialog.Title>How to play</Dialog.Title>
							<Dialog.Description>
								Five calls. Guess where the chart goes next, stake part of your balance, and get
								paid more when the crowd guessed wrong.
							</Dialog.Description>
						</Dialog.Header>
						<Dialog.Footer>
							<Dialog.Close>
								{#snippet child({ props })}
									<Button variant="text" {...props}>Got it</Button>
								{/snippet}
							</Dialog.Close>
						</Dialog.Footer>
					</Dialog.Content>
				</Dialog.Root>

				<Button variant="outlined" onclick={() => toast('Copied to clipboard')}>Snackbar</Button>
				<Button
					variant="outlined"
					onclick={() => toast('Result copied', { action: { label: 'Undo', onClick: () => {} } })}
				>
					Snackbar + action
				</Button>
			</div>
		</Section>

		<Section title="Progress, skeleton, separator">
			<div class="flex max-w-md flex-col gap-6">
				<Progress value={progress} />
				<Progress value={progress} wavy />
				<Progress indeterminate />
				<div class="flex gap-2">
					<Button size="xs" variant="tonal" onclick={() => (progress = Math.max(0, progress - 20))}
						>−20</Button
					>
					<Button
						size="xs"
						variant="tonal"
						onclick={() => (progress = Math.min(100, progress + 20))}>+20</Button
					>
				</div>
				<Separator />
				<div class="flex items-center gap-3">
					<Skeleton class="size-12 rounded-m3-full" />
					<div class="flex flex-1 flex-col gap-2">
						<Skeleton class="h-4 w-3/4" />
						<Skeleton class="h-4 w-1/2" />
					</div>
				</div>
				<Skeleton class="h-48 w-full rounded-m3-xl" />
			</div>
		</Section>
	</div>
{/snippet}

<main class="min-h-dvh bg-surface">
	<div
		class="sticky top-0 z-10 flex flex-wrap items-center gap-3 bg-surface-container px-4 py-3 shadow-m3-1 sm:px-8"
	>
		<div class="flex flex-col">
			<h1 class="type-title-lg-emphasized text-on-surface">Design foundation</h1>
			<p class="type-label-md text-error">Dev only · not shipped</p>
		</div>
		<span class="flex-1"></span>
		<ButtonGroup.Root
			type="single"
			variant="connected"
			size="xs"
			itemVariant="tonal"
			required
			class="w-auto"
			bind:value={() => mode, (v) => (mode = v as Mode)}
		>
			<ButtonGroup.Item value="system">System</ButtonGroup.Item>
			<ButtonGroup.Item value="light">Light</ButtonGroup.Item>
			<ButtonGroup.Item value="dark">Dark</ButtonGroup.Item>
			<ButtonGroup.Item value="both">Both</ButtonGroup.Item>
		</ButtonGroup.Root>
	</div>

	{#if mode === 'both'}
		<div class="flex flex-col lg:flex-row">
			{@render sheet('light')}
			{@render sheet('dark')}
		</div>
	{:else}
		{@render sheet(mode === 'system' ? '' : mode)}
	{/if}
</main>
