/**
 * Which puzzle is today's. One puzzle per calendar day in PUZZLE_TIME_ZONE (US Eastern), rolling
 * over at local midnight, so DST changes never skip or repeat a puzzle.
 */
import { LAUNCH_DATE, PUZZLE_TIME_ZONE } from './config.ts';

const DAY_MS = 86_400_000;

const clock = new Intl.DateTimeFormat('en-US', {
  timeZone: PUZZLE_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** The wall clock in the puzzle time zone at `date`, as epoch ms of that time in UTC. */
function wallClock(date: Date): number {
  const p = Object.fromEntries(clock.formatToParts(date).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

/**
 * 1-based puzzle number for `date`. Puzzle #1 is LAUNCH_DATE. Before launch this returns 1, so
 * previews and countdown pages always have a real puzzle to show; the game never has a #0.
 */
export function puzzleNumberFor(date: Date): number {
  const days = Math.floor(wallClock(date) / DAY_MS) - Date.parse(LAUNCH_DATE) / DAY_MS;
  return Math.max(1, days + 1);
}

/** Calendar date (YYYY-MM-DD) of puzzle `number`. */
export function dateForNumber(number: number): string {
  return new Date(Date.parse(LAUNCH_DATE) + (number - 1) * DAY_MS).toISOString().slice(0, 10);
}

/** The instant of midnight starting `isoDate` in the puzzle time zone. */
export function midnightIn(isoDate: string): Date {
  const target = Date.parse(isoDate);
  // Guess, read the wall clock there, correct by the offset; twice covers a DST change between.
  let guess = target;
  for (let i = 0; i < 2; i++) guess += target - wallClock(new Date(guess));
  return new Date(guess);
}
