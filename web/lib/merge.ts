import type { LlmImport, MergedTrack, SortMode } from './types';

/**
 * Merge tracklists from multiple models into one deduplicated list.
 *
 * - narrative: average recommended position (preserves the 4-act arc the prompt asks for)
 * - consensus: cross-model vote count first, then average position
 */
export function mergeTracks(imports: LlmImport[], sortMode: SortMode = 'narrative'): MergedTrack[] {
  const merged = new Map<string, MergedTrack>();

  for (const imp of imports) {
    for (const t of imp.tracks) {
      const existing = merged.get(t.key);
      if (!existing) {
        merged.set(t.key, {
          key: t.key,
          title: t.title,
          artist: t.artist,
          album: t.album,
          why: t.why,
          cinematicMoment: t.cinematicMoment,
          energy: t.energy,
          sources: [imp.source],
          positions: [t.position],
          votes: 1,
          avgPosition: t.position,
        });
      } else {
        if (!existing.sources.includes(imp.source)) {
          existing.sources.push(imp.source);
          existing.votes++;
          existing.positions.push(t.position);
        }
        if (!existing.why && t.why) existing.why = t.why;
        if (!existing.cinematicMoment && t.cinematicMoment) existing.cinematicMoment = t.cinematicMoment;
        if (!existing.album && t.album) existing.album = t.album;
      }
    }
  }

  const tracks = [...merged.values()];
  for (const t of tracks) {
    t.avgPosition = t.positions.reduce((a, b) => a + b, 0) / t.positions.length;
  }

  tracks.sort((a, b) => {
    if (sortMode === 'consensus' && a.votes !== b.votes) return b.votes - a.votes;
    if (a.avgPosition !== b.avgPosition) return a.avgPosition - b.avgPosition;
    if (a.votes !== b.votes) return b.votes - a.votes;
    return a.title.localeCompare(b.title);
  });

  return tracks;
}
