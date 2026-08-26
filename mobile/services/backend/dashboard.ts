import { backend } from './client';

export type TodayClass = {
  id: string;
  title: string;
  startsAt: string;
  bookedCount: number;
  capacity: number;
};

export type AdminDashboard = {
  activeMembers: number;
  classesThisWeek: number;
  creditsGrantedThisMonth: number;
  todayClasses: TodayClass[];
};

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const startOfWeek = new Date(startOfToday.getTime() - startOfToday.getDay() * 24 * 60 * 60 * 1000);
  const startOfNextWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [{ count: activeMembers }, { count: classesThisWeek }, { data: grants }, { data: todayClassesRaw }] = await Promise.all([
    backend.from('memberships').select('user_id', { count: 'exact', head: true }).eq('status', 'active'),
    backend
      .from('classes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'scheduled')
      .gte('starts_at', startOfWeek.toISOString())
      .lt('starts_at', startOfNextWeek.toISOString()),
    backend
      .from('credit_transactions')
      .select('amount')
      .eq('type', 'grant')
      .gte('created_at', startOfMonth.toISOString()),
    backend
      .from('classes')
      .select('id, title, starts_at, capacity')
      .neq('status', 'cancelled')
      .gte('starts_at', startOfToday.toISOString())
      .lt('starts_at', startOfTomorrow.toISOString())
      .order('starts_at'),
  ]);

  const classIds = (todayClassesRaw ?? []).map((c) => c.id);
  const { data: reservations } = classIds.length
    ? await backend.from('reservations').select('class_id').in('class_id', classIds).eq('status', 'booked')
    : { data: [] as { class_id: string }[] };

  const bookedCountByClass = new Map<string, number>();
  for (const r of reservations ?? []) {
    bookedCountByClass.set(r.class_id, (bookedCountByClass.get(r.class_id) ?? 0) + 1);
  }

  return {
    activeMembers: activeMembers ?? 0,
    classesThisWeek: classesThisWeek ?? 0,
    creditsGrantedThisMonth: (grants ?? []).reduce((sum, g) => sum + g.amount, 0),
    todayClasses: (todayClassesRaw ?? []).map((c) => ({
      id: c.id,
      title: c.title,
      startsAt: c.starts_at,
      bookedCount: bookedCountByClass.get(c.id) ?? 0,
      capacity: c.capacity,
    })),
  };
}
