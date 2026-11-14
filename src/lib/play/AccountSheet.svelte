<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import { TextField } from '#lib/components/ui/text-field/index.js';
	import { authClient } from '#lib/auth-client.ts';
	import { getGame } from '#lib/remote/game.remote.ts';
	import Sheet from './Sheet.svelte';
	import type { GameView } from './types.ts';

	let { open = $bindable(false), view }: { open?: boolean; view: GameView } = $props();

	let mode = $state<'signup' | 'signin'>('signup');
	let email = $state('');
	let password = $state('');
	let busy = $state(false);
	let error = $state<string | null>(null);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (busy) return;
		busy = true;
		error = null;
		try {
			const res =
				mode === 'signup'
					? await authClient.signUp.email({ email, password, name: email.split('@')[0] })
					: await authClient.signIn.email({ email, password });
			if (res.error) {
				error =
					res.error.status === 422 || res.error.code === 'USER_ALREADY_EXISTS'
						? 'That email already has an account. Sign in instead.'
						: res.error.status === 401
							? 'Wrong email or password.'
							: (res.error.message ?? 'That did not work. Try again.');
				return;
			}
			password = '';
			await getGame().refresh();
			open = false;
		} finally {
			busy = false;
		}
	}

	async function signOut() {
		busy = true;
		try {
			await authClient.signOut();
			await getGame().refresh();
			open = false;
		} finally {
			busy = false;
		}
	}
</script>

<Sheet
	bind:open
	title={view.signedIn ? 'Your streak' : mode === 'signup' ? 'Save your progress' : 'Welcome back'}
	description={view.signedIn
		? (view.email ?? undefined)
		: mode === 'signup'
			? 'Keep your games and start a daily streak, on any device.'
			: 'Sign in to pick up your streak.'}
>
	{#if view.signedIn}
		<p class="type-display-sm-emphasized text-on-surface type-numeric">
			{view.streak}
			<span class="type-title-md text-on-surface-variant"
				>{view.streak === 1 ? 'day' : 'days'} in a row</span
			>
		</p>
		<Button variant="text" size="sm" class="mt-6 -ml-3" disabled={busy} onclick={signOut}>
			Sign out
		</Button>
	{:else}
		<form class="flex flex-col gap-4" onsubmit={submit}>
			<TextField
				class="w-full"
				label="Email"
				type="email"
				autocomplete="email"
				required
				bind:value={email}
			/>
			<TextField
				class="w-full"
				label="Password"
				type="password"
				autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
				minlength={8}
				required
				supportingText={mode === 'signup' ? 'At least 8 characters' : undefined}
				bind:value={password}
			/>
			{#if error}
				<p class="type-body-sm text-error" role="alert">{error}</p>
			{/if}
			<Button type="submit" variant="filled" size="md" disabled={busy}>
				{mode === 'signup' ? 'Create account' : 'Sign in'}
			</Button>
			<Button
				type="button"
				variant="text"
				size="sm"
				onclick={() => {
					mode = mode === 'signup' ? 'signin' : 'signup';
					error = null;
				}}
			>
				{mode === 'signup' ? 'I already have an account' : 'New here? Create an account'}
			</Button>
		</form>
	{/if}
</Sheet>
