/** Sound settings, kept in this browser. Effects start on; the night ambience is opt-in. */
export type AudioPrefs = { effects: boolean; ambience: boolean };

export const PREFS_KEY = 'thewolf:audio';
export const DEFAULT_PREFS: AudioPrefs = { effects: true, ambience: false };

/** Reads the stored settings, falling back to the defaults for anything missing or broken. */
export function parsePrefs(raw: string | null): AudioPrefs {
  if (!raw) return { ...DEFAULT_PREFS };
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return { ...DEFAULT_PREFS };
    const o = v as Record<string, unknown>;
    return {
      effects: typeof o.effects === 'boolean' ? o.effects : DEFAULT_PREFS.effects,
      ambience: typeof o.ambience === 'boolean' ? o.ambience : DEFAULT_PREFS.ambience,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}
