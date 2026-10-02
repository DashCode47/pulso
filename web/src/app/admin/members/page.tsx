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
import { STUDIO_TZ } from '@/lib/classes';
import { Badge, Button, EmptyState, ErrorBanner, Input, Label, PageHeader } from '@/components/ui';
import { useConfirm } from '@/components/confirm-dialog';

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

const dbErrorMessages: Record<string, string> = {
  cycle_already_over: 'Con esa fecha de inicio la membresía ya habría vencido.',
  negative_balance: 'El saldo no puede quedar negativo.',
};
const describeError = (message: string) => dbErrorMessages[message] ?? message;

export default function MembersPage() {
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  async function refresh(q: string) {
    setLoading(true);
    try {
      setMembers(await searchMembers(q));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al buscar miembros.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const id = setTimeout(() => refresh(query), 250);
    return () => clearTimeout(id);
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
      setError(e instanceof Error ? e.message : 'Error al cargar membresía.');
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
    setError(null);

    let { error } = editableMembership
      ? await updateMembership(editableMembership.id, form)
      : await createMembership(selected.userId, form);
    // Save plan changes first so the renewal grants the new plan's credits.
    if (!error && isExpired) ({ error } = await grantCreditsBulk([selected.userId], form.cycleStart));
    setSaving(false);
    if (error) {
      setError(describeError(error.message));
      return;
    }
    modalRef.current?.close();
    refresh(query);
  }

  async function handleCancelMembership() {
    if (!editableMembership || !selected) return;
    const ok = await confirm({
      title: 'Cancelar membresía',
      message: `Se cancelarán las reservas futuras de ${selected.fullName} y perderá sus créditos.`,
      confirmLabel: 'Sí, cancelar',
    });
    if (!ok) return;
    const { error } = await cancelMembership(editableMembership.id);
    if (error) {
      setError(describeError(error.message));
      return;
    }
    modalRef.current?.close();
    refresh(query);
  }

  async function handleRenewOne() {
    if (!selected) return;
    const ok = await confirm({
      title: 'Renovar créditos',
      message: `¿Renovar a ${selected.fullName} desde hoy? Los créditos no usados se pierden.`,
      confirmLabel: 'Sí, renovar',
    });
    if (!ok) return;
    setRenewing(true);
    const { error } = await grantCreditsBulk([selected.userId], today());
    setRenewing(false);
    if (error) {
      setError(describeError(error.message));
      return;
    }
    modalRef.current?.close();
    refresh(query);
  }

  async function handleAdjustCredits(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const amount = Number(creditAmount);
    if (!amount) return;
    if (selected.creditsBalance + amount < 0) {
      setError(dbErrorMessages.negative_balance);
      return;
    }
    setAdjustingCredits(true);
    const { error } = await adjustCredits(selected.userId, amount, creditNote.trim());
    setAdjustingCredits(false);
    if (error) {
      setError(describeError(error.message));
      return;
    }
    setCreditAmount('');
    setCreditNote('');
    setSelected({ ...selected, creditsBalance: selected.creditsBalance + amount });
    refresh(query);
  }

  const renewableMembers = members.filter((m) => m.membershipStatus === 'active' || m.membershipStatus === 'expired');

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
      message: `¿Renovar ${checkedIds.size} miembro(s) desde hoy? Los créditos no usados se pierden.`,
      confirmLabel: 'Sí, renovar',
    });
    if (!ok) return;
    setRenewing(true);
    const { error } = await grantCreditsBulk([...checkedIds], today());
    setRenewing(false);
    if (error) {
      setError(describeError(error.message));
      return;
    }
    setCheckedIds(new Set());
    refresh(query);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Miembros" description="Busca un miembro para asignar o editar su membresía y créditos." />

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nombre..."
        className="max-w-sm"
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {checkedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-mint-soft px-4 py-2.5 text-sm">
          <span className="text-ink">{checkedIds.size} seleccionado(s)</span>
          <Button size="sm" onClick={handleRenewSelected} disabled={renewing}>
            {renewing ? 'Renovando...' : 'Renovar créditos'}
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink-soft">Cargando...</p>
      ) : members.length === 0 ? (
        <EmptyState>Sin resultados.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-alt text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="w-10 px-4 py-2.5">
                  <input
                    type="checkbox"
                    className="accent-mint"
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
              {members.map((m) => (
                <tr key={m.userId} className="border-b border-line text-ink last:border-0 hover:bg-surface-alt/60">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="accent-mint"
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
                  <td className="px-4 py-3 text-ink-soft">{m.cycleEnd ? formatDate(m.cycleEnd) : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="link" size="sm" onClick={() => openMember(m)}>
                      Gestionar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <dialog ref={modalRef} className="m-auto w-full max-w-md rounded-2xl border border-line bg-surface p-0 text-ink">
        <div className="space-y-5 p-5">
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-semibold text-ink">{selected?.fullName}</h3>
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
                <div className="flex items-center justify-between pt-1">
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={saving}>
                      {isExpired ? 'Renovar membresía' : editableMembership ? 'Guardar cambios' : 'Asignar membresía'}
                    </Button>
                    {membership?.status === 'active' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={renewing}
                        onClick={handleRenewOne}
                      >
                        Renovar créditos
                      </Button>
                    )}
                  </div>
                  {/* An expired membership has nothing left to cancel: bookings and credits were already released. */}
                  {editableMembership && !isExpired && (
                    <button type="button" onClick={handleCancelMembership} className="text-xs text-coral hover:underline">
                      Cancelar membresía
                    </button>
                  )}
                </div>
              </form>

              <form onSubmit={handleAdjustCredits} className="space-y-3 border-t border-line pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Ajustar créditos (saldo actual: {selected?.creditsBalance})
                </p>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="+5 / -2"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    className="w-24"
                  />
                  <Input
                    placeholder="Nota (opcional)"
                    value={creditNote}
                    onChange={(e) => setCreditNote(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" size="sm" disabled={adjustingCredits || !creditAmount}>
                    Aplicar
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </dialog>

      {confirmDialog}
    </div>
  );
}
