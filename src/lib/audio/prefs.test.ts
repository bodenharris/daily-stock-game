import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, parsePrefs } from './prefs.ts';

describe('parsePrefs', () => {
	it('defaults to effects on, ambience off', () => {
		expect(parsePrefs(null)).toEqual({ effects: true, ambience: false });
		expect(DEFAULT_PREFS).toEqual({ effects: true, ambience: false });
	});

	it('keeps stored choices', () => {
		expect(parsePrefs('{"effects":false,"ambience":true}')).toEqual({
			effects: false,
			ambience: true
		});
	});

	it('fills in missing or wrong-typed fields', () => {
		expect(parsePrefs('{"ambience":true}')).toEqual({ effects: true, ambience: true });
		expect(parsePrefs('{"effects":"no","ambience":1}')).toEqual(DEFAULT_PREFS);
	});

	it('survives junk', () => {
		expect(parsePrefs('not json')).toEqual(DEFAULT_PREFS);
		expect(parsePrefs('null')).toEqual(DEFAULT_PREFS);
		expect(parsePrefs('[1]')).toEqual(DEFAULT_PREFS);
	});
});
