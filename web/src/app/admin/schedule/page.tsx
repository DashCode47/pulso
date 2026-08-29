'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ClassTemplate,
  ClassTemplateInput,
  DAY_NAMES,
  createClassTemplate,
  listClassTemplates,
  setClassTemplateActive,
  updateClassTemplate,
} from '@/lib/classTemplates';
import { Instructor, createInstructor, listInstructors } from '@/lib/instructors';

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

    const { error } = editingId ? await updateClassTemplate(editingId, form) : await createClassTemplate(form);
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    cancelEdit();
    setSaving(false);
    refresh();
  }

  async function handleToggleActive(t: ClassTemplate) {
    const { error } = await setClassTemplateActive(t.id, !t.active);
    if (error) {
      setError(error.message);
      return;
    }
    refresh();
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Horario recurrente</h2>
        <p className="mt-1 text-sm text-gray-500">
          Cada plantilla se repite todas las semanas en el día y hora elegidos. Las clases concretas se generan
          automáticamente con 4 semanas de anticipación.
        </p>
      </div>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form ref={formRef} onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 rounded-lg border bg-white p-4 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Título</label>
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Instructor</label>
          <select
            required
            value={form.instructorId}
            onChange={(e) => handleInstructorChange(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
          >
            <option value="" disabled>
              Selecciona...
            </option>
            {instructors.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
            <option value={ADD_INSTRUCTOR}>+ Agregar instructor…</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Día</label>
          <select
            value={form.dayOfWeek}
            onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}
            className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
          >
            {DAY_NAMES.map((name, i) => (
              <option key={i} value={i}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Hora</label>
          <input
            type="time"
            required
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Duración (min)</label>
          <input
            type="number"
            required
            min={1}
            value={form.durationMinutes}
            onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
            className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Capacidad</label>
          <input
            type="number"
            required
            min={1}
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
            className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
          />
        </div>

        <div className="col-span-full flex gap-2">
          <button
            type="submit"
            disabled={saving || !form.instructorId}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {editingId ? 'Guardar cambios' : 'Crear plantilla'}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="text-sm text-gray-500">
              Cancelar
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-gray-400">Sin plantillas todavía.</p>
      ) : (
        <WeekGrid templates={templates} onEdit={startEdit} onCreateAt={startCreateAt} onToggleActive={handleToggleActive} />
      )}

      <dialog
        ref={modalRef}
        onClose={() => setNewInstructorName('')}
        className="m-auto rounded-lg border p-0 backdrop:bg-black/40"
      >
        <form onSubmit={handleCreateInstructor} className="w-72 space-y-3 p-4">
          <h3 className="text-sm font-semibold text-gray-900">Nuevo instructor</h3>
          <input
            autoFocus
            required
            value={newInstructorName}
            onChange={(e) => setNewInstructorName(e.target.value)}
            placeholder="Nombre"
            className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => modalRef.current?.close()} className="text-sm text-gray-500">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={addingInstructor}
              className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Agregar
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
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
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full border-collapse text-sm text-gray-900">
        <thead>
          <tr className="border-b bg-gray-50 text-left text-gray-500">
            <th className="px-3 py-2 font-medium">Hora</th>
            {WEEK_ORDER.map((day) => (
              <th key={day} className="px-3 py-2 font-medium">
                {DAY_NAMES[day]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {times.map((time) => (
            <tr key={time} className="border-b last:border-0">
              <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-500">{time.slice(0, 5)}</td>
              {WEEK_ORDER.map((day) => {
                const t = byDayAndTime.get(`${day}|${time}`);
                if (!t) {
                  return (
                    <td key={day} className="px-2 py-2 align-top">
                      <button
                        onClick={() => onCreateAt(day, time)}
                        className="w-full rounded border border-dashed border-gray-200 py-3 text-xs text-gray-300 hover:border-gray-300 hover:text-gray-500"
                      >
                        +
                      </button>
                    </td>
                  );
                }
                return (
                  <td key={day} className="px-2 py-2 align-top">
                    <div className={`space-y-1 rounded border p-2 ${t.active ? 'border-gray-200 bg-gray-50' : 'border-gray-100 bg-white opacity-50'}`}>
                      <button onClick={() => onEdit(t)} className="block text-left text-sm font-medium text-gray-900 hover:underline">
                        {t.title}
                      </button>
                      <p className="text-xs text-gray-500">{t.instructorName}</p>
                      <p className="text-xs text-gray-400">
                        {t.durationMinutes} min · cupo {t.capacity}
                      </p>
                      <button onClick={() => onToggleActive(t)} className="text-xs text-gray-400 hover:text-gray-700">
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
    </div>
  );
}
