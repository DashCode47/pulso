'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
};

// Drop-in replacement for window.confirm() with the app's own look --
// `await confirm({...})` resolves true/false just like the native dialog did
// at every call site, so the three pages that used it only needed a one-line
// swap.
export function useConfirm() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resolveRef = useRef<((result: boolean) => void) | null>(null);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  function confirm(opts: ConfirmOptions): Promise<boolean> {
    setOptions(opts);
    dialogRef.current?.showModal();
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }

  function resolveOnce(result: boolean) {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    resolve?.(result);
  }

  function handleChoice(result: boolean) {
    dialogRef.current?.close();
    resolveOnce(result);
  }

  const dialog = (
    <dialog
      ref={dialogRef}
      onClose={() => resolveOnce(false)}
      className="m-auto w-full max-w-sm rounded-2xl border border-line bg-surface p-0 text-ink"
    >
      {options && (
        <div className="p-5">
          <h3 className="text-sm font-semibold text-ink">{options.title}</h3>
          <p className="mt-1.5 text-sm text-ink-soft">{options.message}</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => handleChoice(false)}>
              {options.cancelLabel ?? 'Cancelar'}
            </Button>
            <Button
              type="button"
              variant={options.tone === 'danger' ? 'danger' : 'primary'}
              size="sm"
              onClick={() => handleChoice(true)}
            >
              {options.confirmLabel ?? 'Confirmar'}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );

  return { confirm, dialog };
}
