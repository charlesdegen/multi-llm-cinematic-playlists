'use client';

import { useCallback, useRef, useState } from 'react';

export interface Toast {
  id: number;
  message: string;
  kind: 'info' | 'error';
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((message: string, kind: Toast['kind'] = 'info') => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  return { toasts, toast };
}

export function ToastRegion({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`glass toast${t.kind === 'error' ? ' toast-error' : ''}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
