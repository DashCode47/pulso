'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AdminClass,
  addDays,
  bogotaDate,
  bogotaInstant,
  bogotaTime,
  cancelClass,
  copyPreviousWeek,
  createClasses,
  listWeekClasses,
  mondayOf,
  updateClass,
} from '@/lib/classes';
import { Instructor, createInstructor, listInstructors } from '@/lib/instructors';
import { getSchedulePublishedUntil, publishNextWeek } from '@/lib/settings';
import { describeError } from '@/lib/errors';
import { useConfirm } from '@/components/confirm-dialog';
import { toast, toastError } from '@/components/toast';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '@/components/icons';
import { Badge, Button, Card, ErrorBanner, Input, Label, PageHeader, Select } from '@/components/ui';

const ADD_INSTRUCTOR = '__add__';

type Draft = {
  title: string;
  instructorId: string;
  dates: string[]; // one when editing, one or more when creating
  time: string;
  durationMinutes: number;
  capacity: number;
};

// Per-browser convenience: the next new class starts from the last one created.
const TEMPLATE_KEY = 'pulso.schedule.lastClass';
function loadTemplate(): Partial<Draft> {
  try {
    return JSON.parse(localStorage.getItem(TEMPLATE_KEY) ?? '{}');
  } catch {
    return {};
  }
}
function saveTemplate({ title, instructorId, durationMinutes, capacity }: Draft) {
  try {
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify({ title, instructorId, durationMinutes, capacity }));
  } catch {}
}

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(':').map(Number);
  const t = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export default function SchedulePage() {
  const today = bogotaDate(new Date().toISOString());
  // The schedule is uploaded on Sunday for the week after, so start there.
  const [weekStart, setWeekStart] = useState(() => addDays(mondayOf(today), 7));
  const weekEnd = addDays(weekStart, 6);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekIsPast = weekEnd < today;

  const [classes, setClasses] = useState<AdminClass[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [publishedUntil, setPublishedUntil] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [copying, setCopying] = useState(false);

  const [editing, setEditing] = useState<AdminClass | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [newInstructor, setNewInstructor] = useState<string | null>(null); // null = inline field hidden
  const [addingInstructor, setAddingInstructor] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const requestId = useRef(0);
  const { confirm, dialog: confirmDialog } = useConfirm();

  async function refresh(start = weekStart) {
    // Ignore responses from weeks the admin already navigated away from.
    const id = ++requestId.current;
    try {
      const [c, i, p] = await Promise.all([listWeekClasses(start), listInstructors(), getSchedulePublishedUntil()]);
      if (id !== requestId.current) return;
      setClasses(c);
      setInstructors(i);
      setPublishedUntil(p);
      setLoadError(null);
    } catch (e) {
      if (id === requestId.current) setLoadError(describeError(e, 'No se pudo cargar el horario.'));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    refresh(weekStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  function goToWeek(start: string) {
    setClasses([]);
    setLoading(true);
    setWeekStart(start);
  }

  // ---- dialog -------------------------------------------------------------

  const weekTimes = [...new Set(classes.map((c) => bogotaTime(c.startsAt)))].sort();
  const knownTitles = [...new Set(classes.map((c) => c.title))].sort();

  function mostCommonTime() {
    const counts = new Map<string, number>();
    for (const c of classes) counts.set(bogotaTime(c.startsAt), (counts.get(bogotaTime(c.startsAt)) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '07:00';
  }

  // Clicking "+" under a day proposes the slot right after that day's last class.
  function suggestTime(day: string) {
    const last = classes.filter((c) => bogotaDate(c.startsAt) === day).at(-1);
    return last ? addMinutes(bogotaTime(last.startsAt), last.durationMinutes) : mostCommonTime();
  }

  function openCreate(day?: string) {
    const t = loadTemplate();
    setEditing(null);
    setNewInstructor(null);
    setDraft({
      title: t.title ?? '',
      instructorId: instructors.some((i) => i.id === t.instructorId) ? t.instructorId! : '',
      dates: day ? [day] : [],
      time: day ? suggestTime(day) : mostCommonTime(),
      durationMinutes: t.durationMinutes ?? 60,
      capacity: t.capacity ?? 12,
    });
    dialogRef.current?.showModal();
  }

  function openEdit(c: AdminClass) {
    setEditing(c);
    setNewInstructor(null);
    setDraft({
      title: c.title,
      instructorId: c.instructorId,
      dates: [bogotaDate(c.startsAt)],
      time: bogotaTime(c.startsAt),
      durationMinutes: c.durationMinutes,
      capacity: c.capacity,
    });
    dialogRef.current?.showModal();
  }

  function duplicate() {
    setEditing(null);
    setDraft((d) => d && { ...d, dates: [] });
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  function toggleDay(day: string) {
    setDraft((d) => {
      if (!d) return d;
      if (editing) return { ...d, dates: [day] };
      return { ...d, dates: d.dates.includes(day) ? d.dates.filter((x) => x !== day) : [...d.dates, day].sort() };
    });
  }

  function selectDays(indexes: number[]) {
    setDraft((d) => d && { ...d, dates: indexes.map((i) => weekDays[i]).filter((day) => day >= today) });
  }

  const conflicts = draft
    ? draft.dates.filter((day) =>
        classes.some((c) => c.id !== editing?.id && bogotaDate(c.startsAt) === day && bogotaTime(c.startsAt) === draft.time),
      )
    : [];
  const inPast = !!draft?.time && !!draft.dates.some((day) => new Date(bogotaInstant(day, draft.time)) < new Date());
  const canSave =
    !!draft &&
    !!draft.title.trim() &&
    !!draft.instructorId &&
    draft.dates.length > 0 &&
    !!draft.time &&
    draft.durationMinutes > 0 &&
    draft.capacity > 0 &&
    !inPast &&
    !saving;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!draft || !canSave) return;
    setSaving(true);
    const inputs = draft.dates.map((date) => ({
      title: draft.title.trim(),
      instructorId: draft.instructorId,
      startsAt: bogotaInstant(date, draft.time),
      durationMinutes: draft.durationMinutes,
      capacity: draft.capacity,
    }));
    const { error } = editing ? await updateClass(editing.id, inputs[0]) : await createClasses(inputs);
    setSaving(false);
    if (error) {
      toastError(error, 'No se pudo guardar la clase.');
      return;
    }
    if (!editing) saveTemplate(draft);
    toast(editing ? 'Clase actualizada.' : inputs.length === 1 ? 'Clase agregada.' : `${inputs.length} clases agregadas.`);
    closeDialog();
    refresh();
  }

  async function handleRemove() {
    if (!editing) return;
    const ok = await confirm({
      title: 'Quitar clase',
      message: editing.bookedCount
        ? `"${editing.title}" tiene ${editing.bookedCount} reserva${editing.bookedCount === 1 ? '' : 's'}. Se cancelará, se reembolsará el crédito y se les notificará.`
        : `¿Quitar "${editing.title}" del horario?`,
      confirmLabel: 'Sí, quitar',
      tone: 'danger',
    });
    if (!ok) return;
    const { error } = await cancelClass(editing.id);
    if (error) {
      toastError(error, 'No se pudo quitar la clase.');
      return;
    }
    toast('Clase quitada.');
    closeDialog();
    refresh();
  }

  async function handleAddInstructor() {
    const name = newInstructor?.trim();
    if (!name || addingInstructor) return;
    setAddingInstructor(true);
    const { instructor, error } = await createInstructor(name);
    setAddingInstructor(false);
    if (error || !instructor) {
      toastError(error, 'No se pudo crear el instructor.');
      return;
    }
    setInstructors((prev) => [...prev, instructor].sort((a, b) => a.name.localeCompare(b.name)));
    setDraft((d) => d && { ...d, instructorId: instructor.id });
    setNewInstructor(null);
    toast(`Instructor ${instructor.name} agregado.`);
  }

  // ---- week actions -------------------------------------------------------

  async function handleCopy() {
    const prevStart = addDays(weekStart, -7);
    const ok = await confirm({
      title: 'Copiar semana anterior',
      message: `Se copiarán las clases del ${formatShort(prevStart)} al ${formatShort(addDays(prevStart, 6))} a esta semana. Se omiten las que ya existen (mismo título y hora) y las que ya pasaron.`,
      confirmLabel: 'Copiar',
    });
    if (!ok) return;
    setCopying(true);
    const { copied, error } = await copyPreviousWeek(weekStart);
    setCopying(false);
    if (error) {
      toastError(error, 'No se pudo copiar la semana.');
      return;
    }
    toast(copied ? `Se copiaron ${copied} clase${copied === 1 ? '' : 's'}.` : 'No había clases nuevas para copiar.');
    refresh();
  }

  // Mirrors admin_publish_next_week(): Mon-Wed publishes the current week, Thu-Sun the next one.
  const publishStart = mondayOf(addDays(today, 4));
  const publishEnd = addDays(publishStart, 6);
  const nextWeekPublished = publishedUntil !== null && publishedUntil >= publishEnd;
  const weekPublished = publishedUntil !== null && weekEnd <= publishedUntil;

  async function handlePublish() {
    const ok = await confirm({
      title: 'Publicar horario',
      message: `Los miembros podrán ver y reservar las clases del ${formatShort(publishStart)} al ${formatShort(publishEnd)} y recibirán una notificación.`,
      confirmLabel: 'Publicar',
    });
    if (!ok) return;
    setPublishing(true);
    const { until, error } = await publishNextWeek();
    setPublishing(false);
    if (error) {
      toastError(error, 'No se pudo publicar el horario.');
      return;
    }
    setPublishedUntil(until);
    toast('Horario publicado.');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Horario semanal"
        description="Arma el horario de cada semana. Los miembros solo ven y reservan las semanas publicadas."
      />

      {loadError && <ErrorBanner>{loadError}</ErrorBanner>}

      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Visible para miembros</p>
          <p className="mt-1 text-sm">
            {publishedUntil ? `Hasta el ${formatDay(publishedUntil)}.` : '…'}{' '}
            <span className="text-ink-soft">Las semanas siguientes solo las ves tú.</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {weekStart !== publishStart && (
            <Button variant="link" size="sm" onClick={() => goToWeek(publishStart)}>
              Ver esa semana
            </Button>
          )}
          <Button onClick={handlePublish} disabled={publishing || nextWeekPublished || publishedUntil === null}>
            {publishing
              ? 'Publicando…'
              : nextWeekPublished
                ? `Semana del ${formatShort(publishStart)} publicada ✓`
                : `Publicar semana del ${formatShort(publishStart)} al ${formatShort(publishEnd)}`}
          </Button>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => goToWeek(addDays(weekStart, -7))} aria-label="Semana anterior">
            <ChevronLeftIcon />
          </Button>
          <p className="min-w-40 text-center text-sm font-semibold text-ink">
            {formatShort(weekStart)} – {formatShort(weekEnd)}
          </p>
          <Button variant="ghost" size="sm" onClick={() => goToWeek(addDays(weekStart, 7))} aria-label="Semana siguiente">
            <ChevronRightIcon />
          </Button>
          {weekStart !== mondayOf(today) && (
            <Button variant="link" size="sm" onClick={() => goToWeek(mondayOf(today))}>
              Esta semana
            </Button>
          )}
          {publishedUntil && <Badge tone={weekPublished ? 'mint' : 'neutral'}>{weekPublished ? 'Publicada' : 'Sin publicar'}</Badge>}
          {!loading && (
            <span className="text-xs text-ink-muted">
              {classes.length} clase{classes.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleCopy} disabled={copying || weekIsPast}>
            {copying ? 'Copiando…' : 'Copiar semana anterior'}
          </Button>
          <Button size="sm" onClick={() => openCreate()} disabled={weekIsPast || loading}>
            <PlusIcon className="h-3.5 w-3.5" />
            Nueva clase
          </Button>
        </div>
      </div>

      {!loading && classes.length === 0 && !weekIsPast && (
        <p className="text-sm text-ink-soft">
          Esta semana está vacía. Usa <span className="text-ink">Copiar semana anterior</span> como punto de partida, o agrega
          clases con <span className="text-ink">+</span> en cada día.
        </p>
      )}

      <Card className="overflow-x-auto">
        <div className={`grid min-w-[880px] grid-cols-7 divide-x divide-line transition-opacity ${loading ? 'opacity-50' : ''}`}>
          {weekDays.map((day) => {
            const isPast = day < today;
            const isToday = day === today;
            const dayClasses = classes.filter((c) => bogotaDate(c.startsAt) === day);
            return (
              <div key={day} className="flex min-h-72 flex-col">
                <div className={`border-b border-line px-3 py-2.5 ${isToday ? 'bg-mint-soft' : 'bg-surface-alt'}`}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{formatWeekday(day)}</p>
                  <p className={`text-lg font-semibold tabular-nums ${isToday ? 'text-mint' : isPast ? 'text-ink-muted' : 'text-ink'}`}>
                    {Number(day.slice(8))}
                  </p>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-2">
                  {dayClasses.map((c) => (
                    <ClassCard key={c.id} c={c} onOpen={() => openEdit(c)} />
                  ))}
                  {!isPast && !loading && (
                    <button
                      type="button"
                      onClick={() => openCreate(day)}
                      aria-label={`Agregar clase el ${formatDay(day)}`}
                      className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-line py-2 text-xs text-ink-muted transition-colors hover:border-ink-muted hover:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/50"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      Agregar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <dialog ref={dialogRef} className="m-auto w-full max-w-lg rounded-2xl border border-line bg-surface p-0 text-ink">
        {draft && (
          <form onSubmit={handleSave} className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-ink">{editing ? 'Editar clase' : 'Nueva clase'}</h3>
                {editing && editing.bookedCount > 0 && (
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {editing.bookedCount} reserva{editing.bookedCount === 1 ? '' : 's'} · si cambias la hora o la duración se les
                    notificará.
                  </p>
                )}
              </div>
              <button type="button" onClick={closeDialog} className="text-sm text-ink-muted hover:text-ink">
                Cerrar
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  required
                  list="class-titles"
                  placeholder="Ej. Spinning"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
                <datalist id="class-titles">
                  {knownTitles.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
              <div>
                <Label htmlFor="instructor">Instructor</Label>
                <Select
                  id="instructor"
                  required
                  value={draft.instructorId}
                  onChange={(e) =>
                    e.target.value === ADD_INSTRUCTOR ? setNewInstructor('') : setDraft({ ...draft, instructorId: e.target.value })
                  }
                >
                  <option value="" disabled>
                    Selecciona...
                  </option>
                  {instructors
                    .filter((i) => i.active || i.id === draft.instructorId)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  <option value={ADD_INSTRUCTOR}>+ Agregar instructor…</option>
                </Select>
              </div>
            </div>

            {newInstructor !== null && (
              <div className="flex gap-2 rounded-lg border border-line bg-surface-alt p-2">
                <Input
                  autoFocus
                  placeholder="Nombre del nuevo instructor"
                  value={newInstructor}
                  onChange={(e) => setNewInstructor(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddInstructor();
                    }
                  }}
                />
                <Button type="button" size="sm" onClick={handleAddInstructor} disabled={!newInstructor.trim() || addingInstructor}>
                  Agregar
                </Button>
                <Button type="button" variant="link" size="sm" onClick={() => setNewInstructor(null)}>
                  Cancelar
                </Button>
              </div>
            )}

            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label className="mb-0">{editing ? 'Día' : 'Días · puedes elegir varios'}</Label>
                {!editing && (
                  <div className="flex gap-3 text-xs">
                    <button type="button" className="text-ink-soft hover:text-ink" onClick={() => selectDays([0, 1, 2, 3, 4])}>
                      Lun–Vie
                    </button>
                    <button type="button" className="text-ink-soft hover:text-ink" onClick={() => selectDays([0, 1, 2, 3, 4, 5, 6])}>
                      Todos
                    </button>
                    <button type="button" className="text-ink-soft hover:text-ink" onClick={() => selectDays([])}>
                      Ninguno
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map((day) => {
                  const on = draft.dates.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={day < today}
                      aria-pressed={on}
                      onClick={() => toggleDay(day)}
                      className={`rounded-lg border px-1 py-1.5 text-center text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                        on ? 'border-mint bg-mint-soft text-ink' : 'border-line text-ink-soft hover:text-ink'
                      }`}
                    >
                      <span className="block font-semibold uppercase">{formatWeekday(day)}</span>
                      <span className="tabular-nums">{Number(day.slice(8))}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="time">Hora</Label>
                <Input id="time" type="time" step={300} required value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="duration">Duración (min)</Label>
                <Input
                  id="duration"
                  type="number"
                  required
                  min={5}
                  step={5}
                  value={draft.durationMinutes}
                  onChange={(e) => setDraft({ ...draft, durationMinutes: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="capacity">Capacidad</Label>
                <Input
                  id="capacity"
                  type="number"
                  required
                  min={1}
                  value={draft.capacity}
                  onChange={(e) => setDraft({ ...draft, capacity: Number(e.target.value) })}
                />
              </div>
            </div>

            {weekTimes.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-ink-muted">Horas de esta semana:</span>
                {weekTimes.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDraft({ ...draft, time: t })}
                    className={`rounded-full border px-2 py-0.5 text-xs tabular-nums transition-colors ${
                      draft.time === t ? 'border-mint bg-mint-soft text-ink' : 'border-line text-ink-soft hover:text-ink'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            {draft.time && (
              <p className="text-xs text-ink-soft">
                {draft.time}–{addMinutes(draft.time, draft.durationMinutes || 0)}
                {draft.dates.length > 0 && ` · ${draft.dates.map(formatWeekday).join(', ')}`}
              </p>
            )}
            {inPast && <p className="text-xs text-coral">Esa hora ya pasó en alguno de los días elegidos.</p>}
            {!inPast && conflicts.length > 0 && (
              <p className="text-xs text-coral">
                Ya hay otra clase a las {draft.time} el {conflicts.map(formatDay).join(', ')}.
              </p>
            )}

            <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
              <div>
                {editing && (
                  <Button type="button" variant="dangerLink" size="sm" onClick={handleRemove}>
                    Quitar clase
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {editing && (
                  <Button type="button" variant="ghost" size="sm" onClick={duplicate}>
                    Duplicar
                  </Button>
                )}
                <Button type="submit" size="sm" disabled={!canSave}>
                  {saving
                    ? 'Guardando…'
                    : editing
                      ? 'Guardar cambios'
                      : draft.dates.length > 1
                        ? `Agregar ${draft.dates.length} clases`
                        : 'Agregar clase'}
                </Button>
              </div>
            </div>
          </form>
        )}
      </dialog>

      {confirmDialog}
    </div>
  );
}

function ClassCard({ c, onOpen }: { c: AdminClass; onOpen: () => void }) {
  const start = bogotaTime(c.startsAt);
  const past = new Date(c.startsAt) < new Date();
  const full = c.bookedCount >= c.capacity;
  const pct = Math.min(100, Math.round((c.bookedCount / Math.max(c.capacity, 1)) * 100));
  const content = (
    <>
      <p className="text-xs font-semibold tabular-nums text-ink-soft">
        {start}–{addMinutes(start, c.durationMinutes)}
      </p>
      <p className="mt-0.5 truncate text-sm font-medium text-ink">{c.title}</p>
      <p className="truncate text-xs text-ink-soft">{c.instructorName}</p>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
          <div className={`h-full rounded-full ${full ? 'bg-coral' : 'bg-mint'}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[11px] tabular-nums text-ink-muted">
          {c.bookedCount}/{c.capacity}
        </span>
      </div>
    </>
  );
  const base = 'w-full rounded-lg border border-line bg-surface-alt p-2.5 text-left';
  // Past classes can't be edited (the DB rejects it), so they're shown read-only.
  if (past) {
    return (
      <div className={`${base} opacity-50`} title="Clase pasada">
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${base} transition-colors hover:border-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/50`}
    >
      {content}
    </button>
  );
}

function formatDay(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('es', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: 'short' });
}

function formatShort(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('es', { timeZone: 'UTC', day: 'numeric', month: 'short' });
}

function formatWeekday(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('es', { timeZone: 'UTC', weekday: 'short' }).replace('.', '');
}
