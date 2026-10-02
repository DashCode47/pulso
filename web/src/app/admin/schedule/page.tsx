'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AdminClass,
  ClassInput,
  addDays,
  bogotaDate,
  bogotaInstant,
  bogotaTime,
  cancelClass,
  copyPreviousWeek,
  createClass,
  listWeekClasses,
  mondayOf,
  updateClass,
} from '@/lib/classes';
import { Instructor, createInstructor, listInstructors } from '@/lib/instructors';
import { getSchedulePublishedUntil, publishNextWeek } from '@/lib/settings';
import { useConfirm } from '@/components/confirm-dialog';
import { Badge, Button, Card, EmptyState, ErrorBanner, Input, Label, PageHeader, Select } from '@/components/ui';

const ADD_INSTRUCTOR = '__add__';

type Form = { title: string; instructorId: string; date: string; time: string; durationMinutes: number; capacity: number };

function emptyForm(date: string): Form {
  return { title: '', instructorId: '', date, time: '07:00', durationMinutes: 60, capacity: 12 };
}

function toInput(form: Form): ClassInput {
  return {
    title: form.title,
    instructorId: form.instructorId,
    startsAt: bogotaInstant(form.date, form.time),
    durationMinutes: form.durationMinutes,
    capacity: form.capacity,
  };
}

