'use client';

import { useEffect, useRef, useState } from 'react';
import { AdminClass, ClassRoster, cancelClass, listClassRoster, listUpcomingClasses } from '@/lib/classes';

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
    if (!confirm(`¿Cancelar "${c.title}"? Se reembolsará el crédito a quienes ya reservaron.`)) return;
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
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Próximas clases</h2>
        <p className="mt-1 text-sm text-gray-500">
          Clases generadas a partir del horario recurrente, agrupadas por fecha.
        </p>
      </div>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : classes.length === 0 ? (
        <p className="text-sm text-gray-400">No hay clases programadas.</p>
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].map(([day, dayClasses]) => (
            <div key={day}>
              <h3 className="mb-2 text-sm font-semibold capitalize text-gray-700">{day}</h3>
              <table className="w-full border-collapse overflow-hidden rounded-lg border bg-white text-sm text-gray-900">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-gray-500">
                    <th className="px-3 py-2">Hora</th>
                    <th className="px-3 py-2">Título</th>
                    <th className="px-3 py-2">Instructor</th>
                    <th className="px-3 py-2">Ocupación</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {dayClasses.map((c) => {
                    const isCancelled = c.status === 'cancelled';
                    return (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          {new Date(c.startsAt).toLocaleTimeString('es', { timeZone: STUDIO_TZ, hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-3 py-2">{c.title}</td>
                        <td className="px-3 py-2">{c.instructorName}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => openRoster(c)} className="text-blue-600 hover:underline">
                            {c.bookedCount}/{c.capacity}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <span className={isCancelled ? 'text-red-600' : 'text-green-700'}>
                            {statusLabel[c.status]}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {!isCancelled && (
                            <button
                              onClick={() => handleCancel(c)}
                              disabled={cancellingId === c.id}
                              className="text-gray-500 hover:text-red-600 disabled:opacity-50"
                            >
                              Cancelar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <dialog ref={modalRef} className="m-auto w-full max-w-md rounded-lg border p-0 backdrop:bg-black/40">
        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{rosterClass?.title}</h3>
              {rosterClass && (
                <p className="text-xs text-gray-500">
                  {new Date(rosterClass.startsAt).toLocaleString('es', {
                    timeZone: STUDIO_TZ,
                    weekday: 'long',
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </div>
            <button onClick={() => modalRef.current?.close()} className="text-sm text-gray-400 hover:text-gray-700">
              Cerrar
            </button>
          </div>

          {rosterLoading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : roster.length === 0 ? (
            <p className="text-sm text-gray-400">Nadie se ha inscrito todavía.</p>
          ) : (
            <table className="w-full border-collapse text-sm text-gray-900">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-1.5 pr-2">Nombre</th>
                  <th className="py-1.5 pr-2">Bici</th>
                  <th className="py-1.5">Estado</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((r) => (
                  <tr key={r.reservationId} className="border-b last:border-0">
                    <td className="py-1.5 pr-2">{r.fullName}</td>
                    <td className="py-1.5 pr-2">{r.bikeLabel}</td>
                    <td className="py-1.5 text-gray-500">{rosterStatusLabel[r.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </dialog>
    </div>
  );
}
