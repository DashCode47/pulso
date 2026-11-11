'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Instructor,
  createInstructor,
  deleteInstructor,
  listInstructors,
  removeInstructorPhoto,
  updateInstructor,
  uploadInstructorPhoto,
} from '@/lib/instructors';
import { AdminClass, listUpcomingClasses } from '@/lib/classes';
import { describeError } from '@/lib/errors';
import { useConfirm } from '@/components/confirm-dialog';
import { toast, toastError } from '@/components/toast';
import { PlusIcon } from '@/components/icons';
import { Badge, Button, EmptyState, ErrorBanner, Input, Label, PageHeader, Toggle } from '@/components/ui';

type Draft = { name: string; active: boolean; photoFile: File | null; removePhoto: boolean };

export default function InstructorsPage() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [upcoming, setUpcoming] = useState<AdminClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const [editing, setEditing] = useState<Instructor | null>(null); // null + open dialog = creating
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  function refresh() {
    return Promise.all([listInstructors(), listUpcomingClasses()])
      .then(([i, c]) => {
        setInstructors(i);
        setUpcoming(c.filter((x) => x.status !== 'cancelled'));
        setLoadError(null);
      })
      .catch((e) => setLoadError(describeError(e, 'No se pudieron cargar los instructores.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
  }, []);

  const upcomingCount = (id: string) => upcoming.filter((c) => c.instructorId === id).length;
  const inactiveCount = instructors.filter((i) => !i.active).length;
  const visible = showInactive ? instructors : instructors.filter((i) => i.active);

  function setPhotoFile(file: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
    setDraft((d) => d && { ...d, photoFile: file, removePhoto: false });
  }

  function openDialog(instructor: Instructor | null) {
    setEditing(instructor);
    setPhotoFile(null);
    if (fileRef.current) fileRef.current.value = '';
    setDraft({ name: instructor?.name ?? '', active: instructor?.active ?? true, photoFile: null, removePhoto: false });
    dialogRef.current?.showModal();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!draft || saving) return;
    const name = draft.name.trim();
    if (!name) return;

    if (editing && editing.active && !draft.active && upcomingCount(editing.id) > 0) {
      const n = upcomingCount(editing.id);
      const ok = await confirm({
        title: 'Desactivar instructor',
        message: `${editing.name} tiene ${n} clase${n === 1 ? '' : 's'} próxima${n === 1 ? '' : 's'}. Seguirán programadas, pero ya no aparecerá al crear clases nuevas.`,
        confirmLabel: 'Desactivar',
      });
      if (!ok) return;
    }

    setSaving(true);
    let id = editing?.id;
    if (editing) {
      const { error } = await updateInstructor(editing.id, { name, active: draft.active });
      if (error) return fail(error);
    } else {
      const { instructor, error } = await createInstructor(name);
      if (error || !instructor) return fail(error);
      id = instructor.id;
      if (!draft.active) await updateInstructor(id, { active: false });
    }
    if (draft.photoFile) {
      const { error } = await uploadInstructorPhoto(id!, draft.photoFile);
      if (error) return fail(error, 'Se guardaron los datos, pero no se pudo subir la foto.');
    } else if (draft.removePhoto) {
      const { error } = await removeInstructorPhoto(id!);
      if (error) return fail(error, 'Se guardaron los datos, pero no se pudo quitar la foto.');
    }
    setSaving(false);
    toast(editing ? 'Instructor actualizado.' : `Instructor ${name} agregado.`);
    dialogRef.current?.close();
    refresh();
  }

  function fail(error: unknown, fallback = 'No se pudo guardar el instructor.') {
    setSaving(false);
    toastError(error, (error as { code?: string })?.code === '23505' ? 'Ya existe un instructor con ese nombre.' : fallback);
    refresh(); // partial saves (e.g. data ok, photo failed) show up right away
  }

  async function handleDelete() {
    if (!editing) return;
    const ok = await confirm({
      title: 'Eliminar instructor',
      message: `¿Eliminar a ${editing.name}? Solo es posible si nunca tuvo clases; si ya las tuvo, desactívalo en su lugar.`,
      confirmLabel: 'Sí, eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    const { error } = await deleteInstructor(editing.id);
    if (error) {
      toastError(
        error,
        (error as { code?: string }).code === '23503'
          ? `${editing.name} ya tiene clases o logros asociados: desactívalo en su lugar.`
          : 'No se pudo eliminar el instructor.',
      );
      return;
    }
    toast('Instructor eliminado.');
    dialogRef.current?.close();
    refresh();
  }

  async function handleToggleActive(i: Instructor) {
    setInstructors((prev) => prev.map((x) => (x.id === i.id ? { ...x, active: !i.active } : x)));
    const { error } = await updateInstructor(i.id, { active: !i.active });
    if (error) {
      setInstructors((prev) => prev.map((x) => (x.id === i.id ? { ...x, active: i.active } : x)));
      toastError(error, 'No se pudo cambiar el estado.');
      return;
    }
    toast(i.active ? `${i.name} desactivado.` : `${i.name} activado.`);
  }

  const shownPhoto = draft?.removePhoto ? null : (previewUrl ?? editing?.photoUrl ?? null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Instructores"
        description="Nombre y foto que ven los miembros en cada clase. Los inactivos no aparecen al crear clases nuevas, pero sus clases ya programadas se mantienen."
        action={
          <Button onClick={() => openDialog(null)}>
            <PlusIcon className="h-4 w-4" />
            Nuevo instructor
          </Button>
        }
      />

      {loadError && <ErrorBanner>{loadError}</ErrorBanner>}

      {inactiveCount > 0 && (
        <Toggle checked={showInactive} onChange={() => setShowInactive((v) => !v)} label={`Mostrar inactivos (${inactiveCount})`} />
      )}

      {loading ? (
        <p className="text-sm text-ink-soft">Cargando...</p>
      ) : visible.length === 0 ? (
        <EmptyState>Todavía no hay instructores. Agrega el primero con &ldquo;Nuevo instructor&rdquo;.</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((i) => {
            const n = upcomingCount(i.id);
            return (
              <div key={i.id} className={`flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 ${i.active ? '' : 'opacity-60'}`}>
                <Avatar name={i.name} url={i.photoUrl} size="h-14 w-14" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{i.name}</p>
                  <p className="text-xs text-ink-soft">
                    {n === 0 ? 'Sin clases próximas' : `${n} clase${n === 1 ? '' : 's'} próxima${n === 1 ? '' : 's'}`}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <Toggle checked={i.active} onChange={() => handleToggleActive(i)} label={i.active ? 'Activo' : 'Inactivo'} />
                    {!i.photoUrl && <Badge tone="neutral">Sin foto</Badge>}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => openDialog(i)}>
                  Editar
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <dialog ref={dialogRef} className="m-auto w-full max-w-sm rounded-2xl border border-line bg-surface p-0 text-ink">
        {draft && (
          <form onSubmit={handleSave} className="space-y-4 p-5">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-semibold text-ink">{editing ? 'Editar instructor' : 'Nuevo instructor'}</h3>
              <button type="button" onClick={() => dialogRef.current?.close()} className="text-sm text-ink-muted hover:text-ink">
                Cerrar
              </button>
            </div>

            <div className="flex items-center gap-4">
              <Avatar name={draft.name || '?'} url={shownPhoto} size="h-20 w-20" />
              <div className="space-y-1.5">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  className="hidden"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                  {shownPhoto ? 'Cambiar foto' : 'Subir foto'}
                </Button>
                {shownPhoto && (
                  <Button
                    type="button"
                    variant="dangerLink"
                    size="sm"
                    className="block"
                    onClick={() => {
                      setPhotoFile(null);
                      if (fileRef.current) fileRef.current.value = '';
                      setDraft((d) => d && { ...d, removePhoto: !!editing?.photoUrl });
                    }}
                  >
                    Quitar foto
                  </Button>
                )}
                <p className="text-xs text-ink-muted">Cuadrada, cara centrada. Máx. 5 MB.</p>
              </div>
            </div>

            <div>
              <Label htmlFor="instructorName">Nombre</Label>
              <Input
                id="instructorName"
                required
                autoFocus
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ej. Andrea Ojeda"
              />
            </div>

            <Toggle
              checked={draft.active}
              onChange={() => setDraft({ ...draft, active: !draft.active })}
              label={draft.active ? 'Activo: aparece al crear clases' : 'Inactivo: oculto al crear clases'}
            />

            <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
              <div>
                {editing && (
                  <Button type="button" variant="dangerLink" size="sm" onClick={handleDelete}>
                    Eliminar
                  </Button>
                )}
              </div>
              <Button type="submit" size="sm" disabled={saving || !draft.name.trim()}>
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar instructor'}
              </Button>
            </div>
          </form>
        )}
      </dialog>

      {confirmDialog}
    </div>
  );
}

function Avatar({ name, url, size }: { name: string; url: string | null; size: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return url ? (
    // ponytail: plain <img> -- public Supabase URL, same as news previews
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name} className={`${size} shrink-0 rounded-full border border-line object-cover`} />
  ) : (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-full border border-line bg-surface-alt text-sm font-semibold text-ink-soft`}>
      {initials}
    </div>
  );
}
