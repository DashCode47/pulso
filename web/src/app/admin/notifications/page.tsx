'use client';

import { useEffect, useState } from 'react';
import { Member, searchMembers } from '@/lib/members';
import { sendNotification } from '@/lib/notifications';
import { Button, Card, Input, Label, PageHeader, Textarea } from '@/components/ui';
import { toast, toastError } from '@/components/toast';
import { useConfirm } from '@/components/confirm-dialog';

type Audience = 'all' | 'member';

export default function NotificationsPage() {
  const [audience, setAudience] = useState<Audience>('all');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Member | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState(''); // query the current results belong to
  const { confirm, dialog: confirmDialog } = useConfirm();

  useEffect(() => {
    if (audience !== 'member' || selected || !query.trim()) return;
    const id = setTimeout(async () => {
      try {
        setResults(await searchMembers(query));
        setSearchedQuery(query);
      } catch (e) {
        toastError(e, 'No se pudo buscar miembros.');
      }
    }, 250);
    return () => clearTimeout(id);
  }, [audience, query, selected]);

  const canSend = title.trim().length > 0 && body.trim().length > 0 && (audience === 'all' || !!selected) && !sending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;

    if (audience === 'all') {
      const ok = await confirm({
        title: 'Enviar a todos los miembros',
        message: 'Esta notificación llegará a todos los miembros con membresía activa. ¿Continuar?',
        confirmLabel: 'Sí, enviar',
      });
      if (!ok) return;
    }

    setSending(true);
    const { count, error } = await sendNotification({
      title: title.trim(),
      body: body.trim(),
      userId: audience === 'member' ? (selected?.userId ?? null) : null,
    });
    setSending(false);
    if (error) {
      toastError(error, 'No se pudo enviar la notificación.');
      return;
    }

    toast(audience === 'all' ? `Enviada a ${count ?? 0} miembro${count === 1 ? '' : 's'}.` : `Enviada a ${selected?.fullName}.`);
    setTitle('');
    setBody('');
    setSelected(null);
    setQuery('');
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Notificaciones" description="Envía un mensaje push a un miembro puntual o a todos los miembros activos." />

      <Card className="max-w-lg p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Destinatario</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setAudience('all');
                  setSelected(null);
                }}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  audience === 'all' ? 'border-mint bg-mint-soft text-ink' : 'border-line text-ink-soft hover:text-ink'
                }`}
              >
                Todos los miembros activos
              </button>
              <button
                type="button"
                onClick={() => setAudience('member')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  audience === 'member' ? 'border-mint bg-mint-soft text-ink' : 'border-line text-ink-soft hover:text-ink'
                }`}
              >
                Miembro específico
              </button>
            </div>
          </div>

          {audience === 'member' && (
            <div>
              {selected ? (
                <div className="flex items-center justify-between rounded-lg border border-line bg-surface-alt px-3 py-2 text-sm">
                  <span className="text-ink">{selected.fullName}</span>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="text-ink-muted hover:text-ink"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <>
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por nombre..."
                  />
                  {query.trim() && searchedQuery === query && results.length === 0 && (
                    <p className="mt-1 px-1 text-xs text-ink-muted">Ningún miembro coincide con &ldquo;{query}&rdquo;.</p>
                  )}
                  {query.trim() && results.length > 0 && (
                    <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-line bg-surface">
                      {results.map((m) => (
                        <button
                          key={m.userId}
                          type="button"
                          onClick={() => {
                            setSelected(m);
                            setResults([]);
                          }}
                          className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-surface-alt"
                        >
                          {m.fullName}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="title">Título</Label>
            <Input id="title" required maxLength={65} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. ¡Nuevo horario!" />
            <p className="mt-1 text-right text-xs tabular-nums text-ink-muted">{title.length}/65</p>
          </div>

          <div>
            <Label htmlFor="body">Mensaje</Label>
            <Textarea id="body" required rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
            <p className="mt-1 text-xs text-ink-muted">
              {body.length > 150 ? 'En la pantalla de bloqueo se verán solo las primeras ~150 letras.' : `${body.length} caracteres`}
            </p>
          </div>

          <Button type="submit" disabled={!canSend}>
            {sending ? 'Enviando...' : 'Enviar notificación'}
          </Button>
        </form>
      </Card>

      {confirmDialog}
    </div>
  );
}
