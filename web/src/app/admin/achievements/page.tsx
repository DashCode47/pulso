'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Achievement,
  AchievementIcon,
  AchievementInput,
  AchievementRule,
  createAchievement,
  describeRule,
  iconOptions,
  listAchievements,
  removeAchievement,
  ruleNeedsHour,
  ruleOptions,
  updateAchievement,
  weekdayOptions,
} from '@/lib/achievements';
import { Instructor, listInstructors } from '@/lib/instructors';
import { Badge, Button, Card, EmptyState, ErrorBanner, Input, Label, PageHeader, Select } from '@/components/ui';
import { useConfirm } from '@/components/confirm-dialog';

type FormState = {
  name: string;
  description: string; // empty = use the generated one
  xpReward: string;
  icon: AchievementIcon;
  rule: AchievementRule;
  threshold: string;
  hour: string;
  instructorId: string;
  weekday: string;
  allTime: boolean;
  startsOn: string;
  hasEnd: boolean;
  endsOn: string;
};

// Bogota calendar date, the same day the backend uses for start/end.
function bogotaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

function emptyForm(): FormState {
  return {
    name: '',
    description: '',
    xpReward: '100',
    icon: 'trophy',
    rule: 'classes_total',
    threshold: '1',
    hour: '9',
    instructorId: '',
    weekday: '6',
    allTime: true,
    startsOn: bogotaToday(),
    hasEnd: false,
    endsOn: '',
  };
}

function formFromAchievement(a: Achievement): FormState {
  return {
    name: a.name,
    description: a.description,
    xpReward: String(a.xpReward),
    icon: a.icon,
    rule: a.rule,
    threshold: String(a.threshold),
    hour: String(a.hour ?? 9),
    instructorId: a.instructorId ?? '',
    weekday: String(a.weekday ?? 6),
    allTime: !a.startsOn,
    startsOn: a.startsOn ?? bogotaToday(),
    hasEnd: !!a.endsOn,
    endsOn: a.endsOn ?? '',
  };
}

