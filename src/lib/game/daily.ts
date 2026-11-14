/**
 * Which puzzle is today's. One puzzle per calendar day in PUZZLE_TIME_ZONE (US Eastern), rolling
 * over at local midnight, so DST changes never skip or repeat a puzzle.
 */
import { LAUNCH_DATE, PUZZLE_TIME_ZONE } from './config.ts';

const DAY_MS = 86_400_000;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
	let formatter = formatters.get(timeZone);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat('en-US', {
			timeZone,
			hourCycle: 'h23',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
		formatters.set(timeZone, formatter);
	}
	return formatter;
}

interface WallClock {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
}

function wallClock(date: Date, timeZone: string): WallClock {
	if (Number.isNaN(date.getTime())) throw new RangeError('Invalid Date');
	const parts: Record<string, number> = {};
	for (const part of formatterFor(timeZone).formatToParts(date)) {
		if (part.type !== 'literal') parts[part.type] = Number(part.value);
	}
	return {
		year: parts.year,
		month: parts.month,
		day: parts.day,
		hour: parts.hour,
		minute: parts.minute,
		second: parts.second
	};
}

function pad(value: number, width = 2): string {
	return String(value).padStart(width, '0');
}

/** "YYYY-MM-DD" for `date` as seen in the puzzle time zone. */
export function easternDateString(date: Date, timeZone: string = PUZZLE_TIME_ZONE): string {
	const { year, month, day } = wallClock(date, timeZone);
	return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** Days since 1970-01-01 for a "YYYY-MM-DD" calendar date (no time zone involved). */
function dayNumber(isoDate: string): number {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
	if (!match) throw new RangeError(`expected YYYY-MM-DD, got ${isoDate}`);
	return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS;
}

/**
 * Calendar days from launch to `date` in the puzzle time zone: 0 on launch day, negative before.
 */
export function daysSinceLaunch(date: Date, launchDate: string = LAUNCH_DATE): number {
	return dayNumber(easternDateString(date)) - dayNumber(launchDate);
}

/**
 * 1-based puzzle number for `date`. Puzzle #1 is LAUNCH_DATE. Before launch this returns 1, so
 * previews and countdown pages always have a real puzzle to show; the game never has a #0.
 */
export function puzzleNumberFor(date: Date, launchDate: string = LAUNCH_DATE): number {
	return Math.max(1, daysSinceLaunch(date, launchDate) + 1);
}

/** Catalog index (0-based) for a puzzle number. Puzzles play in order and cycle when exhausted. */
export function puzzleIndexFor(puzzleNumber: number, catalogLength: number): number {
	if (!Number.isSafeInteger(puzzleNumber) || puzzleNumber < 1) {
		throw new RangeError(`puzzle number must be a positive integer, got ${puzzleNumber}`);
	}
	if (!Number.isSafeInteger(catalogLength) || catalogLength < 1) {
		throw new RangeError(`catalog must have at least one puzzle, got ${catalogLength}`);
	}
	return (puzzleNumber - 1) % catalogLength;
}

/** The UTC instant of midnight starting `isoDate` in `timeZone`. */
export function midnightIn(isoDate: string, timeZone: string = PUZZLE_TIME_ZONE): Date {
	const target = dayNumber(isoDate) * DAY_MS;
	// Guess, read the wall clock there, correct by the offset; twice covers a DST change between.
	let guess = target;
	for (let i = 0; i < 2; i++) {
		const wall = wallClock(new Date(guess), timeZone);
		const wallMs = Date.UTC(
			wall.year,
			wall.month - 1,
			wall.day,
			wall.hour,
			wall.minute,
			wall.second
		);
		guess += target - wallMs;
	}
	return new Date(guess);
}

/** Milliseconds from `date` until the next puzzle unlocks (next midnight in the puzzle zone). */
export function msUntilNextPuzzle(date: Date, timeZone: string = PUZZLE_TIME_ZONE): number {
	const today = dayNumber(easternDateString(date, timeZone));
	const tomorrow = new Date((today + 1) * DAY_MS).toISOString().slice(0, 10);
	return midnightIn(tomorrow, timeZone).getTime() - date.getTime();
}

export interface TodayPuzzle {
	/** 1-based puzzle number. */
	number: number;
	/** Eastern calendar date, YYYY-MM-DD. */
	date: string;
	/** 0-based catalog position. */
	position: number;
	/** Epoch ms when the next puzzle unlocks. */
	nextPuzzleAt: number;
}

/** Everything the server needs about today's puzzle, for a catalog of `catalogLength` puzzles. */
export function todayPuzzle(now: Date, catalogLength: number): TodayPuzzle {
	const number = puzzleNumberFor(now);
	return {
		number,
		date: easternDateString(now),
		position: puzzleIndexFor(number, catalogLength),
		nextPuzzleAt: now.getTime() + msUntilNextPuzzle(now)
	};
}
