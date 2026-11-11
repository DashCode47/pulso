'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Member,
  Membership,
  MembershipInput,
  adjustCredits,
  cancelMembership,
  createMembership,
  getLatestMembership,
  grantCreditsBulk,
  searchMembers,
  updateMembership,
} from '@/lib/members';
import { STUDIO_TZ, addDays } from '@/lib/classes';
import { describeError } from '@/lib/errors';
import { Badge, Button, EmptyState, ErrorBanner, Input, Label, PageHeader, TableCard } from '@/components/ui';
import { useConfirm } from '@/components/confirm-dialog';
import { toast, toastError } from '@/components/toast';

const membershipStatusLabel: Record<NonNullable<Member['membershipStatus']>, string> = {
  active: 'Activa',
  cancelled: 'Cancelada',
  expired: 'Vencida',
};

const membershipStatusTone: Record<NonNullable<Member['membershipStatus']>, 'mint' | 'coral' | 'neutral'> = {
  active: 'mint',
  expired: 'coral',
  cancelled: 'neutral',
};

function formatDate(isoDate: string) {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Studio date as YYYY-MM-DD (en-CA), regardless of the admin's own timezone.
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: STUDIO_TZ });
const emptyForm = (): MembershipInput => ({ planName: 'Standard', creditsPerCycle: 10, weeklyGoal: 3, cycleStart: today() });
// Earliest start whose cycle (start + 1 month - 1 day) hasn't ended yet; the DB
// enforces the exact rule (cycle_already_over).
function minCycleStart() {
  const d = new Date(`${today()}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 1);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const EXPIRING_DAYS = 7;
const isExpiringSoon = (m: Member) => m.membershipStatus === 'active' && !!m.cycleEnd && m.cycleEnd <= addDays(today(), EXPIRING_DAYS);

type Filter = 'all' | 'active' | 'expiring' | 'expired' | 'none';
const filters: { value: Filter; label: string; match: (m: Member) => boolean }[] = [
  { value: 'all', label: 'Todos', match: () => true },
  { value: 'active', label: 'Activas', match: (m) => m.membershipStatus === 'active' },
  { value: 'expiring', label: `Vencen en ${EXPIRING_DAYS} días`, match: isExpiringSoon },
  { value: 'expired', label: 'Vencidas', match: (m) => m.membershipStatus === 'expired' },
  { value: 'none', label: 'Sin membresía', match: (m) => !m.membershipStatus || m.membershipStatus === 'cancelled' },
];

export default function MembersPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Member | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [form, setForm] = useState<MembershipInput>(emptyForm());
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNote, setCreditNote] = useState('');
  const [adjustingCredits, setAdjustingCredits] = useState(false);
  const modalRef = useRef<HTMLDialogElement>(null);

  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [renewing, setRenewing] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

  // Keeps the current table on screen while refreshing -- only the very first
  // load shows the loading state, so saves and searches don't flash/jump.
  async function refresh(q = query) {
    setSearching(true);
    try {
      setMembers(await searchMembers(q));
      setLoadError(null);
    } catch (e) {
      setLoadError(describeError(e, 'No se pudieron cargar los miembros.'));
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }

  useEffect(() => {
    const id = setTimeout(() => refresh(query), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function openMember(m: Member) {
    setSelected(m);
    setCreditAmount('');
    setCreditNote('');
    setDetailLoading(true);
    modalRef.current?.showModal();
    try {
      const latest = await getLatestMembership(m.userId);
      setMembership(latest);
      // Expired/cancelled: the next cycle defaults to starting today; active: edit the current start.
      const restarts = !latest || latest.status === 'expired' || latest.status === 'cancelled';
      setForm(
        latest
          ? { planName: latest.planName, creditsPerCycle: latest.creditsPerCycle, weeklyGoal: latest.weeklyGoal, cycleStart: restarts ? today() : latest.cycleStart }
          : emptyForm(),
      );
    } catch (e) {
      toastError(e, 'No se pudo cargar la membresía.');
      modalRef.current?.close();
    } finally {
      setDetailLoading(false);
    }
  }

  // A cancelled membership is historical -- assigning again starts a fresh
  // row (like a member re-enrolling) instead of un-cancelling the old one.
  const editableMembership = membership && membership.status !== 'cancelled' ? membership : null;
  // ponytail: an expired membership is renewed in place (same row) -- the
  // credit_transactions ledger already keeps one 'grant' per renewal as history.
  const isExpired = membership?.status === 'expired';

  async function handleSaveMembership(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);

    let { error } = editableMembership
      ? await updateMembership(editableMembership.id, form)
      : await createMembership(selected.userId, form);
    // Save plan changes first so the renewal grants the new plan's credits.
    if (!error && isExpired) ({ error } = await grantCreditsBulk([selected.userId], form.cycleStart));
    setSaving(false);
    if (error) {
      toastError(error, 'No se pudo guardar la membresía.');
      return;
    }
    toast(isExpired ? `Membresía de ${selected.fullName} renovada.` : editableMembership ? 'Membresía actualizada.' : `Membresía asignada a ${selected.fullName}.`);
    modalRef.current?.close();
    refresh();
  }

  async function handleCancelMembership() {
    if (!editableMembership || !selected) return;
    const ok = await confirm({
      title: 'Cancelar membresía',
      message: `Se cancelarán las reservas futuras de ${selected.fullName} y perderá sus ${selected.creditsBalance} créditos. No se puede deshacer.`,
      confirmLabel: 'Sí, cancelar membresía',
      cancelLabel: 'Volver',
      tone: 'danger',
    });
    if (!ok) return;
    const { error } = await cancelMembership(editableMembership.id);
    if (error) {
      toastError(error, 'No se pudo cancelar la membresía.');
      return;
    }
    toast(`Membresía de ${selected.fullName} cancelada.`);
    modalRef.current?.close();
    refresh();
  }

  async function handleRenewOne() {
    if (!selected) return;
    const ok = await confirm({
      title: 'Renovar créditos',
      message: `¿Renovar a ${selected.fullName} desde hoy? El ciclo reinicia y los créditos no usados se pierden.`,
      confirmLabel: 'Sí, renovar',
    });
    if (!ok) return;
    setRenewing(true);
    const { error } = await grantCreditsBulk([selected.userId], today());
    setRenewing(false);
    if (error) {
      toastError(error, 'No se pudo renovar.');
      return;
    }
    toast(`${selected.fullName} renovado.`);
    modalRef.current?.close();
    refresh();
  }

  async function handleAdjustCredits(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const amount = Number(creditAmount);
    if (!Number.isInteger(amount) || amount === 0) return;
    if (selected.creditsBalance + amount < 0) {
      toastError({ message: 'negative_balance' });
      return;
    }
    setAdjustingCredits(true);
    const { error } = await adjustCredits(selected.userId, amount, creditNote.trim());
    setAdjustingCredits(false);
    if (error) {
      toastError(error, 'No se pudieron ajustar los créditos.');
      return;
    }
    setCreditAmount('');
    setCreditNote('');
    setSelected({ ...selected, creditsBalance: selected.creditsBalance + amount });
    toast(`${amount > 0 ? '+' : ''}${amount} créditos aplicados.`);
    refresh();
  }

  const visible = members.filter(filters.find((f) => f.value === filter)!.match);
  const renewableMembers = visible.filter((m) => m.membershipStatus === 'active' || m.membershipStatus === 'expired');

  function toggleChecked(userId: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function toggleAllChecked() {
    setCheckedIds((prev) => (prev.size === renewableMembers.length ? new Set() : new Set(renewableMembers.map((m) => m.userId))));
  }

  async function handleRenewSelected() {
    if (checkedIds.size === 0) return;
    const ok = await confirm({
      title: 'Renovar créditos',
      message: `¿Renovar ${checkedIds.size} miembro${checkedIds.size === 1 ? '' : 's'} desde hoy? El ciclo reinicia y los créditos no usados se pierden.`,
      confirmLabel: 'Sí, renovar',
    });
    if (!ok) return;
    setRenewing(true);
    const { error } = await grantCreditsBulk([...checkedIds], today());
    setRenewing(false);
    if (error) {
      toastError(error, 'No se pudo renovar.');
      return;
    }
    toast(`${checkedIds.size} miembro${checkedIds.size === 1 ? '' : 's'} renovado${checkedIds.size === 1 ? '' : 's'}.`);
    setCheckedIds(new Set());
    refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Miembros" description="Busca un miembro para asignar o editar su membresía y créditos." />

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCheckedIds(new Set()); // a selection only makes sense for the rows on screen
          }}
          placeholder="Buscar por nombre..."
          aria-label="Buscar miembros"
          className="max-w-sm"
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por membresía">
          {filters.map((f) => {
            const count = members.filter(f.match).length;
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={filter === f.value}
                onClick={() => {
                  setFilter(f.value);
                  setCheckedIds(new Set());
                }}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  filter === f.value ? 'border-mint bg-mint-soft text-ink' : 'border-line text-ink-soft hover:text-ink'
                }`}
              >
                {f.label} <span className="tabular-nums text-ink-muted">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loadError && <ErrorBanner>{loadError}</ErrorBanner>}

      {checkedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-mint-soft px-4 py-2.5 text-sm">
          <span className="text-ink">
            {checkedIds.size} seleccionado{checkedIds.size === 1 ? '' : 's'}
          </span>
          <Button size="sm" onClick={handleRenewSelected} disabled={renewing}>
            {renewing ? 'Renovando...' : 'Renovar créditos'}
          </Button>
          <Button size="sm" variant="link" onClick={() => setCheckedIds(new Set())}>
            Quitar selección
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink-soft">Cargando...</p>
      ) : visible.length === 0 ? (
        <EmptyState>{query ? `Ningún miembro coincide con "${query}".` : 'No hay miembros en esta categoría.'}</EmptyState>
      ) : (
        <div className={`transition-opacity ${searching ? 'opacity-60' : ''}`}>
          <TableCard>
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-alt text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="w-10 px-4 py-2.5">
                    <input
                      type="checkbox"
                      className="accent-mint"
                      aria-label="Seleccionar todos"
                      disabled={renewableMembers.length === 0}
                      checked={renewableMembers.length > 0 && checkedIds.size === renewableMembers.length}
                      onChange={toggleAllChecked}
                    />
                  </th>
                  <th className="px-4 py-2.5 font-medium">Nombre</th>
                  <th className="px-4 py-2.5 font-medium">Créditos</th>
                  <th className="px-4 py-2.5 font-medium">Membresía</th>
                  <th className="px-4 py-2.5 font-medium">Desde</th>
                  <th className="px-4 py-2.5 font-medium">Vence</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {visible.map((m) => (
                  <tr key={m.userId} className="border-b border-line text-ink last:border-0 hover:bg-surface-alt/60">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="accent-mint"
                        aria-label={`Seleccionar ${m.fullName}`}
                        disabled={m.membershipStatus !== 'active' && m.membershipStatus !== 'expired'}
                        checked={checkedIds.has(m.userId)}
                        onChange={() => toggleChecked(m.userId)}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">{m.fullName}</td>
                    <td className="px-4 py-3 tabular-nums text-ink-soft">{m.creditsBalance}</td>
                    <td className="px-4 py-3">
                      {m.membershipStatus ? (
                        <Badge tone={membershipStatusTone[m.membershipStatus]}>{membershipStatusLabel[m.membershipStatus]}</Badge>
                      ) : (
                        <span className="text-ink-muted">Sin membresía</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{m.cycleStart ? formatDate(m.cycleStart) : '—'}</td>
                    <td className={`px-4 py-3 ${isExpiringSoon(m) ? 'font-medium text-coral' : 'text-ink-soft'}`}>
                      {m.cycleEnd ? formatDate(m.cycleEnd) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openMember(m)}>
                        Gestionar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        </div>
      )}

      <dialog ref={modalRef} className="m-auto w-full max-w-md rounded-2xl border border-line bg-surface p-0 text-ink">
        <div className="space-y-5 p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink">{selected?.fullName}</h3>
              <p className="text-xs text-ink-soft">Saldo actual: {selected?.creditsBalance} créditos</p>
            </div>
            <button onClick={() => modalRef.current?.close()} className="text-sm text-ink-muted hover:text-ink">
              Cerrar
            </button>
          </div>

          {detailLoading ? (
            <p className="text-sm text-ink-soft">Cargando...</p>
          ) : (
            <>
              <form onSubmit={handleSaveMembership} className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {isExpired ? 'Renovar membresía' : editableMembership ? 'Editar membresía' : 'Asignar membresía'}
                </p>
                {membership && (
                  <p className="text-xs text-ink-muted">
                    {membershipStatusLabel[membership.status]} · {isExpired ? 'venció' : 'vence'} {formatDate(membership.cycleEnd)}
                  </p>
                )}
                <div>
                  <Label htmlFor="plan">Plan</Label>
                  <Input id="plan" required value={form.planName} onChange={(e) => setForm({ ...form, planName: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="cycleStart">Inicio (dura 1 mes)</Label>
                  <Input
                    id="cycleStart"
                    type="date"
                    required
                    min={form.cycleStart === membership?.cycleStart ? undefined : minCycleStart()}
                    value={form.cycleStart}
                    onChange={(e) => setForm({ ...form, cycleStart: e.target.value })}
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Label htmlFor="creditsPerCycle">Créditos/ciclo</Label>
                    <Input
                      id="creditsPerCycle"
                      type="number"
                      required
                      min={0}
                      value={form.creditsPerCycle}
                      onChange={(e) => setForm({ ...form, creditsPerCycle: Number(e.target.value) })}
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="weeklyGoal">Meta semanal</Label>
                    <Input
                      id="weeklyGoal"
                      type="number"
                      required
                      min={0}
                      value={form.weeklyGoal}
                      onChange={(e) => setForm({ ...form, weeklyGoal: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={saving}>
                      {saving ? 'Guardando...' : isExpired ? 'Renovar membresía' : editableMembership ? 'Guardar cambios' : 'Asignar membresía'}
                    </Button>
                    {membership?.status === 'active' && (
                      <Button type="button" variant="ghost" size="sm" disabled={renewing} onClick={handleRenewOne}>
                        Renovar créditos
                      </Button>
                    )}
                  </div>
                  {/* An expired membership has nothing left to cancel: bookings and credits were already released. */}
                  {editableMembership && !isExpired && (
                    <Button type="button" variant="dangerLink" size="sm" onClick={handleCancelMembership}>
                      Cancelar membresía
                    </Button>
                  )}
                </div>
              </form>

              <form onSubmit={handleAdjustCredits} className="space-y-3 border-t border-line pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Ajustar créditos</p>
                <div className="flex gap-2">
                  <div className="w-24">
                    <Label htmlFor="creditAmount">Cantidad</Label>
                    <Input
                      id="creditAmount"
                      type="number"
                      step={1}
                      placeholder="+5 / -2"
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="creditNote">Nota (opcional)</Label>
                    <Input id="creditNote" placeholder="Ej. cortesía" value={creditNote} onChange={(e) => setCreditNote(e.target.value)} />
                  </div>
                  <Button type="submit" size="sm" className="self-end" disabled={adjustingCredits || !Number(creditAmount)}>
                    Aplicar
                  </Button>
                </div>
                {!!Number(creditAmount) && selected && (
                  <p className="text-xs text-ink-soft">
                    Nuevo saldo: {selected.creditsBalance} → {selected.creditsBalance + Number(creditAmount)}
                  </p>
                )}
              </form>
            </>
          )}
        </div>
      </dialog>

      {confirmDialog}
    </div>
  );
}
