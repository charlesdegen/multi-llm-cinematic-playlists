'use client';

import type { LlmImport } from '@/lib/types';

/** Side-by-side "directors' cuts" — each model's film concept for the same life. */
export function ConceptCards({ imports }: { imports: LlmImport[] }) {
  const withConcepts = imports.filter((i) => i.concept.movieTitle || i.concept.logline);
  if (withConcepts.length === 0) return null;

  return (
    <section className="glass card" aria-labelledby="concepts-heading">
      <div className="card-header">
        <h2 id="concepts-heading" className="type-title2">
          Directors&rsquo; cuts
        </h2>
        <span className="type-footnote">How each model scored the same story</span>
      </div>
      <div className="concept-grid">
        {withConcepts.map(({ source, concept }) => (
          <article key={source} className="glass-elevated concept-card stack" style={{ gap: 'var(--sp-2)' }}>
            <span className="pill pill-accent" style={{ alignSelf: 'flex-start' }}>
              {source}
            </span>
            {concept.movieTitle && <h3 className="type-headline">{concept.movieTitle}</h3>}
            {concept.genre && <p className="type-caption">{concept.genre}</p>}
            {concept.logline && <p className="type-subhead">{concept.logline}</p>}
            {concept.moodTags.length > 0 && (
              <div className="row" style={{ gap: 'var(--sp-1)' }}>
                {concept.moodTags.map((tag) => (
                  <span key={tag} className="chip">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {concept.narrativeArc && (
              <p className="type-footnote" style={{ fontStyle: 'italic' }}>
                {concept.narrativeArc}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
