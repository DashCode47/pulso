'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Member,
  Membership,
  MembershipInput,
  adjustCredits,
  createMembership,
  getLatestMembership,
  grantCreditsBulk,
  searchMembers,
  setMembershipStatus,
  updateMembership,
} from '@/lib/members';

const membershipStatusLabel: Record<NonNullable<Member['membershipStatus']>, string> = {
  active: 'Activa',
  paused: 'Pausada',
  cancelled: 'Cancelada',
  expired: 'Vencida',
};

function formatDate(isoDate: string) {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

const emptyForm: MembershipInput = { planName: 'Standard', creditsPerCycle: 10, weeklyGoal: 3 };

export default function MembersPage() {
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Member | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [form, setForm] = useState<MembershipInput>(emptyForm);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNote, setCreditNote] = useState('');
  const [adjustingCredits, setAdjustingCredits] = useState(false);
  const modalRef = useRef<HTMLDialogElement>(null);

  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [renewing, setRenewing] = useState(false);

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
      setForm(latest ? { planName: latest.planName, creditsPerCycle: latest.creditsPerCycle, weeklyGoal: latest.weeklyGoal } : emptyForm);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar membresía.');
    } finally {
      setDetailLoading(false);
    }
  }

  // A cancelled membership is historical -- assigning again starts a fresh
  // row (like a member re-enrolling) instead of un-cancelling the old one.
  const editableMembership = membership && membership.status !== 'cancelled' ? membership : null;

  async function handleSaveMembership(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError(null);

    const { error } = editableMembership
      ? await updateMembership(editableMembership.id, form)
      : await createMembership(selected.userId, form);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    modalRef.current?.close();
    refresh(query);
  }

  async function handleSetStatus(status: 'active' | 'paused' | 'cancelled') {
    if (!editableMembership) return;
    const { error } = await setMembershipStatus(editableMembership.id, status);
    if (error) {
      setError(error.message);
      return;
    }
    setMembership({ ...editableMembership, status });
    refresh(query);
  }

  async function handleAdjustCredits(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const amount = Number(creditAmount);
    if (!amount) return;
    setAdjustingCredits(true);
    const { error } = await adjustCredits(selected.userId, amount, creditNote.trim());
    setAdjustingCredits(false);
    if (error) {
      setError(error.message);
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
    if (!confirm(`¿Renovar créditos para ${checkedIds.size} miembro(s)?`)) return;
    setRenewing(true);
    const { error } = await grantCreditsBulk([...checkedIds]);
    setRenewing(false);
    if (error) {
      setError(error.message);
      return;
    }
    setCheckedIds(new Set());
    refresh(query);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Miembros</h2>
        <p className="mt-1 text-sm text-gray-500">Busca un miembro para asignar o editar su membresía y créditos.</p>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nombre..."
        className="w-full max-w-sm rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
      />

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {checkedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
          <span className="text-blue-900">{checkedIds.size} seleccionado(s)</span>
          <button
            onClick={handleRenewSelected}
            disabled={renewing}
            className="rounded bg-gray-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            {renewing ? 'Renovando...' : 'Renovar créditos'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-gray-400">Sin resultados.</p>
      ) : (
        <table className="w-full border-collapse overflow-hidden rounded-lg border bg-white text-sm text-gray-900">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-500">
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  checked={renewableMembers.length > 0 && checkedIds.size === renewableMembers.length}
                  onChange={toggleAllChecked}
                />
              </th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Créditos</th>
              <th className="px-3 py-2">Membresía</th>
              <th className="px-3 py-2">Desde</th>
              <th className="px-3 py-2">Vence</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.userId} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    disabled={m.membershipStatus !== 'active' && m.membershipStatus !== 'expired'}
                    checked={checkedIds.has(m.userId)}
                    onChange={() => toggleChecked(m.userId)}
                  />
                </td>
                <td className="px-3 py-2">{m.fullName}</td>
                <td className="px-3 py-2">{m.creditsBalance}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      m.membershipStatus === 'active'
                        ? 'text-green-700'
                        : m.membershipStatus === 'expired'
                          ? 'text-red-600'
                          : 'text-gray-400'
                    }
                  >
                    {m.membershipStatus ? membershipStatusLabel[m.membershipStatus] : 'Sin membresía'}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-500">{m.cycleStart ? formatDate(m.cycleStart) : '—'}</td>
                <td className="px-3 py-2 text-gray-500">{m.cycleEnd ? formatDate(m.cycleEnd) : '—'}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => openMember(m)} className="text-blue-600 hover:underline">
                    Gestionar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <dialog ref={modalRef} className="m-auto w-full max-w-md rounded-lg border p-0 backdrop:bg-black/40">
        <div className="space-y-5 p-4">
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-semibold text-gray-900">{selected?.fullName}</h3>
            <button onClick={() => modalRef.current?.close()} className="text-sm text-gray-400 hover:text-gray-700">
              Cerrar
            </button>
          </div>

          {detailLoading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : (
            <>
              <form onSubmit={handleSaveMembership} className="space-y-3">
                <p className="text-xs font-medium uppercase text-gray-400">
                  {editableMembership ? 'Editar membresía' : 'Asignar membresía'}
                </p>
                {membership && (
                  <p className="text-xs text-gray-400">
                    {membershipStatusLabel[membership.status]} · vence {formatDate(membership.cycleEnd)}
                  </p>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Plan</label>
                  <input
                    required
                    value={form.planName}
                    onChange={(e) => setForm({ ...form, planName: e.target.value })}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700">Créditos/ciclo</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={form.creditsPerCycle}
                      onChange={(e) => setForm({ ...form, creditsPerCycle: Number(e.target.value) })}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700">Meta semanal</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={form.weeklyGoal}
                      onChange={(e) => setForm({ ...form, weeklyGoal: Number(e.target.value) })}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {editableMembership ? 'Guardar cambios' : 'Asignar membresía'}
                    </button>
                    {(membership?.status === 'active' || membership?.status === 'expired') && (
                      <button
                        type="button"
                        disabled={renewing}
                        onClick={async () => {
                          setRenewing(true);
                          const { error } = await grantCreditsBulk([selected!.userId]);
                          setRenewing(false);
                          if (error) {
                            setError(error.message);
                            return;
                          }
                          setSelected({ ...selected!, creditsBalance: selected!.creditsBalance + form.creditsPerCycle });
                          refresh(query);
                        }}
                        className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 disabled:opacity-50"
                      >
                        Renovar créditos
                      </button>
                    )}
                  </div>
                  {editableMembership && (
                    <div className="flex gap-3 text-xs">
                      {editableMembership.status !== 'active' && (
                        <button type="button" onClick={() => handleSetStatus('active')} className="text-green-700 hover:underline">
                          Reactivar
                        </button>
                      )}
                      {editableMembership.status === 'active' && (
                        <button type="button" onClick={() => handleSetStatus('paused')} className="text-gray-500 hover:underline">
                          Pausar
                        </button>
                      )}
                      <button type="button" onClick={() => handleSetStatus('cancelled')} className="text-red-600 hover:underline">
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              </form>

              <form onSubmit={handleAdjustCredits} className="space-y-3 border-t pt-4">
                <p className="text-xs font-medium uppercase text-gray-400">
                  Ajustar créditos (saldo actual: {selected?.creditsBalance})
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="+5 / -2"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    className="w-24 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                  />
                  <input
                    placeholder="Nota (opcional)"
                    value={creditNote}
                    onChange={(e) => setCreditNote(e.target.value)}
                    className="flex-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                  />
                  <button
                    type="submit"
                    disabled={adjustingCredits || !creditAmount}
                    className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Aplicar
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
