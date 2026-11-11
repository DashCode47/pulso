'use client';

import { useEffect, useState } from 'react';
import { Bike, createBike, listBikes, updateBike } from '@/lib/bikes';
import { Button, Card, Input, Loading, Toggle } from '@/components/ui';
import { toast, toastError } from '@/components/toast';

// Studio bike inventory. An inactive bike (broken, in repair) can't be picked
// for new bookings; past reservations keep pointing at it, so bikes are never
// deleted.
export function BikesCard() {
  const [bikes, setBikes] = useState<Bike[] | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  function refresh() {
    return listBikes()
      .then(setBikes)
      .catch((e) => {
        setBikes([]);
        toastError(e, 'No se pudieron cargar las bicis.');
      });
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const label = newLabel.trim();
    if (!label || adding) return;
    setAdding(true);
    const { error } = await createBike(label);
    setAdding(false);
    if (error) {
      toastError(error, error.code === '23505' ? `Ya existe una bici "${label}".` : 'No se pudo agregar la bici.');
      return;
    }
    setNewLabel('');
    toast(`Bici ${label} agregada.`);
    refresh();
  }

  async function handleToggle(b: Bike) {
    setBikes((prev) => prev && prev.map((x) => (x.id === b.id ? { ...x, active: !b.active } : x)));
    const { error } = await updateBike(b.id, { active: !b.active });
    if (error) {
      setBikes((prev) => prev && prev.map((x) => (x.id === b.id ? { ...x, active: b.active } : x)));
      toastError(error, 'No se pudo cambiar el estado.');
      return;
    }
    toast(b.active ? `${b.label} fuera de servicio.` : `${b.label} disponible.`);
  }

  async function handleRename(b: Bike) {
    const label = editLabel.trim();
    setEditingId(null);
    if (!label || label === b.label) return;
    const { error } = await updateBike(b.id, { label });
    if (error) {
      toastError(error, error.code === '23505' ? `Ya existe una bici "${label}".` : 'No se pudo renombrar.');
      return;
    }
    toast('Bici renombrada.');
    refresh();
  }

  const activeCount = bikes?.filter((b) => b.active).length ?? 0;

  return (
    <Card className="max-w-md p-5">
      <p className="mb-1 text-sm font-semibold text-ink">Bicis</p>
      <p className="mb-4 text-xs text-ink-soft">
        Marca una bici fuera de servicio para que nadie pueda reservarla. Las reservas ya hechas en ella no cambian.
        {bikes && ` ${activeCount} de ${bikes.length} disponibles.`}
      </p>

      {bikes === null ? (
        <Loading className="py-4" />
      ) : (
        <ul className="mb-4 divide-y divide-line">
          {bikes.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 py-2">
              {editingId === b.id ? (
                <Input
                  autoFocus
                  aria-label="Nombre de la bici"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  onBlur={() => handleRename(b)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(b);
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setEditingId(null);
                    }
                  }}
                  className="max-w-40"
                />
              ) : (
                <button
                  type="button"
                  title="Renombrar"
                  onClick={() => {
                    setEditingId(b.id);
                    setEditLabel(b.label);
                  }}
                  className={`text-sm hover:underline ${b.active ? 'text-ink' : 'text-ink-muted line-through'}`}
                >
                  {b.label}
                </button>
              )}
              <Toggle checked={b.active} onChange={() => handleToggle(b)} label={b.active ? 'Disponible' : 'Fuera de servicio'} />
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex gap-2">
        <Input aria-label="Nueva bici" placeholder="Ej. Bici 13" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
        <Button type="submit" size="sm" disabled={!newLabel.trim() || adding}>
          Agregar
        </Button>
      </form>
    </Card>
  );
}
