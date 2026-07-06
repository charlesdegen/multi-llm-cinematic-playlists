'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { exchangeCode } from '@/lib/spotify';

function CallbackInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const denied = params.get('error');
    if (denied) {
      setError(`Spotify authorization was declined (${denied}).`);
      return;
    }
    const code = params.get('code');
    if (!code) {
      setError('No authorization code in the callback URL.');
      return;
    }
    exchangeCode(code)
      .then(() => router.replace('/'))
      .catch((e: Error) => setError(e.message));
  }, [params, router]);

  return (
    <main className="shell" style={{ alignItems: 'center', paddingTop: '20vh' }}>
      <div className="glass card" style={{ maxWidth: 440, textAlign: 'center' }}>
        {error ? (
          <div className="stack">
            <h1 className="type-title2">Connection failed</h1>
            <p className="type-subhead">{error}</p>
            <button className="btn btn-primary" onClick={() => router.replace('/')}>
              Back to the app
            </button>
          </div>
        ) : (
          <div className="stack">
            <h1 className="type-title2">Connecting to Spotify…</h1>
            <p className="type-subhead">Finishing authorization. You&rsquo;ll be redirected in a moment.</p>
          </div>
        )}
      </div>
    </main>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackInner />
    </Suspense>
  );
}
