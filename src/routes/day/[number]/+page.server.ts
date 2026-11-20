import { error, redirect } from '@sveltejs/kit';
import { todayNumber } from '#lib/server/game/play.ts';
import type { PageServerLoad } from './$types';

// A past day from the archive. Today's (or a future) number goes to the home page instead.
export const load: PageServerLoad = ({ params }) => {
  const number = Number(params.number);
  if (!Number.isInteger(number) || number < 1) error(404, 'That chart is not in the archive.');
  if (number >= todayNumber()) redirect(307, '/');
  return { number };
};
