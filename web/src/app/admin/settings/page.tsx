'use client';

import { useEffect, useState } from 'react';
import { getStudioSettings, updateStudioSettings } from '@/lib/settings';
import { describeError } from '@/lib/errors';
import { Button, Card, ErrorBanner, Input, Label, PageHeader } from '@/components/ui';
import { toast, toastError } from '@/components/toast';

export default function SettingsPage() {
  const [cutoffHours, setCutoffHours] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    getStudioSettings()
      .then((s) => {
        setCutoffHours(String(s.cancellationCutoffHours));
        setWhatsapp(s.supportWhatsapp ?? '');
      })
      .catch((e) => setError(describeError(e, 'No se pudo cargar la configuración.')))
      .finally(() => setLoading(false));
  }, []);

  function edit(set: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      set(e.target.value);
      setDirty(true);
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    // Accept "+57 300 123 4567"; the DB stores digits only.
    const digits = whatsapp.replace(/\D/g, '');
    const { error } = await updateStudioSettings({
      cancellationCutoffHours: Number(cutoffHours),
      supportWhatsapp: digits || null,
    });
    setSaving(false);
    if (error) {
      if (error.code === '23514') toast('Número de WhatsApp inválido: usa el código de país y entre 8 y 15 dígitos.', 'error');
      else toastError(error, 'No se pudo guardar la configuración.');
      return;
    }
    setWhatsapp(digits);
    setDirty(false);
    toast('Configuración guardada.');
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Configuración" description="Ajustes generales del estudio." />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Card className="max-w-md p-5">
        {loading ? (
          <p className="text-sm text-ink-soft">Cargando...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <p className="mb-1 text-sm font-semibold text-ink">Ventana de cancelación</p>
              <p className="mb-4 text-xs text-ink-soft">
                Horas antes del inicio de una clase hasta las que un miembro puede cancelar su reserva sin perder el crédito.
              </p>
              <Label htmlFor="cutoff">Horas de anticipación</Label>
              <Input id="cutoff" type="number" required min={0} max={168} value={cutoffHours} onChange={edit(setCutoffHours)} />
            </div>

            <div>
              <p className="mb-1 text-sm font-semibold text-ink">WhatsApp de soporte</p>
              <p className="mb-4 text-xs text-ink-soft">
                El botón &quot;Soporte&quot; de la app abre un chat con este número. Déjalo vacío para usar la página web de soporte.
              </p>
              <Label htmlFor="whatsapp">Número con código de país</Label>
              <Input
                id="whatsapp"
                type="tel"
                inputMode="tel"
                placeholder="+57 300 123 4567"
                value={whatsapp}
                onChange={edit(setWhatsapp)}
              />
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving || !dirty}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
              {dirty && <p className="text-xs text-ink-muted">Cambios sin guardar</p>}
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
