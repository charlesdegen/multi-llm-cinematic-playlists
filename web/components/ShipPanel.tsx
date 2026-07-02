'use client';

import { useEffect, useState } from 'react';
import {
  beginAuth,
  createPlaylist,
  disconnect,
  getClientId,
  isConnected,
  redirectUri,
  searchTrack,
} from '@/lib/spotify';
import type { MergedTrack, TrackMatch } from '@/lib/types';

interface Props {
  tracks: MergedTrack[];
  defaultName: string;
  defaultDescription: string;
  onToast: (message: string, kind?: 'info' | 'error') => void;
}

function ConfidencePill({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  if (value >= 0.8) return <span className="pill pill-good">High · {pct}%</span>;
  if (value >= 0.55) return <span className="pill pill-warn">Check · {pct}%</span>;
  return <span className="pill pill-bad">Low · {pct}%</span>;
}

export function ShipPanel({ tracks, defaultName, defaultDescription, onToast }: Props) {
  const [connected, setConnected] = useState(false);
  const [clientId, setClientIdState] = useState('');
  const [matches, setMatches] = useState<Record<string, TrackMatch>>({});
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState(defaultDescription);
  const [creating, setCreating] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setConnected(isConnected());
    setClientIdState(getClientId());
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => setName(defaultName), [defaultName]);
  useEffect(() => setDescription(defaultDescription), [defaultDescription]);

  const handleConnect = async () => {
    if (!clientId.trim()) {
      onToast('Enter your Spotify Client ID first.', 'error');
      return;
    }
    await beginAuth(clientId);
  };

  const handleDisconnect = () => {
    disconnect();
    setConnected(false);
    setMatches({});
    onToast('Disconnected from Spotify.');
  };

  const findMatches = async () => {
    setProgress({ done: 0, total: tracks.length });
    setCreatedUrl(null);
    const next: Record<string, TrackMatch> = {};
    let done = 0;
    for (const t of tracks) {
      try {
        const { results, confidence } = await searchTrack(t.title, t.artist);
        next[t.key] =
          results.length > 0
            ? { status: 'matched', results, chosen: 0, confidence, include: true }
            : { status: 'not_found', results: [], chosen: 0, confidence: 0, include: false };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        next[t.key] = { status: 'error', results: [], chosen: 0, confidence: 0, include: false, error: message };
        if (message.includes('reconnect')) {
          setConnected(false);
          onToast(message, 'error');
          break;
        }
      }
      done++;
      setProgress({ done, total: tracks.length });
      setMatches({ ...next });
    }
    setProgress(null);
    const found = Object.values(next).filter((m) => m.status === 'matched').length;
    onToast(`Matched ${found} of ${tracks.length} tracks on Spotify.`);
  };

  const setMatch = (key: string, patch: Partial<TrackMatch>) => {
    setMatches((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const includedUris = tracks
    .map((t) => matches[t.key])
    .filter((m): m is TrackMatch => !!m && m.status === 'matched' && m.include)
    .map((m) => m.results[m.chosen].uri);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const url = await createPlaylist(name.trim() || 'Multi-LLM Cinematic Soundtrack', description, includedUris);
      setCreatedUrl(url);
      onToast('Playlist created — check your Spotify library.');
    } catch (e) {
      onToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setCreating(false);
    }
  };

  const hasMatches = Object.keys(matches).length > 0;

  return (
    <section className="glass card" aria-labelledby="step-ship">
      <div className="card-header spread row">
        <div className="row">
          <span className="step-badge" aria-hidden>
            3
          </span>
          <h2 id="step-ship" className="type-title2">
            Ship to Spotify
          </h2>
        </div>
        {connected ? (
          <div className="row">
            <span className="pill pill-good">Connected</span>
            <button className="btn btn-compact" onClick={handleDisconnect}>
              Disconnect
            </button>
          </div>
        ) : (
          <span className="pill">Not connected</span>
        )}
      </div>

      {!connected && (
        <div className="stack" style={{ maxWidth: 520 }}>
          <div>
            <label className="field-label" htmlFor="client-id">
              Spotify Client ID
            </label>
            <input
              id="client-id"
              type="text"
              value={clientId}
              onChange={(e) => setClientIdState(e.target.value)}
              placeholder="From developer.spotify.com/dashboard"
              autoComplete="off"
            />
          </div>
          <p className="type-footnote">
            Uses Authorization Code with PKCE — no client secret needed, and your token never leaves this browser. Add{' '}
            <code>{origin ? `${origin}/callback` : '/callback'}</code> as a Redirect URI in your Spotify app settings.
          </p>
          <button className="btn btn-primary" onClick={handleConnect} style={{ alignSelf: 'flex-start' }}>
            Connect to Spotify
          </button>
        </div>
      )}

      {connected && (
        <div className="stack" style={{ gap: 'var(--sp-4)' }}>
          <div className="row">
            <button className="btn btn-primary" onClick={findMatches} disabled={progress !== null || tracks.length === 0}>
              {progress ? `Matching ${progress.done} of ${progress.total}…` : hasMatches ? 'Re-run matching' : 'Find matches on Spotify'}
            </button>
            {hasMatches && !progress && (
              <span className="type-footnote">Review each match below, swap alternates, then create the playlist.</span>
            )}
          </div>

          {hasMatches && (
            <div className="glass-elevated" role="list" aria-label="Spotify matches">
              {tracks.map((t, i) => {
                const m = matches[t.key];
                if (!m) return null;
                const chosen = m.status === 'matched' ? m.results[m.chosen] : null;
                return (
                  <div key={t.key} className="match-row" role="listitem">
                    <input
                      type="checkbox"
                      checked={m.include}
                      disabled={m.status !== 'matched'}
                      aria-label={`Include ${t.title} in the playlist`}
                      onChange={(e) => setMatch(t.key, { include: e.target.checked })}
                    />
                    {chosen?.albumArt ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="match-art" src={chosen.albumArt} alt="" />
                    ) : (
                      <span className="match-art-empty" aria-hidden />
                    )}
                    <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                      <span className="type-headline" style={{ fontSize: 15 }}>
                        {i + 1}. {t.title} — {t.artist}
                      </span>
                      {m.status === 'matched' && m.results.length > 0 ? (
                        <select
                          value={m.chosen}
                          aria-label={`Spotify match for ${t.title}`}
                          style={{ maxWidth: 420, padding: '4px 8px', fontSize: 13 }}
                          onChange={(e) => setMatch(t.key, { chosen: Number(e.target.value) })}
                        >
                          {m.results.map((r, idx) => (
                            <option key={r.uri} value={idx}>
                              {r.name} — {r.artists.join(', ')} ({r.album})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="type-footnote">
                          {m.status === 'error' ? `Error: ${m.error}` : 'Not found on Spotify — it will be skipped.'}
                        </span>
                      )}
                    </div>
                    {m.status === 'matched' && <ConfidencePill value={m.confidence} />}
                  </div>
                );
              })}
            </div>
          )}

          {hasMatches && (
            <div className="stack" style={{ maxWidth: 560 }}>
              <div>
                <label className="field-label" htmlFor="playlist-name">
                  Playlist name
                </label>
                <input id="playlist-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="field-label" htmlFor="playlist-desc">
                  Description
                </label>
                <textarea
                  id="playlist-desc"
                  rows={3}
                  value={description}
                  maxLength={300}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <button
                className="btn btn-spotify"
                onClick={handleCreate}
                disabled={creating || includedUris.length === 0}
                style={{ alignSelf: 'flex-start' }}
              >
                {creating ? 'Creating…' : `Create private playlist (${includedUris.length} tracks)`}
              </button>
            </div>
          )}

          {createdUrl && (
            <div className="glass-elevated" style={{ padding: 'var(--sp-4)' }}>
              <p className="type-headline" style={{ marginBottom: 'var(--sp-1)' }}>
                Your soundtrack is live.
              </p>
              <a href={createdUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--spotify)', fontWeight: 600 }}>
                Open in Spotify ↗
              </a>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
