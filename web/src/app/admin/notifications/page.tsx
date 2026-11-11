'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Member, searchMembers } from '@/lib/members';
import { AdminClass, STUDIO_TZ, listUpcomingClasses } from '@/lib/classes';
import { SentNotification, listNotificationHistory, sendNotification } from '@/lib/notifications';
import { Badge, Button, Card, EmptyState, Input, Label, Loading, PageHeader, Select, Textarea } from '@/components/ui';
import { useConfirm } from '@/components/confirm-dialog';
import { toast, toastError } from '@/components/toast';

type Audience = 'all' | 'class' | 'member';

const audiences: { value: Audience; label: string }[] = [
  { value: 'all', label: 'Todos los activos' },
  { value: 'class', label: 'Inscritos en una clase' },
  { value: 'member', label: 'Un miembro' },
];

function classLabel(c: { title: string; startsAt: string }) {
  return `${new Date(c.startsAt).toLocaleString('es', { timeZone: STUDIO_TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${c.title}`;
}

// useSearchParams needs a Suspense boundary for the static build.
export default function NotificationsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NotificationsContent />
    </Suspense>
  );
}

function NotificationsContent() {
  // ?class=<id> comes from "Avisar a los inscritos" in the class roster.
  const presetClassId = useSearchParams().get('class');
  const [audience, setAudience] = useState<Audience>(presetClassId ? 'class' : 'all');
  const [classId, setClassId] = useState(presetClassId ?? '');
  const [classes, setClasses] = useState<AdminClass[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Member[]>([]);
  const [searchedQuery, setSearchedQuery] = useState(''); // query the current results belong to
  const [selected, setSelected] = useState<Member | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<SentNotification[] | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  function loadHistory() {
    return listNotificationHistory()
      .then(setHistory)
      .catch((e) => {
        setHistory([]);
        toastError(e, 'No se pudo cargar el historial.');
      });
  }

  useEffect(() => {
    loadHistory();
    listUpcomingClasses()
      .then((c) => setClasses(c.filter((x) => x.status === 'scheduled' && x.bookedCount > 0)))
      .catch((e) => toastError(e, 'No se pudieron cargar las clases.'));
  }, []);

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

  const targetClass = classes.find((c) => c.id === classId);
  const canSend =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    (audience === 'all' || (audience === 'member' && !!selected) || (audience === 'class' && !!targetClass)) &&
    !sending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;

    if (audience !== 'member') {
      const ok = await confirm({
        title: audience === 'all' ? 'Enviar a todos los miembros' : 'Enviar a los inscritos',
        message:
          audience === 'all'
            ? 'Esta notificación llegará a todos los miembros con membresía activa. ¿Continuar?'
            : `Llegará a las ${targetClass!.bookedCount} persona${targetClass!.bookedCount === 1 ? '' : 's'} inscritas en ${classLabel(targetClass!)}.`,
        confirmLabel: 'Sí, enviar',
      });
      if (!ok) return;
    }

    setSending(true);
    const { count, error } = await sendNotification({
      title: title.trim(),
      body: body.trim(),
      userId: audience === 'member' ? selected?.userId : null,
      classId: audience === 'class' ? classId : null,
    });
    setSending(false);
    if (error) {
      toastError(error, 'No se pudo enviar la notificación.');
      return;
    }

    toast(audience === 'member' ? `Enviada a ${selected?.fullName}.` : `Enviada a ${count ?? 0} miembro${count === 1 ? '' : 's'}.`);
    setTitle('');
    setBody('');
    setSelected(null);
    setQuery('');
    loadHistory();
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Notificaciones" description="Envía un mensaje push a todos los miembros activos, a los inscritos en una clase o a un miembro puntual." />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,32rem)_1fr]">
        <Card className="p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Destinatario</Label>
              <div className="grid grid-cols-3 gap-2">
                {audiences.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    aria-pressed={audience === a.value}
                    onClick={() => {
                      setAudience(a.value);
                      setSelected(null);
                    }}
                    className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors sm:text-sm ${
                      audience === a.value ? 'border-mint bg-mint-soft text-ink' : 'border-line text-ink-soft hover:text-ink'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {audience === 'class' && (
              <div>
                <Label htmlFor="classId">Clase</Label>
                <Select id="classId" value={classId} onChange={(e) => setClassId(e.target.value)}>
                  <option value="" disabled>
                    {classes.length ? 'Elige una clase...' : 'No hay clases próximas con inscritos'}
                  </option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {classLabel(c)} ({c.bookedCount})
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-xs text-ink-muted">Ej. cambio de instructor, retraso o un aviso para esa clase.</p>
              </div>
            )}

            {audience === 'member' && (
              <div>
                {selected ? (
                  <div className="flex items-center justify-between rounded-lg border border-line bg-surface-alt px-3 py-2 text-sm">
                    <span className="text-ink">{selected.fullName}</span>
                    <button type="button" onClick={() => setSelected(null)} className="text-ink-muted hover:text-ink">
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <>
                    <Input
                      type="search"
                      aria-label="Buscar miembro"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Buscar por nombre o email..."
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
                            className="flex w-full justify-between gap-3 px-3 py-2 text-left text-sm text-ink hover:bg-surface-alt"
                          >
                            {m.fullName}
                            <span className="truncate text-xs text-ink-muted">{m.email}</span>
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

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">Enviadas recientemente</p>
          {history === null ? (
            <Loading />
          ) : history.length === 0 ? (
            <EmptyState>Todavía no se ha enviado ninguna notificación.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {history.map((n) => (
                <li key={`${n.sentAt}|${n.title}`} className="rounded-xl border border-line bg-surface p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-ink">{n.title}</p>
                    <span className="text-xs text-ink-muted">
                      {new Date(n.sentAt).toLocaleString('es', { timeZone: STUDIO_TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">{n.body}</p>
                  <div className="mt-2">
                    <Badge tone={n.audience === 'all' ? 'accent' : 'neutral'}>
                      {n.audience === 'member'
                        ? `A ${n.recipientName ?? '1 miembro'}`
                        : n.audience === 'class'
                          ? `${n.recipients} inscritos · ${n.classTitle && n.classStartsAt ? classLabel({ title: n.classTitle, startsAt: n.classStartsAt }) : 'clase'}`
                          : `Todos · ${n.recipients} miembros`}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {confirmDialog}
    </div>
  );
}
