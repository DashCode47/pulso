'use client';

import { useEffect, useState } from 'react';
import { getStudioSettings, updateCancellationCutoff } from '@/lib/settings';
import { Button, Card, ErrorBanner, Input, Label, PageHeader } from '@/components/ui';

export default function SettingsPage() {
  const [cutoffHours, setCutoffHours] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getStudioSettings()
      .then((s) => setCutoffHours(String(s.cancellationCutoffHours)))
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar configuración.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const { error } = await updateCancellationCutoff(Number(cutoffHours));
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Configuración" description="Ajustes generales del estudio." />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Card className="max-w-md p-5">
        <p className="mb-1 text-sm font-semibold text-ink">Ventana de cancelación</p>
        <p className="mb-4 text-xs text-ink-soft">
          Horas antes del inicio de una clase hasta las que un miembro puede cancelar su reserva sin perder el crédito.
        </p>

        {loading ? (
          <p className="text-sm text-ink-soft">Cargando...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label htmlFor="cutoff">Horas de anticipación</Label>
                <Input
                  id="cutoff"
                  type="number"
                  required
                  min={0}
                  max={168}
                  value={cutoffHours}
                  onChange={(e) => {
                    setCutoffHours(e.target.value);
                    setSaved(false);
                  }}
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
            {saved && <p className="text-xs font-medium text-mint">Guardado.</p>}
          </form>
        )}
      </Card>
    </div>
  );
}