export default function SchedulePage() {
  const today = bogotaDate(new Date().toISOString());
  // The schedule is uploaded on Sunday for the week after, so start there.
  const [weekStart, setWeekStart] = useState(() => addDays(mondayOf(today), 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const [classes, setClasses] = useState<AdminClass[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(() => emptyForm(addDays(mondayOf(today), 7)));
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [publishedUntil, setPublishedUntil] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const [newInstructorName, setNewInstructorName] = useState('');
  const [addingInstructor, setAddingInstructor] = useState(false);
  const modalRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  async function refresh(start = weekStart) {
    setLoading(true);
    try {
      const [c, i, p] = await Promise.all([listWeekClasses(start), listInstructors(), getSchedulePublishedUntil()]);
      setClasses(c);
      setInstructors(i);
      setPublishedUntil(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el horario.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh(weekStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  function goToWeek(start: string) {
    setWeekStart(start);
    setEditingId(null);
    setForm(emptyForm(start));
    setNotice(null);
  }

  function startEdit(c: AdminClass) {
    setEditingId(c.id);
    setForm({
      title: c.title,
      instructorId: c.instructorId,
      date: bogotaDate(c.startsAt),
      time: bogotaTime(c.startsAt),
      durationMinutes: c.durationMinutes,
      capacity: c.capacity,
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function startCreateAt(date: string, time: string) {
    setEditingId(null);
    setForm({ ...emptyForm(date), time });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm(weekStart));
  }

  function handleInstructorChange(value: string) {
    if (value === ADD_INSTRUCTOR) {
      setNewInstructorName('');
      modalRef.current?.showModal();
      return;
    }
    setForm({ ...form, instructorId: value });
  }

  async function handleCreateInstructor(e: React.FormEvent) {
    e.preventDefault();
    const name = newInstructorName.trim();
    if (!name || addingInstructor) return;
    setAddingInstructor(true);

    const { instructor, error } = await createInstructor(name);
    setAddingInstructor(false);
    if (error || !instructor) {
      setError(error?.message ?? 'No se pudo crear el instructor.');
      return;
    }

    setInstructors((prev) => [...prev, instructor].sort((a, b) => a.name.localeCompare(b.name)));
    setForm((f) => ({ ...f, instructorId: instructor.id }));
    modalRef.current?.close();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    const { error } = editingId ? await updateClass(editingId, toInput(form)) : await createClass(toInput(form));
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }

    cancelEdit();
    refresh();
  }

  async function handleRemove(c: AdminClass) {
    const ok = await confirm({
      title: 'Quitar clase',
      message: c.bookedCount
        ? `"${c.title}" tiene ${c.bookedCount} reserva${c.bookedCount === 1 ? '' : 's'}. Se cancelará y se reembolsará el crédito.`
        : `¿Quitar "${c.title}" del horario?`,
      confirmLabel: 'Sí, quitar',
      tone: 'danger',
    });
    if (!ok) return;
    const { error } = await cancelClass(c.id);
    if (error) {
      setError(error.message);
      return;
    }
    if (editingId === c.id) cancelEdit();
    refresh();
  }

  async function handleCopy() {
    setCopying(true);
    setError(null);
    setNotice(null);
    try {
      const { copied, error } = await copyPreviousWeek(weekStart);
      if (error) throw error;
      setNotice(copied ? `Se copiaron ${copied} clase${copied === 1 ? '' : 's'} de la semana anterior.` : 'No había clases nuevas para copiar.');
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo copiar la semana.');
    } finally {
      setCopying(false);
    }
  }

  async function handlePublish() {
    const ok = await confirm({
      title: 'Publicar semana siguiente',
      message: 'Los miembros podrán ver y reservar las clases de la semana siguiente.',
      confirmLabel: 'Publicar',
    });
    if (!ok) return;
    setPublishing(true);
    setError(null);
    const { until, error } = await publishNextWeek();
    setPublishing(false);
    if (error) {
      setError(error.message);
      return;
    }
    setPublishedUntil(until);
  }

  const weekEnd = addDays(weekStart, 6);
  const weekPublished = publishedUntil !== null && weekEnd <= publishedUntil;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Horario semanal"
        description="Arma el horario de cada semana: agrega clases o copia la semana anterior como punto de partida. Los miembros solo ven y reservan las semanas publicadas."
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}
      {notice && <ErrorBanner>{notice}</ErrorBanner>}

      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Visible para miembros</p>
          <p className="mt-1 text-sm">
            {publishedUntil ? `Hasta el ${formatDay(publishedUntil)}` : '…'}. Las semanas siguientes solo las ves tú.
          </p>
        </div>
        <Button onClick={handlePublish} disabled={publishing}>
          {publishing ? 'Publicando…' : 'Publicar semana siguiente'}
        </Button>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => goToWeek(addDays(weekStart, -7))} aria-label="Semana anterior">
            ‹
          </Button>
          <p className="text-sm font-semibold text-ink">
            Semana del {formatShort(weekStart)} al {formatShort(weekEnd)}
          </p>
          <Button variant="ghost" size="sm" onClick={() => goToWeek(addDays(weekStart, 7))} aria-label="Semana siguiente">
            ›
          </Button>
          {publishedUntil && <Badge tone={weekPublished ? 'mint' : 'neutral'}>{weekPublished ? 'Publicada' : 'Sin publicar'}</Badge>}
        </div>
        <Button variant="ghost" onClick={handleCopy} disabled={copying || weekEnd < today}>
          {copying ? 'Copiando…' : 'Copiar semana anterior'}
        </Button>
      </div>

      <Card className="p-5">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">{editingId ? 'Editar clase' : 'Nueva clase'}</p>
        <form ref={formRef} onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="title">Título</Label>
            <Input id="title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="instructor">Instructor</Label>
            <Select id="instructor" required value={form.instructorId} onChange={(e) => handleInstructorChange(e.target.value)}>
              <option value="" disabled>
                Selecciona...
              </option>
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
              <option value={ADD_INSTRUCTOR}>+ Agregar instructor…</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="date">Fecha</Label>
            <Input id="date" type="date" required min={today} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="time">Hora</Label>
            <Input id="time" type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="duration">Duración (min)</Label>
            <Input
              id="duration"
              type="number"
              required
              min={1}
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="capacity">Capacidad</Label>
            <Input
              id="capacity"
              type="number"
              required
              min={1}
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
            />
          </div>

          <div className="col-span-full flex items-center gap-3">
            <Button type="submit" disabled={saving || !form.instructorId}>
              {editingId ? 'Guardar cambios' : 'Agregar clase'}
            </Button>
            {editingId && (
              <Button type="button" variant="link" onClick={cancelEdit}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </Card>

      {loading ? (
        <p className="text-sm text-ink-soft">Cargando...</p>
      ) : classes.length === 0 ? (
        <EmptyState>Esta semana no tiene clases. Agrégalas arriba o copia la semana anterior.</EmptyState>
      ) : (
        <WeekGrid days={weekDays} today={today} classes={classes} onEdit={startEdit} onCreateAt={startCreateAt} onRemove={handleRemove} />
      )}

      <dialog
        ref={modalRef}
        onClose={() => setNewInstructorName('')}
        className="m-auto rounded-2xl border border-line bg-surface p-0 text-ink"
      >
        <form onSubmit={handleCreateInstructor} className="w-72 space-y-3 p-5">
          <h3 className="text-sm font-semibold text-ink">Nuevo instructor</h3>
          <Input
            autoFocus
            required
            value={newInstructorName}
            onChange={(e) => setNewInstructorName(e.target.value)}
            placeholder="Nombre"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="link" onClick={() => modalRef.current?.close()}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={addingInstructor}>
              Agregar
            </Button>
          </div>
        </form>
      </dialog>

      {confirmDialog}
    </div>
  );
}

function WeekGrid({
  days,
  today,
  classes,
  onEdit,
  onCreateAt,
  onRemove,
}: {
  days: string[];
  today: string;
  classes: AdminClass[];
  onEdit: (c: AdminClass) => void;
  onCreateAt: (date: string, time: string) => void;
  onRemove: (c: AdminClass) => void;
}) {
  const times = [...new Set(classes.map((c) => bogotaTime(c.startsAt)))].sort();
  const cells = new Map<string, AdminClass[]>();
  for (const c of classes) {
    const key = `${bogotaDate(c.startsAt)}|${bogotaTime(c.startsAt)}`;
    cells.set(key, [...(cells.get(key) ?? []), c]);
  }

  return (
    <Card className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-surface-alt text-left text-xs uppercase tracking-wide text-ink-muted">
            <th className="px-3 py-2.5 font-medium">Hora</th>
            {days.map((day) => (
              <th key={day} className="px-3 py-2.5 font-medium">
                {formatColumn(day)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {times.map((time) => (
            <tr key={time} className="border-b border-line last:border-0">
              <td className="whitespace-nowrap px-3 py-3 align-top text-xs font-semibold text-ink-muted">{time}</td>
              {days.map((day) => {
                const slot = cells.get(`${day}|${time}`) ?? [];
                return (
                  <td key={day} className="space-y-2 px-2 py-2 align-top">
                    {slot.map((c) => (
                      <div key={c.id} className="space-y-1.5 rounded-lg border border-line bg-surface-alt p-2.5">
                        <button onClick={() => onEdit(c)} className="text-left text-sm font-medium text-ink hover:text-mint">
                          {c.title}
                        </button>
                        <p className="text-xs text-ink-soft">{c.instructorName}</p>
                        <p className="text-xs text-ink-muted">
                          {c.durationMinutes} min · {c.bookedCount}/{c.capacity}
                        </p>
                        {c.status === 'scheduled' && (
                          <button onClick={() => onRemove(c)} className="text-xs text-ink-muted hover:text-coral">
                            Quitar
                          </button>
                        )}
                      </div>
                    ))}
                    {slot.length === 0 && day >= today && (
                      <button
                        onClick={() => onCreateAt(day, time)}
                        className="flex w-full items-center justify-center rounded-lg border border-dashed border-line py-4 text-sm text-ink-muted transition-colors hover:border-ink-muted hover:text-ink-soft"
                      >
                        +
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function formatDay(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('es', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: 'short' });
}

function formatShort(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('es', { timeZone: 'UTC', day: 'numeric', month: 'short' });
}

function formatColumn(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('es', { timeZone: 'UTC', weekday: 'short', day: 'numeric' });
}
