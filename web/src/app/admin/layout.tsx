'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/logo';
import { Toaster } from '@/components/toast';
import {
  BellIcon,
  CalendarIcon,
  HomeIcon,
  ImageIcon,
  LogoutIcon,
  RepeatIcon,
  SettingsIcon,
  TrophyIcon,
  UserIcon,
  UsersIcon,
} from '@/components/icons';

const navItems = [
  { href: '/admin', label: 'Inicio', icon: HomeIcon, exact: true },
  { href: '/admin/classes', label: 'Clases', icon: CalendarIcon },
  { href: '/admin/schedule', label: 'Horario semanal', icon: RepeatIcon },
  { href: '/admin/instructors', label: 'Instructores', icon: UserIcon },
  { href: '/admin/members', label: 'Miembros', icon: UsersIcon },
  { href: '/admin/achievements', label: 'Logros', icon: TrophyIcon },
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

  const isActive = (item: { href: string; exact?: boolean }) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <div className="flex min-h-screen flex-col bg-canvas md:flex-row">
      {/* Phones/tablets: compact top bar with a horizontally scrolling nav. Desktop: sidebar. */}
      <aside className="sticky top-0 z-10 flex shrink-0 flex-col border-b border-line bg-canvas px-3 py-3 md:h-screen md:w-60 md:border-r md:border-b-0 md:px-4 md:py-6">
        <div className="flex items-center justify-between px-2">
          <div>
            <Logo />
            <p className="mt-1 hidden pl-0.5 text-[11px] font-semibold uppercase tracking-widest text-ink-muted md:block">Admin</p>
          </div>
          <button onClick={handleLogout} aria-label="Cerrar sesión" className="p-2 text-ink-soft hover:text-coral md:hidden">
            <LogoutIcon className="h-4 w-4" />
          </button>
        </div>

        <nav className="mt-3 flex gap-1 overflow-x-auto md:mt-8 md:flex-1 md:flex-col md:overflow-visible">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item)} />
          ))}
          <div className="md:hidden">
            <NavLink item={settingsItem} active={isActive(settingsItem)} />
          </div>
        </nav>

        <div className="hidden flex-col gap-1 border-t border-line pt-3 md:flex">
          <NavLink item={settingsItem} active={isActive(settingsItem)} />
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-coral"
          >
            <LogoutIcon className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      <Toaster />
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
      aria-current={active ? 'page' : undefined}
      className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium transition-colors md:border-l-2 ${
        active ? 'bg-surface text-ink md:border-mint' : 'text-ink-soft hover:text-ink md:border-transparent md:hover:border-line'
      }`}
    >
      <item.icon className={`h-4 w-4 ${active ? 'text-mint' : ''}`} />
      {item.label}
    </Link>
  );
}
