'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/logo';
import { Button, Card, ErrorBanner, Input, Label } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError('Email o contraseña incorrectos.');
      setLoading(false);
      return;
    }

    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (!isAdmin) {
      setError('Esta cuenta no tiene permisos de administrador.');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    router.replace('/admin');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo className="scale-125" />
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-ink">Panel administrativo</p>
              <p className="mt-0.5 text-xs text-ink-soft">Ingresa con tu cuenta de administrador.</p>
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div>
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <ErrorBanner>{error}</ErrorBanner>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
