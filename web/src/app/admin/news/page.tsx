'use client';

import { useEffect, useRef, useState } from 'react';
import { NewsCtaHref, NewsInput, NewsItem, createNews, deleteNews, listAllNews, setNewsActive, updateNews } from '@/lib/news';
import { uploadNewsImage } from '@/lib/storage';
import { Badge, Button, Card, EmptyState, ErrorBanner, Input, Label, PageHeader, Select } from '@/components/ui';
import { CardPreview, DetailPreview } from '@/components/news-preview';
import { useConfirm } from '@/components/confirm-dialog';

const ctaOptions: { value: NewsCtaHref | ''; label: string }[] = [
  { value: '', label: 'Sin botón' },
  { value: '/bookings', label: 'Reservar clases' },
  { value: '/progress', label: 'Progreso' },
  { value: '/leaderboard', label: 'Ranking' },
];

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type FormState = {
  tag: string;
  title: string;
  subtitle: string;
  bodyText: string; // paragraphs separated by a blank line
  imageUrl: string; // current/uploaded image (edit mode starts with the existing one)
  imageFile: File | null; // pending replacement, uploaded on submit
  ctaHref: NewsCtaHref | '';
  ctaLabel: string;
  publishedAt: string; // datetime-local value
  active: boolean;
};

function emptyForm(): FormState {
  return {
    tag: '',
    title: '',
    subtitle: '',
    bodyText: '',
    imageUrl: '',
    imageFile: null,
    ctaHref: '',
    ctaLabel: '',
    publishedAt: toLocalInput(new Date().toISOString()),
    active: true,
  };
}

