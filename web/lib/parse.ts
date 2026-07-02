import type { Concept, LlmImport, Track } from './types';

/** Stable dedup key: lowercase title+artist with punctuation stripped. */
export function normalizeKey(title: string, artist: string): string {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ');
  return `${clean(title)}::${clean(artist)}`;
}

/** Extract the first valid JSON object from messy LLM output. */
export function extractJson(text: string): unknown | null {
  const candidates: string[] = [text.trim()];

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) candidates.push(fence[1].trim());

  const braces = text.match(/\{[\s\S]*\}/);
  if (braces) candidates.push(braces[0]);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function safePosition(value: unknown, fallback: number): number {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

export type ParseResult =
  | { ok: true; import: LlmImport; skipped: number }
  | { ok: false; error: string };

export function parseLlmResponse(raw: string, source: string): ParseResult {
  const data = extractJson(raw) as Record<string, unknown> | null;
  if (!data) {
    return { ok: false, error: 'No valid JSON found. Make sure the model followed the strict-JSON instruction.' };
  }
  if (!Array.isArray(data.tracks)) {
    return { ok: false, error: 'JSON is valid but has no "tracks" array.' };
  }

  const tracks: Track[] = [];
  let skipped = 0;
  for (const item of data.tracks) {
    if (!item || typeof item !== 'object') {
      skipped++;
      continue;
    }
    const t = item as Record<string, unknown>;
    const title = str(t.title);
    const artist = str(t.artist);
    if (!title || !artist) {
      skipped++;
      continue;
    }
    tracks.push({
      key: normalizeKey(title, artist),
      position: safePosition(t.position, tracks.length + 1),
      title,
      artist,
      album: str(t.album),
      why: str(t.why_this_track),
      cinematicMoment: str(t.cinematic_moment),
      energy: str(t.energy, 'medium'),
    });
  }

  if (tracks.length === 0) {
    return { ok: false, error: 'No usable tracks — every entry was missing a title or artist.' };
  }

  const movie = (data.movie_concept ?? {}) as Record<string, unknown>;
  const concept: Concept = {
    playlistTitle: str(data.playlist_title, `${source} Soundtrack`),
    playlistDescription: str(data.playlist_description),
    movieTitle: str(movie.title),
    logline: str(movie.logline),
    genre: str(movie.genre),
    tone: str(movie.tone),
    moodTags: Array.isArray(data.mood_tags) ? data.mood_tags.filter((m): m is string => typeof m === 'string') : [],
    narrativeArc: str(data.narrative_arc),
  };

  return { ok: true, import: { source, concept, tracks }, skipped };
}
