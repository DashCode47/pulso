'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminClass, addDays, bogotaDate, bogotaTime, listUpcomingClasses, mondayOf } from '@/lib/classes';
import { Member, searchMembers } from '@/lib/members';
import { getSchedulePublishedUntil } from '@/lib/settings';
import { describeError } from '@/lib/errors';
import { Badge, Card, ErrorBanner, Loading, PageHeader } from '@/components/ui';
import { OccupancyCard } from './occupancy';
import { ChevronRightIcon } from '@/components/icons';

function formatShort(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('es', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
}

export default function AdminHome() {
  const today = bogotaDate(new Date().toISOString());
  const [classes, setClasses] = useState<AdminClass[] | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [publishedUntil, setPublishedUntil] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listUpcomingClasses(), searchMembers(''), getSchedulePublishedUntil()])
      .then(([c, m, p]) => {
        setClasses(c);
        setMembers(m);
        setPublishedUntil(p);
      })
      .catch((e) => setError(describeError(e, 'No se pudo cargar el resumen.')));
  }, []);

  const todayClasses = (classes ?? []).filter((c) => c.status !== 'cancelled' && bogotaDate(c.startsAt) === today);
  const bookedToday = todayClasses.reduce((sum, c) => sum + c.bookedCount, 0);
  const expiring = (members ?? [])
    .filter((m) => m.membershipStatus === 'active' && m.cycleEnd && m.cycleEnd <= addDays(today, 7))
    .sort((a, b) => a.cycleEnd!.localeCompare(b.cycleEnd!));
  const expiredCount = (members ?? []).filter((m) => m.membershipStatus === 'expired').length;
  // Same week admin_publish_next_week() would publish.
  const publishStart = mondayOf(addDays(today, 4));
  const needsPublish = publishedUntil !== null && publishedUntil < addDays(publishStart, 6);
  const loading = !error && (classes === null || members === null);

  return (
    <div className="space-y-6">
      <PageHeader title="Inicio" description={`Resumen de hoy, ${formatShort(today)}.`} />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {needsPublish && (
        <Link
          href="/admin/schedule"
          className="flex items-center justify-between gap-3 rounded-2xl border border-coral/30 bg-coral-soft px-5 py-4 text-sm text-ink hover:border-coral/60"
        >
          <span>
            El horario de la semana del <strong>{formatShort(publishStart)}</strong> aún no está publicado: los miembros no pueden reservar.
          </span>
          <ChevronRightIcon className="h-4 w-4 shrink-0 text-coral" />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Clases hoy" value={loading ? '…' : todayClasses.length} href="/admin/classes" />
        <Stat label="Reservas hoy" value={loading ? '…' : bookedToday} href="/admin/classes" />
        <Stat label="Vencen en 7 días" value={loading ? '…' : expiring.length} href="/admin/members" warn={expiring.length > 0} />
        <Stat label="Membresías vencidas" value={loading ? '…' : expiredCount} href="/admin/members" warn={expiredCount > 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Clases de hoy" href="/admin/classes" />
          {loading ? (
            <Loading className="py-4" />
          ) : todayClasses.length === 0 ? (
            <p className="text-sm text-ink-muted">No quedan clases hoy.</p>
          ) : (
            <ul className="divide-y divide-line">
              {todayClasses.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="w-12 tabular-nums text-ink-soft">{bogotaTime(c.startsAt)}</span>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-ink">{c.title}</span>
                    <span className="text-ink-muted"> · {c.instructorName}</span>
                  </span>
                  <Badge tone={c.bookedCount >= c.capacity ? 'coral' : 'mint'}>
                    {c.bookedCount}/{c.capacity}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle title="Membresías por vencer" href="/admin/members" />
          {loading ? (
            <Loading className="py-4" />
          ) : expiring.length === 0 ? (
            <p className="text-sm text-ink-muted">Ninguna membresía vence esta semana.</p>
          ) : (
            <ul className="divide-y divide-line">
              {expiring.map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="truncate font-medium text-ink">{m.fullName}</span>
                  <span className="shrink-0 text-ink-soft">
                    {m.creditsBalance} créditos · vence {formatShort(m.cycleEnd!)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <OccupancyCard />
    </div>
  );
}

function Stat({ label, value, href, warn }: { label: string; value: number | string; href: string; warn?: boolean }) {
  return (
    <Link href={href} className="rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-ink-muted">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${warn ? 'text-coral' : 'text-ink'}`}>{value}</p>
    </Link>
  );
}

function SectionTitle({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</p>
      <Link href={href} className="text-xs text-ink-soft hover:text-ink">
        Ver todo
      </Link>
    </div>
  );
}
