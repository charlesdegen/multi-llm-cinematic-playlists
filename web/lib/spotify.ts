import { matchConfidence } from './similarity';
import type { SpotifyTrackResult } from './types';

/**
 * Spotify auth via Authorization Code + PKCE — runs entirely in the browser,
 * so no client secret is ever required or stored anywhere.
 */

const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';
const SCOPES = 'playlist-modify-private playlist-modify-public';

const KEYS = {
  clientId: 'spotify_client_id',
  verifier: 'spotify_pkce_verifier',
  token: 'spotify_token',
} as const;

interface StoredToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

export function getClientId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(KEYS.clientId) ?? '';
}

export function setClientId(id: string): void {
  localStorage.setItem(KEYS.clientId, id.trim());
}

export function redirectUri(): string {
  return `${window.location.origin}/callback`;
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function readToken(): StoredToken | null {
  const raw = localStorage.getItem(KEYS.token);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredToken;
  } catch {
    return null;
  }
}

function storeTokenResponse(data: { access_token: string; refresh_token?: string; expires_in: number }): void {
  const prev = readToken();
  const token: StoredToken = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? prev?.refreshToken ?? '',
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  localStorage.setItem(KEYS.token, JSON.stringify(token));
}

export function isConnected(): boolean {
  if (typeof window === 'undefined') return false;
  return readToken() !== null;
}

export function disconnect(): void {
  localStorage.removeItem(KEYS.token);
  localStorage.removeItem(KEYS.verifier);
}

/** Kick off the PKCE flow — redirects the browser to Spotify. */
export async function beginAuth(clientId: string): Promise<void> {
  setClientId(clientId);
  const verifierBytes = new Uint8Array(64);
  crypto.getRandomValues(verifierBytes);
  const verifier = base64Url(verifierBytes);
  localStorage.setItem(KEYS.verifier, verifier);

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64Url(new Uint8Array(digest));

  const params = new URLSearchParams({
    client_id: clientId.trim(),
    response_type: 'code',
    redirect_uri: redirectUri(),
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });
  window.location.assign(`${AUTH_URL}?${params}`);
}

/** Complete the PKCE flow on the /callback page. */
export async function exchangeCode(code: string): Promise<void> {
  const verifier = localStorage.getItem(KEYS.verifier);
  const clientId = getClientId();
  if (!verifier || !clientId) {
    throw new Error('Auth session was lost — start the connection again.');
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      client_id: clientId,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${body}`);
  }
  storeTokenResponse(await res.json());
  localStorage.removeItem(KEYS.verifier);
}

async function refreshToken(token: StoredToken): Promise<StoredToken> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken,
      client_id: getClientId(),
    }),
  });
  if (!res.ok) {
    disconnect();
    throw new Error('Spotify session expired — reconnect to continue.');
  }
  storeTokenResponse(await res.json());
  const refreshed = readToken();
  if (!refreshed) throw new Error('Failed to store refreshed token.');
  return refreshed;
}

async function getAccessToken(): Promise<string> {
  let token = readToken();
  if (!token) throw new Error('Not connected to Spotify.');
  if (Date.now() >= token.expiresAt) {
    if (!token.refreshToken) {
      disconnect();
      throw new Error('Spotify session expired — reconnect to continue.');
    }
    token = await refreshToken(token);
  }
  return token.accessToken;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Authorized fetch against the Web API; retries once on 429 honoring Retry-After. */
async function api(path: string, init?: RequestInit, retries = 2): Promise<Response> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  });
  if (res.status === 429 && retries > 0) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? 1);
    await sleep(Math.min(retryAfter, 10) * 1000);
    return api(path, init, retries - 1);
  }
  return res;
}

interface RawSpotifyTrack {
  uri: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  external_urls: { spotify: string };
}

function toResult(t: RawSpotifyTrack): SpotifyTrackResult {
  return {
    uri: t.uri,
    name: t.name,
    artists: t.artists.map((a) => a.name),
    album: t.album.name,
    albumArt: t.album.images.at(-1)?.url ?? t.album.images[0]?.url ?? null,
    url: t.external_urls.spotify,
  };
}

/**
 * Search for a track. Tries a fielded query first, then a loose one,
 * and returns candidates sorted by match confidence.
 */
export async function searchTrack(
  title: string,
  artist: string,
): Promise<{ results: SpotifyTrackResult[]; confidence: number }> {
  const queries = [`track:"${title}" artist:"${artist}"`, `${title} ${artist}`];
  for (const q of queries) {
    const res = await api(`/search?${new URLSearchParams({ q, type: 'track', limit: '5' })}`);
    if (!res.ok) throw new Error(`Search failed (${res.status})`);
    const data = await res.json();
    const items: RawSpotifyTrack[] = data.tracks?.items ?? [];
    if (items.length === 0) continue;
    const scored = items
      .map(toResult)
      .map((r) => ({ r, score: matchConfidence({ title, artist }, r) }))
      .sort((a, b) => b.score - a.score);
    return { results: scored.map((s) => s.r), confidence: scored[0].score };
  }
  return { results: [], confidence: 0 };
}

/** Create a private playlist and add tracks in batches of 100. Returns its URL. */
export async function createPlaylist(name: string, description: string, uris: string[]): Promise<string> {
  const res = await api('/me/playlists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description: description.slice(0, 300), public: false }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Playlist creation failed (${res.status}): ${body}`);
  }
  const playlist = await res.json();

  for (let i = 0; i < uris.length; i += 100) {
    const batch = uris.slice(i, i + 100);
    const add = await api(`/playlists/${playlist.id}/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: batch }),
    });
    if (!add.ok) throw new Error(`Adding tracks failed (${add.status})`);
  }

  return playlist.external_urls.spotify as string;
}
