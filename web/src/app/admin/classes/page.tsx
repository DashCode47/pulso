'use client';

import { useEffect, useRef, useState } from 'react';
import { AdminClass, ClassRoster, cancelClass, listClassRoster, listUpcomingClasses } from '@/lib/classes';
import { Badge, Button, Card, EmptyState, ErrorBanner, PageHeader } from '@/components/ui';
import { useConfirm } from '@/components/confirm-dialog';
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

const rosterStatusLabel: Record<ClassRoster['status'], string> = {
  booked: 'Reservado',
  attended: 'Asistió',
  no_show: 'No asistió',
  cancelled: 'Cancelado',
};

// Always render in the studio's own timezone, independent of whatever
// timezone the admin's browser happens to be in.
const STUDIO_TZ = 'America/Bogota';

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString('es', { timeZone: STUDIO_TZ, weekday: 'long', day: '2-digit', month: 'short' });
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<AdminClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [rosterClass, setRosterClass] = useState<AdminClass | null>(null);
  const [roster, setRoster] = useState<ClassRoster[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const modalRef = useRef<HTMLDialogElement>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  async function refresh() {
    setLoading(true);
    try {
      setClasses(await listUpcomingClasses());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar clases.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCancel(c: AdminClass) {
    const ok = await confirm({
      title: 'Cancelar clase',
      message: `¿Cancelar "${c.title}"? Se reembolsará el crédito a quienes ya reservaron.`,
      confirmLabel: 'Sí, cancelar',
      tone: 'danger',
    });
    if (!ok) return;
    setCancellingId(c.id);
    const { error } = await cancelClass(c.id);
    setCancellingId(null);
    if (error) {
      setError(error.message);
      return;
    }
    refresh();
  }

  async function openRoster(c: AdminClass) {
    setRosterClass(c);
    setRosterLoading(true);
    modalRef.current?.showModal();
    try {
      setRoster(await listClassRoster(c.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar inscritos.');
    } finally {
      setRosterLoading(false);
    }
  }

  const groups = new Map<string, AdminClass[]>();
  for (const c of classes) {
    const key = dayKey(c.startsAt);
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Próximas clases" description="Clases generadas a partir del horario recurrente, agrupadas por fecha." />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {loading ? (
        <p className="text-sm text-ink-soft">Cargando...</p>
      ) : classes.length === 0 ? (
        <EmptyState>No hay clases programadas.</EmptyState>
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].map(([day, dayClasses]) => (
            <div key={day}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{day}</h3>
              <Card className="overflow-hidden">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface-alt text-left text-xs uppercase tracking-wide text-ink-muted">
                      <th className="px-4 py-2.5 font-medium">Hora</th>
                      <th className="px-4 py-2.5 font-medium">Título</th>
                      <th className="px-4 py-2.5 font-medium">Instructor</th>
                      <th className="px-4 py-2.5 font-medium">Ocupación</th>
                      <th className="px-4 py-2.5 font-medium">Estado</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {dayClasses.map((c) => {
                      const isCancelled = c.status === 'cancelled';
                      const isFull = c.bookedCount >= c.capacity;
                      return (
                        <tr
                          key={c.id}
                          onClick={() => openRoster(c)}
                          className="cursor-pointer border-b border-line text-ink last:border-0 hover:bg-surface-alt/60"
                        >
                          <td className="px-4 py-3 tabular-nums text-ink-soft">
                            {new Date(c.startsAt).toLocaleTimeString('es', { timeZone: STUDIO_TZ, hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 font-medium">{c.title}</td>
                          <td className="px-4 py-3 text-ink-soft">{c.instructorName}</td>
                          <td className="px-4 py-3">
                            <Badge tone={isFull ? 'coral' : 'mint'}>
                              {c.bookedCount}/{c.capacity}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={statusTone[c.status]}>{statusLabel[c.status]}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-3">
                              {!isCancelled && (
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
              </Card>
            </div>
          ))}
        </div>
      )}

      <dialog ref={modalRef} className="m-auto w-full max-w-md rounded-2xl border border-line bg-surface p-0 text-ink">
        <div className="space-y-3 p-5">
          <div className="flex items-start justify-between">
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
            <div className="flex gap-2">
              <Badge tone={rosterClass.bookedCount >= rosterClass.capacity ? 'coral' : 'mint'}>
                {rosterClass.bookedCount}/{rosterClass.capacity} inscritos
              </Badge>
              <Badge tone={statusTone[rosterClass.status]}>{statusLabel[rosterClass.status]}</Badge>
            </div>
          )}

          {rosterLoading ? (
            <p className="text-sm text-ink-soft">Cargando...</p>
          ) : roster.length === 0 ? (
            <p className="text-sm text-ink-muted">Nadie se ha inscrito todavía.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="py-1.5 pr-2 font-medium">Nombre</th>
                  <th className="py-1.5 pr-2 font-medium">Bici</th>
                  <th className="py-1.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((r) => (
                  <tr key={r.reservationId} className="border-b border-line last:border-0">
                    <td className="py-1.5 pr-2 text-ink">{r.fullName}</td>
                    <td className="py-1.5 pr-2 text-ink-soft">{r.bikeLabel}</td>
                    <td className="py-1.5 text-ink-soft">{rosterStatusLabel[r.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </dialog>

      {confirmDialog}
    </div>
  );
}
