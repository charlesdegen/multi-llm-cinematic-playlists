import type { LlmImport, MergedTrack, SortMode } from './types';

const SESSION_KEY = 'mlcp_session_v1';

export interface Session {
  imports: LlmImport[];
  curated: MergedTrack[] | null;
  sortMode: SortMode;
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // localStorage full or unavailable — session persistence is best-effort
  }
}

export function loadSession(): Session | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if (!Array.isArray(parsed.imports)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

function download(filename: string, mime: string, content: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportTracksJson(tracks: MergedTrack[]): void {
  const payload = tracks.map((t, i) => ({
    position: i + 1,
    title: t.title,
    artist: t.artist,
    album: t.album,
    why_this_track: t.why,
    cinematic_moment: t.cinematicMoment,
    energy: t.energy,
    recommended_by: t.sources,
    votes: t.votes,
  }));
  download('soundtrack.json', 'application/json', JSON.stringify(payload, null, 2));
}

export function exportTracksCsv(tracks: MergedTrack[]): void {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const header = 'position,title,artist,album,why,recommended_by,votes';
  const rows = tracks.map((t, i) =>
    [i + 1, esc(t.title), esc(t.artist), esc(t.album), esc(t.why), esc(t.sources.join('; ')), t.votes].join(','),
  );
  download('soundtrack.csv', 'text/csv', [header, ...rows].join('\n'));
}

export function exportSession(session: Session): void {
  download('playlist-session.json', 'application/json', JSON.stringify(session, null, 2));
}
