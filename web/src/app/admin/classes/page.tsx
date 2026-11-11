'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  AdminClass,
  ClassRoster,
  STUDIO_TZ,
  WaitlistEntry,
  adminBookClass,
  cancelClass,
  listClassRoster,
  listClassWaitlist,
  listFreeBikes,
  listPastClasses,
  listUpcomingClasses,
  markNoShow,
} from '@/lib/classes';
import { Member, searchMembers } from '@/lib/members';
import { describeError } from '@/lib/errors';
import { Badge, Button, EmptyState, ErrorBanner, Input, Label, Loading, PageHeader, Select, TableCard, Toggle } from '@/components/ui';
import { useConfirm } from '@/components/confirm-dialog';
import { toast, toastError } from '@/components/toast';
import { ChevronRightIcon } from '@/components/icons';

const statusTone: Record<AdminClass['status'], 'mint' | 'neutral' | 'coral'> = {
  scheduled: 'mint',
  completed: 'neutral',
  cancelled: 'coral',
};

const statusLabel: Record<AdminClass['status'], string> = {
  scheduled: 'Programada',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const rosterStatus: Record<ClassRoster['status'], { label: string; tone: 'mint' | 'neutral' | 'coral' | 'accent' }> = {
  booked: { label: 'Reservado', tone: 'accent' },
  attended: { label: 'Asistió', tone: 'mint' },
  no_show: { label: 'No asistió', tone: 'coral' },
  cancelled: { label: 'Cancelado', tone: 'neutral' },
};

const PAST_DAYS = 14;

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString('es', { timeZone: STUDIO_TZ, weekday: 'long', day: '2-digit', month: 'short' });
}

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString('es', { timeZone: STUDIO_TZ, hour: '2-digit', minute: '2-digit' });
}

type Tab = 'upcoming' | 'past';