function formFromItem(n: NewsItem): FormState {
  return {
    tag: n.tag,
    title: n.title,
    subtitle: n.subtitle,
    bodyText: n.body.join('\n\n'),
    imageUrl: n.imageUrl,
    imageFile: null,
    ctaHref: n.ctaHref ?? '',
    ctaLabel: n.ctaLabel ?? '',
    publishedAt: toLocalInput(n.publishedAt),
    active: n.active,
  };
}

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  // Local preview for a not-yet-uploaded file; falls back to the stored URL
  // (empty for a brand-new item, the existing image when editing).
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!form.imageFile) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(form.imageFile);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [form.imageFile]);
  const previewImageUrl = objectUrl ?? form.imageUrl;

  async function refresh() {
    setLoading(true);
    try {
      setItems(await listAllNews());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar noticias.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const body = form.bodyText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const hasImage = !!form.imageFile || !!form.imageUrl.trim();
  const canSubmit = form.tag.trim() && form.title.trim() && form.subtitle.trim() && hasImage && body.length > 0 && (!form.ctaHref || form.ctaLabel.trim());

  function startEdit(n: NewsItem) {
    setEditingId(n.id);
    setForm(formFromItem(n));
    if (fileInputRef.current) fileInputRef.current.value = '';
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm());
    if (fileInputRef.current) fileInputRef.current.value = '';
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || saving) return;
    setSaving(true);
    setError(null);

    let imageUrl = form.imageUrl;
    if (form.imageFile) {
      const { url, error: uploadError } = await uploadNewsImage(form.imageFile);
      if (uploadError || !url) {
        setSaving(false);
        setError(uploadError?.message ?? 'No se pudo subir la imagen.');
        return;
      }
      imageUrl = url;
    }

    const input: NewsInput = {
      tag: form.tag.trim(),
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      body,
      imageUrl,
      ctaHref: form.ctaHref || null,
      ctaLabel: form.ctaHref ? form.ctaLabel.trim() : null,
      publishedAt: new Date(form.publishedAt).toISOString(),
      active: form.active,
    };
    const { error } = editingId ? await updateNews(editingId, input) : await createNews(input);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    startCreate();
    refresh();
  }

  async function handleToggleActive(n: NewsItem) {
    const { error } = await setNewsActive(n.id, !n.active);
    if (error) {
      setError(error.message);
      return;
    }
    refresh();
  }

  async function handleDelete(n: NewsItem) {
    const ok = await confirm({
      title: 'Eliminar noticia',
      message: `¿Eliminar "${n.title}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'Sí, eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    const { error } = await deleteNews(n.id);
    if (error) {
      setError(error.message);
      return;
    }
    if (editingId === n.id) startCreate();
    refresh();
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Noticias" description="Banners del carrusel de inicio de la app. La misma imagen se recorta distinto en la tarjeta y en el detalle -- revisa ambas previsualizaciones." />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {editingId ? 'Editar noticia' : 'Nueva noticia'}
          </p>
          {editingId && (
            <Button type="button" variant="link" size="sm" onClick={startCreate}>
              Cancelar edición
            </Button>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_428px]">
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="tag">Tag</Label>
                <Input id="tag" required placeholder="Reto, Nuevo, Comunidad..." value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="publishedAt">Fecha de publicación</Label>
                <Input
                  id="publishedAt"
                  type="datetime-local"
                  required
                  value={form.publishedAt}
                  onChange={(e) => setForm({ ...form, publishedAt: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="title">Título</Label>
              <Input id="title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>

            <div>
              <Label htmlFor="subtitle">Subtítulo</Label>
              <Input id="subtitle" required value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
            </div>

            <div>
              <Label htmlFor="image">Imagen</Label>
              <input
                id="image"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => setForm({ ...form, imageFile: e.target.files?.[0] ?? null })}
                className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-on-accent hover:file:bg-ink/90"
              />
              <p className="mt-1 text-xs text-ink-muted">
                {editingId && form.imageUrl && !form.imageFile
                  ? 'Deja este campo vacío para conservar la imagen actual, o elige un archivo para reemplazarla. '
                  : ''}
                Recomendado: foto cuadrada o vertical con el sujeto centrado -- se recorta ancha y corta en la tarjeta, alta y angosta en el detalle. Máx. 5 MB.
              </p>
            </div>

            <div>
              <Label htmlFor="body">Cuerpo (un párrafo por bloque, separado por línea en blanco)</Label>
              <textarea
                id="body"
                required
                rows={6}
                value={form.bodyText}
                onChange={(e) => setForm({ ...form, bodyText: e.target.value })}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-ink-muted focus:outline-none focus:ring-2 focus:ring-mint/30"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="ctaHref">Botón (opcional)</Label>
                <Select
                  id="ctaHref"
                  value={form.ctaHref}
                  onChange={(e) => setForm({ ...form, ctaHref: e.target.value as NewsCtaHref | '' })}
                >
                  {ctaOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="ctaLabel">Texto del botón</Label>
                <Input
                  id="ctaLabel"
                  disabled={!form.ctaHref}
                  placeholder={form.ctaHref ? 'Ej. Reservar mi clase' : 'Elige un destino primero'}
                  value={form.ctaLabel}
                  onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                className="accent-mint"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Visible en la app
            </label>

            <Button type="submit" disabled={!canSubmit || saving}>
              {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Publicar noticia'}
            </Button>
          </form>

          <div className="space-y-6">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Vista: carrusel (Home)</p>
              <CardPreview tag={form.tag} title={form.title} subtitle={form.subtitle} imageUrl={previewImageUrl} />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Vista: detalle</p>
              <DetailPreview tag={form.tag} title={form.title} subtitle={form.subtitle} imageUrl={previewImageUrl} publishedAt={form.publishedAt} />
            </div>
            <p className="text-xs text-ink-muted">
              Aproximado: el recorte real varía unos px según el teléfono. Esta vista usa el ancho de un teléfono grande a
              propósito, así que en pantallas más angostas se verá igual o mejor, nunca más recortado.
            </p>
          </div>
        </div>
      </Card>

      {loading ? (
        <p className="text-sm text-ink-soft">Cargando...</p>
      ) : items.length === 0 ? (
        <EmptyState>Sin noticias todavía.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-alt text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="px-4 py-2.5" />
                <th className="px-4 py-2.5 font-medium">Título</th>
                <th className="px-4 py-2.5 font-medium">Tag</th>
                <th className="px-4 py-2.5 font-medium">Publicada</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {items.map((n) => (
                <tr key={n.id} className="border-b border-line text-ink last:border-0 hover:bg-surface-alt/60">
                  <td className="px-4 py-2.5">
                    {/* ponytail: plain <img>, see news-preview.tsx -- arbitrary external URL */}
                    <img src={n.imageUrl} alt="" className="h-9 w-14 rounded object-cover" />
                  </td>
                  <td className="px-4 py-3 font-medium">{n.title}</td>
                  <td className="px-4 py-3 text-ink-soft">{n.tag}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {new Date(n.publishedAt).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggleActive(n)}>
                      <Badge tone={n.active ? 'mint' : 'neutral'}>{n.active ? 'Visible' : 'Oculta'}</Badge>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <Button variant="link" size="sm" onClick={() => startEdit(n)}>
                        Editar
                      </Button>
                      <Button variant="dangerLink" size="sm" onClick={() => handleDelete(n)}>
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmDialog}
    </div>
  );
}
