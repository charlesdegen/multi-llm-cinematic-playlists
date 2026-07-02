export interface Track {
  key: string;
  position: number;
  title: string;
  artist: string;
  album: string;
  why: string;
  cinematicMoment: string;
  energy: string;
}

export interface Concept {
  playlistTitle: string;
  playlistDescription: string;
  movieTitle: string;
  logline: string;
  genre: string;
  tone: string;
  moodTags: string[];
  narrativeArc: string;
}

export interface LlmImport {
  source: string;
  concept: Concept;
  tracks: Track[];
}

export interface MergedTrack {
  key: string;
  title: string;
  artist: string;
  album: string;
  why: string;
  cinematicMoment: string;
  energy: string;
  sources: string[];
  positions: number[];
  votes: number;
  avgPosition: number;
}

export type SortMode = 'narrative' | 'consensus';

export interface SpotifyTrackResult {
  uri: string;
  name: string;
  artists: string[];
  album: string;
  albumArt: string | null;
  url: string;
}

export interface TrackMatch {
  status: 'pending' | 'searching' | 'matched' | 'not_found' | 'error';
  results: SpotifyTrackResult[];
  /** Index into results of the currently chosen match. */
  chosen: number;
  confidence: number;
  include: boolean;
  error?: string;
}
