'use client';

import { useEffect, useState } from 'react';
import { AdminClass, bogotaDate, bogotaTime, listPastClasses } from '@/lib/classes';
import { Card, Loading } from '@/components/ui';

const WEEKS = 4;

type Row = { key: string; label: string; filled: number; capacity: number; classes: number };

// Seats taken = everyone who held a spot when the class ran (attended, no-show,
// or still "booked" if the class hasn't been closed yet).
const taken = (c: AdminClass) => c.attendedCount + c.noShowCount + c.bookedCount;

function group(classes: AdminClass[], keyOf: (c: AdminClass) => [string, string]): Row[] {
  const rows = new Map<string, Row>();
  for (const c of classes) {
    const [key, label] = keyOf(c);
    const row = rows.get(key) ?? { key, label, filled: 0, capacity: 0, classes: 0 };
    row.filled += taken(c);
    row.capacity += c.capacity;
    row.classes += 1;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.filled / b.capacity - a.filled / a.capacity);
}

// Same weekday + start time across weeks = one slot, e.g. "lun 07:00".
function weekdayKey(iso: string): [string, string] {
  const day = new Date(`${bogotaDate(iso)}T12:00:00Z`);
  const name = day.toLocaleDateString('es', { timeZone: 'UTC', weekday: 'short' }).replace('.', '');
  return [`${day.getUTCDay()}|${bogotaTime(iso)}`, `${name} ${bogotaTime(iso)}`];
}

// Single measure (fill %) -> one hue, ranked horizontal bars, no legend.
export function OccupancyCard() {
  const [classes, setClasses] = useState<AdminClass[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    listPastClasses(WEEKS * 7)
      .then((c) => setClasses(c.filter((x) => x.status !== 'cancelled' && x.capacity > 0)))
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;

  const total = classes?.reduce((s, c) => s + taken(c), 0) ?? 0;
  const seats = classes?.reduce((s, c) => s + c.capacity, 0) ?? 0;
  const bySlot = classes ? group(classes, (c) => weekdayKey(c.startsAt)) : [];
  const byInstructor = classes ? group(classes, (c) => [c.instructorId, c.instructorName]) : [];

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Ocupación · últimas {WEEKS} semanas</p>
        {classes && classes.length > 0 && (
          <p className="text-sm text-ink-soft">
            Promedio <span className="font-semibold tabular-nums text-ink">{Math.round((total / seats) * 100)}%</span> · {classes.length}{' '}
            clases
          </p>
        )}
      </div>
      {classes === null ? (
        <Loading />
      ) : classes.length === 0 ? (
        <p className="text-sm text-ink-muted">Todavía no hay clases pasadas para calcular la ocupación.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <BarList
            title="Horarios más llenos"
            rows={bySlot.slice(0, 6)}
            note={bySlot.length > 6 ? 'Los menos llenos están abajo.' : undefined}
          />
          <BarList title="Por instructor" rows={byInstructor} />
          {bySlot.length > 6 && <BarList title="Horarios menos llenos" rows={bySlot.slice(-Math.min(6, bySlot.length - 6)).reverse()} />}
        </div>
      )}
    </Card>
  );
}

function BarList({ title, rows, note }: { title: string; rows: Row[]; note?: string }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-ink-soft">{title}</p>
      <ul className="space-y-1.5" role="list">
        {rows.map((r) => {
          const pct = Math.round((r.filled / r.capacity) * 100);
          return (
            <li
              key={r.key}
              className="group grid grid-cols-[6.5rem_1fr_2.75rem] items-center gap-2 text-sm"
              title={`${r.label}: ${r.filled} de ${r.capacity} lugares ocupados en ${r.classes} clase${r.classes === 1 ? '' : 's'}`}
            >
              <span className="truncate text-ink-soft group-hover:text-ink">{r.label}</span>
              <span className="h-2 overflow-hidden rounded-full bg-surface-alt">
                <span className="block h-full rounded-full bg-mint transition-opacity group-hover:opacity-80" style={{ width: `${Math.max(pct, 2)}%` }} />
              </span>
              <span className="text-right tabular-nums text-ink">{pct}%</span>
            </li>
          );
        })}
      </ul>
      {note && <p className="mt-2 text-xs text-ink-muted">{note}</p>}
    </div>
  );
}
