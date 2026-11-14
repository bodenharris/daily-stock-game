import { error } from '@sveltejs/kit';
import { dev } from '$app/env';
import type { PageLoad } from './$types';

// DEV ONLY: the design-system showcase is not part of the game and 404s in production builds.
export const load: PageLoad = () => {
	if (!dev) error(404, 'Not found');
};
