/** Sørensen–Dice similarity over character bigrams, 0..1. */
export function diceSimilarity(a: string, b: string): number {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/\(.*?\)|\[.*?\]/g, ' ') // drop "(Remastered)", "[Original Soundtrack]" noise
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return x === y ? 1 : 0;

  const bigrams = (s: string) => {
    const map = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      map.set(bg, (map.get(bg) ?? 0) + 1);
    }
    return map;
  };

  const bx = bigrams(x);
  const by = bigrams(y);
  let overlap = 0;
  for (const [bg, count] of bx) {
    overlap += Math.min(count, by.get(bg) ?? 0);
  }
  return (2 * overlap) / (x.length - 1 + y.length - 1);
}

/**
 * Confidence that a Spotify result matches the requested track.
 * Title dominates; artist is compared against every credited artist.
 */
export function matchConfidence(
  wanted: { title: string; artist: string },
  found: { name: string; artists: string[] },
): number {
  const titleScore = diceSimilarity(wanted.title, found.name);
  const artistScore = found.artists.length
    ? Math.max(...found.artists.map((a) => diceSimilarity(wanted.artist, a)))
    : 0;
  return 0.6 * titleScore + 0.4 * artistScore;
}
