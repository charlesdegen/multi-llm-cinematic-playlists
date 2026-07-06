import { describe, expect, it } from 'vitest';
import { extractJson, normalizeKey, parseLlmResponse } from '../parse';

const VALID = JSON.stringify({
  playlist_title: 'Test OST',
  playlist_description: 'desc',
  movie_concept: { title: 'FILM', logline: 'A story.', genre: 'thriller', tone: 'cold' },
  mood_tags: ['dark', 42, 'cold'],
  narrative_arc: 'rise and fall',
  tracks: [
    { position: 1, title: 'Time', artist: 'Hans Zimmer', album: 'Inception', why_this_track: 'w', cinematic_moment: 'c', energy: 'low' },
    { position: '2', title: 'Song Two', artist: 'Artist', why_this_track: 'w2' },
    { position: 'not-a-number', title: 'Song Three', artist: 'Artist' },
    { title: '', artist: 'Nobody' },
    'garbage',
  ],
});

describe('normalizeKey', () => {
  it('is stable across case, punctuation, and whitespace', () => {
    expect(normalizeKey('Time!', 'Hans  Zimmer')).toBe(normalizeKey('time', 'hans zimmer'));
  });

  it('keeps unicode letters', () => {
    expect(normalizeKey('École', 'Sigur Rós')).toBe('école::sigur rós');
  });
});

describe('extractJson', () => {
  it('parses direct JSON', () => {
    expect(extractJson('{"a": 1}')).toEqual({ a: 1 });
  });

  it('parses fenced JSON', () => {
    expect(extractJson('Here you go:\n```json\n{"a": 1}\n```\nEnjoy!')).toEqual({ a: 1 });
  });

  it('parses embedded JSON with preamble', () => {
    expect(extractJson('Sure! {"a": {"b": 2}} hope that helps')).toEqual({ a: { b: 2 } });
  });

  it('returns null for garbage', () => {
    expect(extractJson('no json here')).toBeNull();
  });
});

describe('parseLlmResponse', () => {
  it('parses a full response and skips malformed tracks', () => {
    const result = parseLlmResponse(VALID, 'Claude');
    if (!result.ok) throw new Error('expected ok');
    expect(result.import.tracks).toHaveLength(3);
    expect(result.skipped).toBe(2);
    expect(result.import.concept.playlistTitle).toBe('Test OST');
    expect(result.import.concept.moodTags).toEqual(['dark', 'cold']);
  });

  it('falls back safely on non-numeric positions', () => {
    const result = parseLlmResponse(VALID, 'Claude');
    if (!result.ok) throw new Error('expected ok');
    expect(result.import.tracks[1].position).toBe(2);
    expect(result.import.tracks[2].position).toBe(3);
  });

  it('rejects JSON without tracks', () => {
    const result = parseLlmResponse('{"playlist_title": "x"}', 'GPT');
    expect(result.ok).toBe(false);
  });

  it('rejects non-JSON text', () => {
    const result = parseLlmResponse('I cannot produce JSON right now.', 'GPT');
    expect(result.ok).toBe(false);
  });
});
