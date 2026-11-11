'use client';

import { useEffect, useRef, useState } from 'react';
import { describeError } from '@/lib/errors';

type Tone = 'success' | 'error';
type Item = { id: number; message: string; tone: Tone };

// ponytail: module-level listener instead of a context -- there is exactly one
// <Toaster/> (admin layout), and toast() can then be called from anywhere.
let push: ((item: Item) => void) | null = null;
let nextId = 0;

export function toast(message: string, tone: Tone = 'success') {
  push?.({ id: ++nextId, message, tone });
}

export function toastError(e: unknown, fallback?: string) {
  toast(describeError(e, fallback), 'error');
}

export function Toaster() {
  const [items, setItems] = useState<Item[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    push = (item) => {
      setItems((prev) => [...prev, item]);
      setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== item.id)), item.tone === 'error' ? 7000 : 3500);
    };
    return () => {
      push = null;
    };
  }, []);

  // A popover lives in the browser's top layer; re-showing it on every change
  // puts it above any <dialog> opened in the meantime, so errors raised from
  // inside a modal are never hidden behind its backdrop.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.matches(':popover-open')) el.hidePopover();
    if (items.length) el.showPopover();
  }, [items]);

  return (
    <div
      ref={ref}
      popover="manual"
      aria-live="polite"
      className="fixed top-auto right-4 bottom-4 left-auto m-0 flex max-w-sm flex-col gap-2 overflow-visible border-0 bg-transparent p-0"
    >
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setItems((prev) => prev.filter((i) => i.id !== t.id))}
          className={`rounded-xl border px-4 py-3 text-left text-sm shadow-lg ${
            t.tone === 'error' ? 'border-coral/40 bg-[#2a1412] text-coral' : 'border-mint/40 bg-[#0f1f16] text-mint'
          }`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