export default function ClassesPage() {
  const [tab, setTab] = useState<Tab>('upcoming');
  const [upcoming, setUpcoming] = useState<AdminClass[] | null>(null);
  const [past, setPast] = useState<AdminClass[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);

  const [rosterClass, setRosterClass] = useState<AdminClass | null>(null);
  const [roster, setRoster] = useState<ClassRoster[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const modalRef = useRef<HTMLDialogElement>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  function refresh() {
    return Promise.all([listUpcomingClasses(), listPastClasses(PAST_DAYS)])
      .then(([u, p]) => {
        setUpcoming(u);
        setPast(p);
        setError(null);
      })
      .catch((e) => setError(describeError(e, 'No se pudieron cargar las clases.')));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCancel(c: AdminClass) {
    const ok = await confirm({
      title: 'Cancelar clase',
      message: c.bookedCount
        ? `¿Cancelar "${c.title}"? Se reembolsará el crédito y se notificará a ${c.bookedCount} persona${c.bookedCount === 1 ? '' : 's'}.`
        : `¿Cancelar "${c.title}"? Nadie ha reservado todavía.`,
      confirmLabel: 'Sí, cancelar clase',
      cancelLabel: 'Volver',
      tone: 'danger',
    });
    if (!ok) return;
    setCancellingId(c.id);
    const { error } = await cancelClass(c.id);
    setCancellingId(null);
    if (error) {
      toastError(error, 'No se pudo cancelar la clase.');
      return;
    }
    toast('Clase cancelada.');
    refresh();
  }

  async function loadRoster(c: AdminClass) {
    try {
      const [r, w] = await Promise.all([listClassRoster(c.id), listClassWaitlist(c.id)]);
      setRoster(r);
      setWaitlist(w);
    } catch (e) {
      toastError(e, 'No se pudieron cargar los inscritos.');
      modalRef.current?.close();
    } finally {
      setRosterLoading(false);
    }
  }

  function openRoster(c: AdminClass) {
    setRosterClass(c);
    setRoster([]);
    setWaitlist([]);
    setRosterLoading(true);
    modalRef.current?.showModal();
    loadRoster(c);
  }

  async function reloadAfterChange() {
    if (!rosterClass) return;
    const [u, p] = await Promise.all([listUpcomingClasses(), listPastClasses(PAST_DAYS)]).catch(() => [null, null]);
    if (u && p) {
      setUpcoming(u);
      setPast(p);
      // keep the dialog header counts in sync
      setRosterClass([...u, ...p].find((c) => c.id === rosterClass.id) ?? rosterClass);
    }
    loadRoster(rosterClass);
  }

  async function handleNoShow(r: ClassRoster) {
    const ok = await confirm({
      title: 'Marcar inasistencia',
      message:
        r.status === 'attended'
          ? `${r.fullName} figura como asistente. Se marcará que no asistió y se le descontarán los 100 XP de la clase.`
          : `¿Marcar que ${r.fullName} no asistió?`,
      confirmLabel: 'No asistió',
      tone: 'danger',
    });
    if (!ok) return;
    const { error } = await markNoShow(r.reservationId);
    if (error) {
      toastError(error, 'No se pudo marcar la inasistencia.');
      return;
    }
    toast(`${r.fullName}: marcado como no asistió.`);
    reloadAfterChange();
  }

  const source = tab === 'upcoming' ? upcoming : past;
  const cancelledCount = (upcoming ?? []).filter((c) => c.status === 'cancelled').length;
  const visible = (source ?? []).filter((c) => tab === 'past' || showCancelled || c.status !== 'cancelled');
  const groups = new Map<string, AdminClass[]>();
  for (const c of visible) {
    const key = dayKey(c.startsAt);
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }

  const rosterStarted = !!rosterClass && new Date(rosterClass.startsAt) <= new Date();
  const canBook =
    !!rosterClass && !rosterStarted && rosterClass.status === 'scheduled' && rosterClass.bookedCount < rosterClass.capacity;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clases"
        description="Haz clic en una clase para ver los inscritos, la lista de espera, marcar inasistencias o reservar por un miembro."
        action={
          tab === 'upcoming' &&
          cancelledCount > 0 && (
            <Toggle checked={showCancelled} onChange={() => setShowCancelled((v) => !v)} label={`Mostrar canceladas (${cancelledCount})`} />
          )
        }
      />

      <div className="flex gap-1.5" role="tablist">
        {(
          [
            ['upcoming', 'Próximas'],
            ['past', `Pasadas (${PAST_DAYS} días)`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              tab === value ? 'border-mint bg-mint-soft text-ink' : 'border-line text-ink-soft hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {source === null ? (
        !error && <Loading />
      ) : visible.length === 0 ? (
        <EmptyState>{tab === 'upcoming' ? 'No hay clases programadas.' : `No hubo clases en los últimos ${PAST_DAYS} días.`}</EmptyState>
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].map(([day, dayClasses]) => (
            <div key={day}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{day}</h3>
              <TableCard>
                <table className="w-full min-w-[680px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface-alt text-left text-xs uppercase tracking-wide text-ink-muted">
                      <th className="px-4 py-2.5 font-medium">Hora</th>
                      <th className="px-4 py-2.5 font-medium">Título</th>
                      <th className="px-4 py-2.5 font-medium">Instructor</th>
                      <th className="px-4 py-2.5 font-medium">{tab === 'upcoming' ? 'Ocupación' : 'Asistencia'}</th>
                      <th className="px-4 py-2.5 font-medium">Estado</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {dayClasses.map((c) => {
                      const isCancelled = c.status === 'cancelled';
                      return (
                        <tr
                          key={c.id}
                          onClick={() => openRoster(c)}
                          onKeyDown={(e) => {
                            if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                              e.preventDefault();
                              openRoster(c);
                            }
                          }}
                          tabIndex={0}
                          aria-label={`Ver inscritos de ${c.title}`}
                          className={`cursor-pointer border-b border-line text-ink last:border-0 hover:bg-surface-alt/60 focus-visible:bg-surface-alt focus-visible:outline-none ${isCancelled ? 'opacity-60' : ''}`}
                        >
                          <td className="px-4 py-3 tabular-nums text-ink-soft">{timeOf(c.startsAt)}</td>
                          <td className="px-4 py-3 font-medium">{c.title}</td>
                          <td className="px-4 py-3 text-ink-soft">{c.instructorName}</td>
                          <td className="px-4 py-3">
                            {tab === 'upcoming' ? (
                              <Badge tone={c.bookedCount >= c.capacity ? 'coral' : 'mint'}>
                                {c.bookedCount}/{c.capacity}
                              </Badge>
                            ) : (
                              <span className="text-xs text-ink-soft">
                                <span className="text-mint">{c.attendedCount + c.bookedCount} asistieron</span>
                                {c.noShowCount > 0 && <span className="text-coral"> · {c.noShowCount} no</span>}
                                <span className="text-ink-muted"> / {c.capacity}</span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={statusTone[c.status]}>{statusLabel[c.status]}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-3">
                              {tab === 'upcoming' && !isCancelled && (
                                <Button
                                  variant="dangerLink"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancel(c);
                                  }}
                                  disabled={cancellingId === c.id}
                                >
                                  Cancelar
                                </Button>
                              )}
                              <ChevronRightIcon className="h-4 w-4 text-ink-muted" />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableCard>
            </div>
          ))}
        </div>
      )}

      <dialog ref={modalRef} className="m-auto w-full max-w-lg rounded-2xl border border-line bg-surface p-0 text-ink">
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-ink">{rosterClass?.title}</h3>
              {rosterClass && (
                <p className="text-xs text-ink-soft">
                  {new Date(rosterClass.startsAt).toLocaleString('es', {
                    timeZone: STUDIO_TZ,
                    weekday: 'long',
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' · '}
                  {rosterClass.instructorName}
                </p>
              )}
            </div>
            <button onClick={() => modalRef.current?.close()} className="text-sm text-ink-muted hover:text-ink">
              Cerrar
            </button>
          </div>

          {rosterClass && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={rosterClass.bookedCount >= rosterClass.capacity ? 'coral' : 'mint'}>
                {rosterClass.bookedCount + rosterClass.attendedCount}/{rosterClass.capacity} inscritos
              </Badge>
              <Badge tone={statusTone[rosterClass.status]}>{statusLabel[rosterClass.status]}</Badge>
              {!rosterStarted && rosterClass.bookedCount > 0 && rosterClass.status === 'scheduled' && (
                <Link
                  href={`/admin/notifications?class=${rosterClass.id}`}
                  className="ml-auto text-xs font-medium text-ink-soft underline-offset-2 hover:text-ink hover:underline"
                >
                  Avisar a los inscritos →
                </Link>
              )}
            </div>
          )}

          {rosterLoading ? (
            <Loading className="py-6" />
          ) : (
            <>
              {roster.length === 0 ? (
                <p className="text-sm text-ink-muted">Nadie se ha inscrito todavía.</p>
              ) : (
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
                      <th className="py-1.5 pr-2 font-medium">Nombre</th>
                      <th className="py-1.5 pr-2 font-medium">Bici</th>
                      <th className="py-1.5 pr-2 font-medium">Estado</th>
                      {rosterStarted && <th className="py-1.5" />}
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((r) => (
                      <tr key={r.reservationId} className="border-b border-line last:border-0">
                        <td className="py-2 pr-2 text-ink">{r.fullName}</td>
                        <td className="py-2 pr-2 text-ink-soft">{r.bikeLabel}</td>
                        <td className="py-2 pr-2">
                          <Badge tone={rosterStatus[r.status].tone}>{rosterStatus[r.status].label}</Badge>
                        </td>
                        {rosterStarted && (
                          <td className="py-2 text-right">
                            {(r.status === 'booked' || r.status === 'attended') && (
                              <Button variant="dangerLink" size="sm" onClick={() => handleNoShow(r)}>
                                No asistió
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {waitlist.length > 0 && (
                <div className="border-t border-line pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Lista de espera ({waitlist.length})</p>
                  <ol className="space-y-1 text-sm">
                    {waitlist.map((w, i) => (
                      <li key={w.id} className="flex items-center gap-2">
                        <span className="w-5 text-right tabular-nums text-ink-muted">{i + 1}.</span>
                        <span className="text-ink">{w.fullName}</span>
                        {w.status === 'offered' && <Badge tone="accent">Cupo ofrecido</Badge>}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {canBook && rosterClass && <BookForMember classId={rosterClass.id} onBooked={reloadAfterChange} />}
            </>
          )}
        </div>
      </dialog>

      {confirmDialog}
    </div>
  );
}

// Walk-ins / WhatsApp requests: pick a member with an active membership and a free bike.
function BookForMember({ classId, onBooked }: { classId: string; onBooked: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Member[]>([]);
  const [member, setMember] = useState<Member | null>(null);
  const [bikes, setBikes] = useState<{ id: string; label: string }[]>([]);
  const [bikeId, setBikeId] = useState('');
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    listFreeBikes(classId)
      .then((b) => {
        setBikes(b);
        setBikeId(b[0]?.id ?? '');
      })
      .catch((e) => toastError(e, 'No se pudieron cargar las bicis.'));
  }, [classId]);

  useEffect(() => {
    if (member || !query.trim()) return;
    const id = setTimeout(() => {
      searchMembers(query)
        .then((m) => setResults(m.filter((x) => x.membershipStatus === 'active').slice(0, 8)))
        .catch((e) => toastError(e, 'No se pudo buscar miembros.'));
    }, 250);
    return () => clearTimeout(id);
  }, [query, member]);

  async function handleBook() {
    if (!member || !bikeId) return;
    setBooking(true);
    const { error } = await adminBookClass(member.userId, classId, bikeId);
    setBooking(false);
    if (error) {
      toastError(error, 'No se pudo hacer la reserva.');
      return;
    }
    toast(`Reservado para ${member.fullName}. Se descontó 1 crédito.`);
    setMember(null);
    setQuery('');
    onBooked();
  }

  return (
    <div className="space-y-2 border-t border-line pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Reservar para un miembro</p>
      {member ? (
        <div className="flex items-center justify-between rounded-lg border border-line bg-surface-alt px-3 py-2 text-sm">
          <span>
            <span className="text-ink">{member.fullName}</span>
            <span className="text-ink-muted"> · {member.creditsBalance} créditos</span>
          </span>
          <button type="button" onClick={() => setMember(null)} className="text-xs text-ink-muted hover:text-ink">
            Cambiar
          </button>
        </div>
      ) : (
        <div>
          <Input
            type="search"
            aria-label="Buscar miembro"
            placeholder="Buscar por nombre o email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query.trim() && results.length > 0 && (
            <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-line bg-surface">
              {results.map((m) => (
                <button
                  key={m.userId}
                  type="button"
                  onClick={() => {
                    setMember(m);
                    setResults([]);
                  }}
                  className="flex w-full justify-between px-3 py-2 text-left text-sm text-ink hover:bg-surface-alt"
                >
                  {m.fullName}
                  <span className="text-xs text-ink-muted">{m.creditsBalance} créditos</span>
                </button>
              ))}
            </div>
          )}
          <p className="mt-1 text-xs text-ink-muted">Solo miembros con membresía activa.</p>
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label htmlFor="bookBike">Bici</Label>
          <Select id="bookBike" value={bikeId} onChange={(e) => setBikeId(e.target.value)} disabled={bikes.length === 0}>
            {bikes.length === 0 && <option value="">Sin bicis libres</option>}
            {bikes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </Select>
        </div>
        <Button size="sm" className="mb-1" onClick={handleBook} disabled={!member || !bikeId || booking || member.creditsBalance < 1}>
          {booking ? 'Reservando...' : 'Reservar (1 crédito)'}
        </Button>
      </div>
      {member && member.creditsBalance < 1 && <p className="text-xs text-coral">{member.fullName} no tiene créditos.</p>}
    </div>
  );
}
