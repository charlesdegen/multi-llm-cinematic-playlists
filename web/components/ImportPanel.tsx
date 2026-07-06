'use client';

import { useRef, useState } from 'react';
import { parseLlmResponse } from '@/lib/parse';
import { SAMPLE_RESPONSE } from '@/lib/sample';
import type { LlmImport } from '@/lib/types';

const MODEL_PRESETS = ['Claude', 'GPT', 'Gemini', 'Grok', 'Other'];

interface Props {
  imports: LlmImport[];
  onAdd: (imp: LlmImport, opts: { replaced: boolean; skipped: number }) => void;
  onRemove: (source: string) => void;
  onError: (message: string) => void;
}

export function ImportPanel({ imports, onAdd, onRemove, onError }: Props) {
  const [preset, setPreset] = useState('Claude');
  const [customLabel, setCustomLabel] = useState('');
  const [raw, setRaw] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const source = preset === 'Other' ? customLabel.trim() || 'Other' : preset;

  const importText = (text: string, sourceName: string) => {
    const result = parseLlmResponse(text, sourceName);
    if (!result.ok) {
      onError(`${sourceName}: ${result.error}`);
      return false;
    }
    const replaced = imports.some((i) => i.source === sourceName);
    onAdd(result.import, { replaced, skipped: result.skipped });
    return true;
  };

  const handleImport = () => {
    if (!raw.trim()) return;
    if (importText(raw, source)) setRaw('');
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const text = await file.text();
      const name = files.length > 1 ? file.name.replace(/\.(json|txt)$/i, '') : source;
      importText(text, name);
    }
    if (fileInput.current) fileInput.current.value = '';
  };

  return (
    <section className="glass card" aria-labelledby="step-import">
      <div className="card-header">
        <span className="step-badge" aria-hidden>
          1
        </span>
        <h2 id="step-import" className="type-title2">
          Import model responses
        </h2>
      </div>

      <div className="stack">
        <div className="row" role="group" aria-label="Model">
          {MODEL_PRESETS.map((m) => (
            <button
              key={m}
              className="btn btn-compact"
              aria-pressed={preset === m}
              style={preset === m ? { background: 'var(--accent)', color: '#fff', borderColor: 'transparent' } : undefined}
              onClick={() => setPreset(m)}
            >
              {m}
            </button>
          ))}
          {preset === 'Other' && (
            <input
              type="text"
              placeholder="Model name"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              style={{ width: 180 }}
              aria-label="Custom model name"
            />
          )}
        </div>

        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={`Paste the JSON response from ${source} here…`}
          aria-label={`JSON response from ${source}`}
          rows={7}
        />

        <div className="row spread">
          <div className="row">
            <button className="btn btn-primary" onClick={handleImport} disabled={!raw.trim()}>
              Import
            </button>
            <button className="btn" onClick={() => fileInput.current?.click()}>
              Upload files…
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".json,.txt"
              multiple
              hidden
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>
          {imports.length === 0 && (
            <button className="btn btn-compact" onClick={() => importText(SAMPLE_RESPONSE, 'Claude (sample)')}>
              Try with sample data
            </button>
          )}
        </div>

        {imports.length > 0 && (
          <div className="row" aria-label="Imported sources">
            {imports.map((imp) => (
              <span key={imp.source} className="pill pill-accent">
                {imp.source} · {imp.tracks.length} tracks
                <button
                  className="btn-icon"
                  style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', padding: '0 2px' }}
                  aria-label={`Remove ${imp.source}`}
                  onClick={() => onRemove(imp.source)}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