function formatDate(isoDate: string) {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

function windowLabel(a: Pick<Achievement, 'startsOn' | 'endsOn'>) {
  const from = a.startsOn ? `Desde ${formatDate(a.startsOn)}` : 'Desde siempre';
  return a.endsOn ? `${from} · hasta ${formatDate(a.endsOn)}` : from;
}

function status(a: Achievement, today: string): { label: string; tone: 'mint' | 'neutral' | 'accent' } {
  if (a.startsOn && a.startsOn > today) return { label: 'Programado', tone: 'accent' };
  if (a.endsOn && a.endsOn < today) return { label: 'Finalizado', tone: 'neutral' };
  return { label: 'Activo', tone: 'mint' };
}

export default function AchievementsPage() {
  const [items, setItems] = useState<Achievement[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const today = bogotaToday();

  async function refresh() {
    setLoading(true);
    try {
      const [achievements, coaches] = await Promise.all([listAchievements(), listInstructors()]);
      setItems(achievements);
      setInstructors(coaches);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar logros.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const ruleOption = ruleOptions.find((r) => r.value === form.rule)!;
  const threshold = Number(form.threshold);
  const xpReward = Number(form.xpReward);
  const instructorName = instructors.find((i) => i.id === form.instructorId)?.name;
  const suggestedDescription = describeRule(
    { rule: form.rule, threshold, hour: Number(form.hour), weekday: Number(form.weekday) },
    instructorName,
  );
  const datesValid =
    (form.allTime || !!form.startsOn) &&
    (!form.hasEnd || (!!form.endsOn && (form.allTime || form.endsOn >= form.startsOn)));
  const canSubmit =
    form.name.trim() &&
    Number.isInteger(threshold) && threshold > 0 &&
    Number.isInteger(xpReward) && xpReward >= 0 &&
    (form.rule !== 'classes_with_instructor' || form.instructorId) &&
    datesValid;

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function startEdit(a: Achievement) {
    setEditingId(a.id);
    setForm(formFromAchievement(a));
    scrollToForm();
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || saving) return;

    const input: AchievementInput = {
      name: form.name.trim(),
      description: form.description.trim() || suggestedDescription,
      xpReward,
      icon: form.icon,
      rule: form.rule,
      threshold,
      hour: ruleNeedsHour(form.rule) ? Number(form.hour) : null,
      instructorId: form.rule === 'classes_with_instructor' ? form.instructorId : null,
      weekday: form.rule === 'classes_on_weekday' ? Number(form.weekday) : null,
      startsOn: form.allTime ? null : form.startsOn,
      endsOn: form.hasEnd ? form.endsOn : null,
    };

    if (!editingId) {
      const ok = await confirm({
        title: 'Crear logro',
        message: input.startsOn
          ? `Solo contarán las clases desde el ${formatDate(input.startsOn)}. El logro estará oculto en la app hasta esa fecha.`
          : 'Cuenta todo el historial: los miembros que ya cumplen la regla lo desbloquean (y reciben su XP) en cuanto lo guardes.',
        confirmLabel: 'Crear logro',
      });
      if (!ok) return;
    }

    setSaving(true);
    setError(null);
    const { error } = editingId ? await updateAchievement(editingId, input) : await createAchievement(input);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    startCreate();
    refresh();
  }

  async function handleRemove(a: Achievement) {
    const ok = await confirm({
      title: 'Eliminar logro',
      message:
        a.unlockCount > 0
          ? `"${a.name}" desaparecerá de la app. Los ${a.unlockCount} miembros que lo desbloquearon conservan su XP. No se puede deshacer.`
          : `"${a.name}" desaparecerá de la app. No se puede deshacer.`,
      confirmLabel: 'Sí, eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    const { error } = await removeAchievement(a.id);
    if (error) {
      setError(error.message);
      return;
    }
    if (editingId === a.id) startCreate();
    refresh();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Logros"
        description="Cada logro usa una regla y sus números. Un logro que algún miembro ya desbloqueó no se puede editar; si lo eliminas, los miembros conservan el XP."
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div ref={formRef}>
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {editingId ? 'Editar logro' : 'Nuevo logro'}
            </p>
            {editingId && (
              <Button type="button" variant="link" size="sm" onClick={startCreate}>
                Cancelar edición
              </Button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-[1fr_160px_160px]">
              <div>
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" required placeholder="Ej. Weekend Warrior" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="icon">Ícono</Label>
                <Select id="icon" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value as AchievementIcon })}>
                  {iconOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="xp">XP</Label>
                <Input id="xp" type="number" min={0} step={1} required value={form.xpReward} onChange={(e) => setForm({ ...form, xpReward: e.target.value })} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_180px_1fr]">
              <div>
                <Label htmlFor="rule">Regla</Label>
                <Select id="rule" value={form.rule} onChange={(e) => setForm({ ...form, rule: e.target.value as AchievementRule })}>
                  {ruleOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="threshold">{ruleOption.thresholdLabel}</Label>
                <Input id="threshold" type="number" min={1} step={1} required value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} />
              </div>
              <div>
                {ruleNeedsHour(form.rule) && (
                  <>
                    <Label htmlFor="hour">{form.rule === 'classes_before_hour' ? 'Clases que empiezan antes de' : 'Clases que empiezan desde'}</Label>
                    <Select id="hour" value={form.hour} onChange={(e) => setForm({ ...form, hour: e.target.value })}>
                      {Array.from({ length: 24 }, (_, h) => (
                        <option key={h} value={h}>
                          {String(h).padStart(2, '0')}:00
                        </option>
                      ))}
                    </Select>
                  </>
                )}
                {form.rule === 'classes_with_instructor' && (
                  <>
                    <Label htmlFor="instructor">Instructor</Label>
                    <Select id="instructor" required value={form.instructorId} onChange={(e) => setForm({ ...form, instructorId: e.target.value })}>
                      <option value="">Elige un instructor</option>
                      {instructors
                        .filter((i) => i.active || i.id === form.instructorId)
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                    </Select>
                  </>
                )}
                {form.rule === 'classes_on_weekday' && (
                  <>
                    <Label htmlFor="weekday">Día</Label>
                    <Select id="weekday" value={form.weekday} onChange={(e) => setForm({ ...form, weekday: e.target.value })}>
                      {weekdayOptions.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </Select>
                  </>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="description">Descripción (lo que ve el miembro)</Label>
              <Input
                id="description"
                placeholder={suggestedDescription}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <p className="mt-1 text-xs text-ink-muted">Déjala vacía para usar: &ldquo;{suggestedDescription}&rdquo;.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset className="space-y-2">
                <Label>Cuenta clases</Label>
                <label className="flex items-center gap-2 text-sm text-ink-soft">
                  <input type="radio" className="accent-mint" checked={form.allTime} onChange={() => setForm({ ...form, allTime: true })} />
                  Desde siempre (todo el historial cuenta)
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-soft">
                  <input type="radio" className="accent-mint" checked={!form.allTime} onChange={() => setForm({ ...form, allTime: false })} />
                  Desde una fecha
                </label>
                {!form.allTime && (
                  <Input type="date" required value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} />
                )}
                <p className="text-xs text-ink-muted">
                  {form.allTime
                    ? 'Quien ya cumple la regla lo desbloquea al guardar.'
                    : 'Las clases anteriores no cuentan. Oculto en la app hasta ese día.'}
                </p>
              </fieldset>

              <fieldset className="space-y-2">
                <Label>Fecha de fin</Label>
                <label className="flex items-center gap-2 text-sm text-ink-soft">
                  <input type="checkbox" className="accent-mint" checked={form.hasEnd} onChange={(e) => setForm({ ...form, hasEnd: e.target.checked })} />
                  Logro por tiempo limitado
                </label>
                {form.hasEnd && (
                  <Input
                    type="date"
                    required
                    min={form.allTime ? undefined : form.startsOn}
                    value={form.endsOn}
                    onChange={(e) => setForm({ ...form, endsOn: e.target.value })}
                  />
                )}
                <p className="text-xs text-ink-muted">
                  {form.hasEnd
                    ? 'Solo cuentan clases hasta ese día (incluido). Después desaparece para quien no lo ganó.'
                    : 'Sin fecha de fin.'}
                </p>
              </fieldset>
            </div>

            <Button type="submit" disabled={!canSubmit || saving}>
              {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear logro'}
            </Button>
          </form>
        </Card>
      </div>

      {loading ? (
        <p className="text-sm text-ink-soft">Cargando...</p>
      ) : items.length === 0 ? (
        <EmptyState>Sin logros todavía.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-alt text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="px-4 py-2.5 font-medium">Logro</th>
                <th className="px-4 py-2.5 font-medium">Regla</th>
                <th className="px-4 py-2.5 font-medium">Vigencia</th>
                <th className="px-4 py-2.5 font-medium">XP</th>
                <th className="px-4 py-2.5 font-medium">Desbloqueos</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {items.map((a) => {
                const s = status(a, today);
                const locked = a.unlockCount > 0;
                return (
                  <tr key={a.id} className="border-b border-line text-ink last:border-0 hover:bg-surface-alt/60">
                    <td className="px-4 py-3">
                      <p className="font-medium">{a.name}</p>
                      <p className="text-xs text-ink-muted">{a.description}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {describeRule(a, instructors.find((i) => i.id === a.instructorId)?.name)}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{windowLabel(a)}</td>
                    <td className="px-4 py-3 text-ink-soft">{a.xpReward}</td>
                    <td className="px-4 py-3 text-ink-soft">{a.unlockCount}</td>
                    <td className="px-4 py-3">
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        <Button
                          variant="link"
                          size="sm"
                          disabled={locked}
                          title={locked ? 'Ya fue desbloqueado: no se puede editar' : undefined}
                          onClick={() => startEdit(a)}
                        >
                          {locked ? 'Bloqueado' : 'Editar'}
                        </Button>
                        <Button variant="dangerLink" size="sm" onClick={() => handleRemove(a)}>
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirmDialog}
    </div>
  );
}
