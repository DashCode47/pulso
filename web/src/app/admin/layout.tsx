'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-semibold text-gray-900">Pulso Admin</h1>
          <nav className="flex gap-4 text-sm text-gray-500">
            <Link href="/admin/classes" className="hover:text-gray-900">
              Clases
            </Link>
            <Link href="/admin/schedule" className="hover:text-gray-900">
              Horario recurrente
            </Link>
            <Link href="/admin/members" className="hover:text-gray-900">
              Miembros
            </Link>
          </nav>
        </div>
        <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-900">
          Cerrar sesión
        </button>
      </header>
      <main className="mx-auto max-w-4xl p-6">{children}</main>
    </div>
  );
}
