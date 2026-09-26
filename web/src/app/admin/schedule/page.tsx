'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ClassTemplate,
  ClassTemplateInput,
  DAY_NAMES,
  listClassTemplates,
  saveClassTemplate,
} from '@/lib/classTemplates';
import { Instructor, createInstructor, listInstructors } from '@/lib/instructors';
import { Badge, Button, Card, EmptyState, ErrorBanner, Input, Label, PageHeader, Select } from '@/components/ui';

const ADD_INSTRUCTOR = '__add__';

const emptyForm: ClassTemplateInput = {
  title: '',
  instructorId: '',
  dayOfWeek: 1,
  startTime: '07:00',
  durationMinutes: 60,
  capacity: 12,
};

export default function SchedulePage() {
  const [templates, setTemplates] = useState<ClassTemplate[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ClassTemplateInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [newInstructorName, setNewInstructorName] = useState('');
  const [addingInstructor, setAddingInstructor] = useState(false);
  const modalRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function refresh() {
    setLoading(true);
    try {
      const [t, i] = await Promise.all([listClassTemplates(), listInstructors()]);
      setTemplates(t);
      setInstructors(i);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar horarios.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function startEdit(t: ClassTemplate) {
    setEditingId(t.id);
    setForm({
      title: t.title,
      instructorId: t.instructorId,
      dayOfWeek: t.dayOfWeek,
      startTime: t.startTime.slice(0, 5),
      durationMinutes: t.durationMinutes,
      capacity: t.capacity,
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function startCreateAt(dayOfWeek: number, startTime: string) {
    setEditingId(null);
    setForm({ ...emptyForm, dayOfWeek, startTime });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
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
    const { kept, error } = await saveClassTemplate(editingId, form);
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    setNotice(keptNotice(kept));
    cancelEdit();
    setSaving(false);
    refresh();
  }

  async function handleToggleActive(t: ClassTemplate) {
    setNotice(null);
    const { kept, error } = await saveClassTemplate(t.id, t, !t.active);
    if (error) {
      setError(error.message);
      return;
    }
    setNotice(keptNotice(kept));
    refresh();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Horario recurrente"
        description="Cada plantilla se repite todas las semanas en el día y hora elegidos. Las clases concretas se generan al guardar, con 4 semanas de anticipación. Al editar o desactivar, las clases futuras sin reservas se actualizan solas."
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}
      {notice && <ErrorBanner>{notice}</ErrorBanner>}

      <Card className="p-5">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {editingId ? 'Editar plantilla' : 'Nueva plantilla'}
        </p>
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
            <Label htmlFor="day">Día</Label>
            <Select id="day" value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}>
              {DAY_NAMES.map((name, i) => (
                <option key={i} value={i}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="time">Hora</Label>
            <Input
              id="time"
              type="time"
              required
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            />
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
              {editingId ? 'Guardar cambios' : 'Crear plantilla'}
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
      ) : templates.length === 0 ? (
        <EmptyState>Sin plantillas todavía.</EmptyState>
      ) : (
        <WeekGrid templates={templates} onEdit={startEdit} onCreateAt={startCreateAt} onToggleActive={handleToggleActive} />
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
    </div>
  );
}

function keptNotice(kept: number) {
  if (kept === 0) return null;
  return `${kept} clase${kept === 1 ? '' : 's'} con reservas no se modific${kept === 1 ? 'ó' : 'aron'} y ya no coincide${kept === 1 ? '' : 'n'} con la plantilla. Revísala${kept === 1 ? '' : 's'} en Clases para mantenerla${kept === 1 ? '' : 's'} o cancelarla${kept === 1 ? '' : 's'}.`;
}

// Monday-first display order; day_of_week itself stays Postgres-native
// (0=Sunday) since that's what `extract(dow from ...)` produces in SQL.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function WeekGrid({
  templates,
  onEdit,
  onCreateAt,
  onToggleActive,
}: {
  templates: ClassTemplate[];
  onEdit: (t: ClassTemplate) => void;
  onCreateAt: (dayOfWeek: number, startTime: string) => void;
  onToggleActive: (t: ClassTemplate) => void;
}) {
  const times = [...new Set(templates.map((t) => t.startTime))].sort();
  const byDayAndTime = new Map<string, ClassTemplate>();
  for (const t of templates) byDayAndTime.set(`${t.dayOfWeek}|${t.startTime}`, t);

  return (
    <Card className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-surface-alt text-left text-xs uppercase tracking-wide text-ink-muted">
            <th className="px-3 py-2.5 font-medium">Hora</th>
            {WEEK_ORDER.map((day) => (
              <th key={day} className="px-3 py-2.5 font-medium">
                {DAY_NAMES[day]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {times.map((time) => (
            <tr key={time} className="border-b border-line last:border-0">
              <td className="whitespace-nowrap px-3 py-3 align-top text-xs font-semibold text-ink-muted">{time.slice(0, 5)}</td>
              {WEEK_ORDER.map((day) => {
                const t = byDayAndTime.get(`${day}|${time}`);
                if (!t) {
                  return (
                    <td key={day} className="px-2 py-2 align-top">
                      <button
                        onClick={() => onCreateAt(day, time)}
                        className="flex w-full items-center justify-center rounded-lg border border-dashed border-line py-4 text-sm text-ink-muted transition-colors hover:border-ink-muted hover:text-ink-soft"
                      >
                        +
                      </button>
                    </td>
                  );
                }
                return (
                  <td key={day} className="px-2 py-2 align-top">
                    <div className={`space-y-1.5 rounded-lg border border-line bg-surface-alt p-2.5 ${!t.active ? 'opacity-40' : ''}`}>
                      <div className="flex items-start justify-between gap-1">
                        <button onClick={() => onEdit(t)} className="text-left text-sm font-medium text-ink hover:text-mint">
                          {t.title}
                        </button>
                        {!t.active && <Badge tone="neutral">Inactiva</Badge>}
                      </div>
                      <p className="text-xs text-ink-soft">{t.instructorName}</p>
                      <p className="text-xs text-ink-muted">
                        {t.durationMinutes} min · cupo {t.capacity}
                      </p>
                      <button onClick={() => onToggleActive(t)} className="text-xs text-ink-muted hover:text-ink">
                        {t.active ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
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
