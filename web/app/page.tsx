'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ConceptCards } from '@/components/ConceptCards';
import { ImportPanel } from '@/components/ImportPanel';
import { ShipPanel } from '@/components/ShipPanel';
import { ToastRegion, useToasts } from '@/components/Toasts';
import { TrackTable } from '@/components/TrackTable';
import { mergeTracks } from '@/lib/merge';
import {
  clearSession,
  exportSession,
  exportTracksCsv,
  exportTracksJson,
  loadSession,
  saveSession,
  type Session,
} from '@/lib/storage';
import type { LlmImport, MergedTrack, SortMode } from '@/lib/types';

export default function Home() {
  const [imports, setImports] = useState<LlmImport[]>([]);
  const [curated, setCurated] = useState<MergedTrack[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('narrative');
  const [hydrated, setHydrated] = useState(false);
  const { toasts, toast } = useToasts();
  const sessionFileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const session = loadSession();
    if (session) {
      setImports(session.imports);
      setSortMode(session.sortMode ?? 'narrative');
      setCurated(session.curated ?? mergeTracks(session.imports, session.sortMode ?? 'narrative'));
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveSession({ imports, curated, sortMode });
  }, [imports, curated, sortMode, hydrated]);

  const rebuild = useCallback(
    (nextImports: LlmImport[], mode: SortMode) => {
      setImports(nextImports);
      setCurated(mergeTracks(nextImports, mode));
    },
    [],
  );

  const handleAdd = (imp: LlmImport, opts: { replaced: boolean; skipped: number }) => {
    const next = [...imports.filter((i) => i.source !== imp.source), imp];
    rebuild(next, sortMode);
    const skippedNote = opts.skipped > 0 ? ` (${opts.skipped} malformed entries skipped)` : '';
    toast(
      opts.replaced
        ? `Replaced ${imp.source} with ${imp.tracks.length} tracks${skippedNote}.`
        : `Imported ${imp.tracks.length} tracks from ${imp.source}${skippedNote}.`,
    );
  };

  const handleRemove = (source: string) => {
    rebuild(
      imports.filter((i) => i.source !== source),
      sortMode,
    );
    toast(`Removed ${source}.`);
  };

  const handleSortMode = (mode: SortMode) => {
    setSortMode(mode);
    setCurated(mergeTracks(imports, mode));
  };

  const handleEdit = (index: number, patch: Partial<Pick<MergedTrack, 'title' | 'artist'>>) => {
    setCurated((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    setCurated((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(index + direction, 0, item);
      return next;
    });
  };

  const handleDelete = (index: number) => {
    setCurated((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReset = () => {
    clearSession();
    setImports([]);
    setCurated([]);
    toast('Session cleared.');
  };

  const handleRestoreSession = async (files: FileList | null) => {
    if (!files?.[0]) return;
    try {
      const parsed = JSON.parse(await files[0].text()) as Session;
      if (!Array.isArray(parsed.imports)) throw new Error('not a session file');
      setImports(parsed.imports);
      setSortMode(parsed.sortMode ?? 'narrative');
      setCurated(parsed.curated ?? mergeTracks(parsed.imports, parsed.sortMode ?? 'narrative'));
      toast('Session restored.');
    } catch {
      toast('That file is not a valid session export.', 'error');
    }
    if (sessionFileInput.current) sessionFileInput.current.value = '';
  };

  const firstConcept = imports[0]?.concept;

  return (
    <main className="shell">
      <header className="row spread" style={{ alignItems: 'flex-end' }}>
        <div>
          <h1 className="type-large-title">Cinematic Playlists</h1>
          <p className="type-subhead" style={{ marginTop: 'var(--sp-1)' }}>
            One soundtrack, many directors&rsquo; cuts — merge every model&rsquo;s read on your story.
          </p>
        </div>
        <div className="row">
          <button className="btn btn-compact" onClick={() => exportSession({ imports, curated, sortMode })} disabled={imports.length === 0}>
            Save session
          </button>
          <button className="btn btn-compact" onClick={() => sessionFileInput.current?.click()}>
            Restore
          </button>
          <input ref={sessionFileInput} type="file" accept=".json" hidden onChange={(e) => handleRestoreSession(e.target.files)} />
          <button className="btn btn-compact btn-destructive" onClick={handleReset} disabled={imports.length === 0}>
            Reset
          </button>
        </div>
      </header>

      <ImportPanel imports={imports} onAdd={handleAdd} onRemove={handleRemove} onError={(m) => toast(m, 'error')} />

      {imports.length > 0 && <ConceptCards imports={imports} />}

      {curated.length > 0 ? (
        <>
          <TrackTable
            tracks={curated}
            totalSources={imports.length}
            sortMode={sortMode}
            onSortMode={handleSortMode}
            onEdit={handleEdit}
            onMove={handleMove}
            onDelete={handleDelete}
            onExportJson={() => exportTracksJson(curated)}
            onExportCsv={() => exportTracksCsv(curated)}
          />
          <ShipPanel
            tracks={curated}
            defaultName={firstConcept?.playlistTitle || 'Multi-LLM Cinematic Soundtrack'}
            defaultDescription={firstConcept?.playlistDescription || 'Aggregated from multiple frontier LLMs.'}
            onToast={toast}
          />
        </>
      ) : (
        hydrated && (
          <div className="glass empty">
            Paste a model&rsquo;s JSON response above — or load the sample — to build your master soundtrack.
          </div>
        )
      )}

      <footer style={{ textAlign: 'center' }}>
        <p className="type-caption">
          Everything runs in your browser. Spotify tokens stay local. MIT licensed —{' '}
          <a href="https://github.com/charlesdegen/multi-llm-cinematic-playlists" style={{ color: 'var(--label-2)' }}>
            iterate on GitHub
          </a>
          .
        </p>
      </footer>

      <ToastRegion toasts={toasts} />
    </main>
  );
}
