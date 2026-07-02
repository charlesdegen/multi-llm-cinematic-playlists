import { describe, expect, it } from 'vitest';
import { mergeTracks } from '../merge';
import { normalizeKey } from '../parse';
import type { LlmImport, Track } from '../types';

const track = (title: string, artist: string, position: number, extra: Partial<Track> = {}): Track => ({
  key: normalizeKey(title, artist),
  position,
  title,
  artist,
  album: '',
  why: '',
  cinematicMoment: '',
  energy: 'medium',
  ...extra,
});

const imp = (source: string, tracks: Track[]): LlmImport => ({
  source,
  concept: {
    playlistTitle: '',
    playlistDescription: '',
    movieTitle: '',
    logline: '',
    genre: '',
    tone: '',
    moodTags: [],
    narrativeArc: '',
  },
  tracks,
});

describe('mergeTracks', () => {
  it('deduplicates across sources and counts votes', () => {
    const merged = mergeTracks([
      imp('Claude', [track('Time', 'Hans Zimmer', 1), track('Solo', 'Only Claude', 2)]),
      imp('GPT', [track('TIME!', 'Hans Zimmer', 3)]),
    ]);
    expect(merged).toHaveLength(2);
    const time = merged.find((t) => t.title === 'Time');
    expect(time?.votes).toBe(2);
    expect(time?.sources).toEqual(['Claude', 'GPT']);
    expect(time?.avgPosition).toBe(2);
  });

  it('narrative mode orders by average position', () => {
    const merged = mergeTracks(
      [imp('Claude', [track('Late', 'A', 10), track('Early', 'B', 1)])],
      'narrative',
    );
    expect(merged.map((t) => t.title)).toEqual(['Early', 'Late']);
  });

  it('consensus mode puts multi-model tracks first', () => {
    const merged = mergeTracks(
      [
        imp('Claude', [track('Solo Early', 'A', 1), track('Shared Late', 'B', 20)]),
        imp('GPT', [track('Shared Late', 'B', 19)]),
      ],
      'consensus',
    );
    expect(merged[0].title).toBe('Shared Late');
    expect(merged[0].votes).toBe(2);
  });

  it('backfills missing metadata from later sources', () => {
    const merged = mergeTracks([
      imp('Claude', [track('Time', 'Hans Zimmer', 1)]),
      imp('GPT', [track('Time', 'Hans Zimmer', 1, { why: 'because', album: 'Inception' })]),
    ]);
    expect(merged[0].why).toBe('because');
    expect(merged[0].album).toBe('Inception');
  });

  it('does not double-count the same source imported once', () => {
    const merged = mergeTracks([imp('Claude', [track('Time', 'Hans Zimmer', 1), track('Time', 'Hans Zimmer', 5)])]);
    expect(merged).toHaveLength(1);
    expect(merged[0].votes).toBe(1);
  });
});
