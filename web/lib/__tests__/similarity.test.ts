import { describe, expect, it } from 'vitest';
import { diceSimilarity, matchConfidence } from '../similarity';

describe('diceSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(diceSimilarity('Time', 'Time')).toBe(1);
  });

  it('ignores case, punctuation, and parenthetical noise', () => {
    expect(diceSimilarity('Time (Remastered 2020)', 'time')).toBe(1);
    expect(diceSimilarity('The Night King [OST]', 'the night king')).toBe(1);
  });

  it('returns 0 for empty input', () => {
    expect(diceSimilarity('', 'Time')).toBe(0);
  });

  it('scores near-matches higher than mismatches', () => {
    const near = diceSimilarity('Night King', 'The Night King');
    const far = diceSimilarity('Night King', 'Sandstorm');
    expect(near).toBeGreaterThan(0.6);
    expect(far).toBeLessThan(0.2);
  });
});

describe('matchConfidence', () => {
  it('weights title over artist and takes the best credited artist', () => {
    const high = matchConfidence(
      { title: 'Time', artist: 'Hans Zimmer' },
      { name: 'Time', artists: ['Hans Zimmer', 'Satellite Empire'] },
    );
    expect(high).toBeGreaterThan(0.95);

    const wrongArtist = matchConfidence({ title: 'Time', artist: 'Hans Zimmer' }, { name: 'Time', artists: ['Pink Floyd'] });
    expect(wrongArtist).toBeGreaterThan(0.5);
    expect(wrongArtist).toBeLessThan(high);
  });

  it('handles results with no artists', () => {
    expect(matchConfidence({ title: 'Time', artist: 'Hans Zimmer' }, { name: 'Time', artists: [] })).toBeCloseTo(0.6);
  });
});
