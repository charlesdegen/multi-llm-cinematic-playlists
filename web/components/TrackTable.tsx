'use client';

import type { LlmImport, MergedTrack, SortMode } from '@/lib/types';

interface Props {
  tracks: MergedTrack[];
  totalSources: number;
  sortMode: SortMode;
  onSortMode: (mode: SortMode) => void;
  onEdit: (index: number, patch: Partial<Pick<MergedTrack, 'title' | 'artist'>>) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onDelete: (index: number) => void;
  onExportJson: () => void;
  onExportCsv: () => void;
}

function VoteDots({ votes, total }: { votes: number; total: number }) {
  const max = Math.max(total, 1);
  return (
    <span className="votes" aria-label={`${votes} of ${max} models`}>
      <span className="dots" aria-hidden>
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={`dot${i < votes ? ' on' : ''}`} />
        ))}
      </span>
      {votes}/{max}
    </span>
  );
}

export function TrackTable({
  tracks,
  totalSources,
  sortMode,
  onSortMode,
  onEdit,
  onMove,
  onDelete,
  onExportJson,
  onExportCsv,
}: Props) {
  return (
    <section className="glass card" aria-labelledby="step-curate">
      <div className="card-header spread row">
        <div className="row">
          <span className="step-badge" aria-hidden>
            2
          </span>
          <h2 id="step-curate" className="type-title2">
            Master soundtrack
          </h2>
          <span className="type-footnote">{tracks.length} tracks</span>
        </div>
        <div className="row">
          <div className="seg" role="group" aria-label="Track ordering">
            <button aria-pressed={sortMode === 'narrative'} onClick={() => onSortMode('narrative')}>
              Narrative
            </button>
            <button aria-pressed={sortMode === 'consensus'} onClick={() => onSortMode('consensus')}>
              Consensus
            </button>
          </div>
          <button className="btn btn-compact" onClick={onExportJson}>
            Export JSON
          </button>
          <button className="btn btn-compact" onClick={onExportCsv}>
            Export CSV
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="tracks">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Track</th>
              <th scope="col">Artist</th>
              <th scope="col" className="hide-narrow">
                Why it fits
              </th>
              <th scope="col">Recommended by</th>
              <th scope="col">Votes</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((t, i) => (
              <tr key={t.key}>
                <td className="pos-cell">{i + 1}</td>
                <td style={{ minWidth: 160 }}>
                  <input
                    type="text"
                    value={t.title}
                    aria-label={`Title of track ${i + 1}`}
                    onChange={(e) => onEdit(i, { title: e.target.value })}
                  />
                </td>
                <td style={{ minWidth: 140 }}>
                  <input
                    type="text"
                    value={t.artist}
                    aria-label={`Artist of track ${i + 1}`}
                    onChange={(e) => onEdit(i, { artist: e.target.value })}
                  />
                </td>
                <td className="hide-narrow" style={{ maxWidth: 320 }}>
                  <span className="type-footnote" title={`${t.why}${t.cinematicMoment ? `\n\nScene: ${t.cinematicMoment}` : ''}`}>
                    {t.why.length > 90 ? `${t.why.slice(0, 90)}…` : t.why}
                  </span>
                </td>
                <td>
                  <span className="row" style={{ gap: 'var(--sp-1)', flexWrap: 'wrap' }}>
                    {t.sources.map((s) => (
                      <span key={s} className="pill">
                        {s}
                      </span>
                    ))}
                  </span>
                </td>
                <td>
                  <VoteDots votes={t.votes} total={totalSources} />
                </td>
                <td>
                  <span className="row" style={{ gap: 'var(--sp-1)', flexWrap: 'nowrap' }}>
                    <button className="btn btn-icon" aria-label={`Move track ${i + 1} up`} disabled={i === 0} onClick={() => onMove(i, -1)}>
                      ↑
                    </button>
                    <button
                      className="btn btn-icon"
                      aria-label={`Move track ${i + 1} down`}
                      disabled={i === tracks.length - 1}
                      onClick={() => onMove(i, 1)}
                    >
                      ↓
                    </button>
                    <button
                      className="btn btn-icon btn-destructive"
                      aria-label={`Remove track ${i + 1}`}
                      onClick={() => onDelete(i)}
                    >
                      ✕
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
