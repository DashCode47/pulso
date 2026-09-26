'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/logo';
import { BellIcon, CalendarIcon, ImageIcon, LogoutIcon, RepeatIcon, SettingsIcon, UsersIcon } from '@/components/icons';

const navItems = [
  { href: '/admin/classes', label: 'Clases', icon: CalendarIcon },
  { href: '/admin/schedule', label: 'Horario recurrente', icon: RepeatIcon },
  { href: '/admin/members', label: 'Miembros', icon: UsersIcon },
  { href: '/admin/news', label: 'Noticias', icon: ImageIcon },
  { href: '/admin/notifications', label: 'Notificaciones', icon: BellIcon },
];

const settingsItem = { href: '/admin/settings', label: 'Configuración', icon: SettingsIcon };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line px-4 py-6">
        <div className="px-2">
          <Logo />
          <p className="mt-1 pl-0.5 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">Admin</p>
        </div>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
          ))}
        </nav>

        <div className="flex flex-col gap-1 border-t border-line pt-3">
          <NavLink item={settingsItem} active={pathname.startsWith(settingsItem.href)} />
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-coral"
        >
          <LogoutIcon className="h-4 w-4" />
          Cerrar sesión
        </button>
      </aside>

      <main className="flex-1 px-10 py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

function NavLink({
  item,
  active,
}: {
  item: { href: string; label: string; icon: (props: { className?: string }) => React.ReactElement };
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2.5 rounded-lg border-l-2 px-2.5 py-2 text-sm font-medium transition-colors ${
        active ? 'border-mint bg-surface text-ink' : 'border-transparent text-ink-soft hover:border-line hover:text-ink'
      }`}
    >
      <item.icon className={`h-4 w-4 ${active ? 'text-mint' : ''}`} />
      {item.label}
    </Link>
  );
}
