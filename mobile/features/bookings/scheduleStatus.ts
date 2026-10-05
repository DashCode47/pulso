// Members book one Mon–Sat week at a time and the studio publishes the next
// one on Sunday (docs/clases.md), so there are stretches with nothing to book:
// after the last class of the week, and on Sunday until the admin publishes.
// This says which stretch we're in so the UI can explain it.
export type ScheduleStatus =
  | 'open' // the current week still has classes to book
  | 'thisWeekPending' // the current week hasn't been published yet (late upload)
  | 'nextWeekOpen' // the current week is over and the next one is bookable
  | 'nextWeekPending'; // the current week is over and the next one isn't up yet

// Start of the Sunday that closes the current Mon–Sat week (today on Sundays).
export function upcomingSunday(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return d;
}

// publishedUntil: studio_settings.schedule_published_until ('YYYY-MM-DD', a Sunday).
export function scheduleStatus(
  classes: { startsAt: string; started: boolean }[],
  publishedUntil: string | undefined,
  now = new Date(),
): ScheduleStatus {
  if (!publishedUntil) return 'open';
  const sunday = upcomingSunday(now);
  const sundayKey = localKey(sunday);
  const nextWeek = publishedUntil > sundayKey ? 'nextWeekOpen' : 'nextWeekPending';
  if (now.getDay() === 0) return nextWeek;
  if (publishedUntil < sundayKey) return 'thisWeekPending';
  const bookableLeft = classes.some((c) => !c.started && new Date(c.startsAt) < sunday);
  return bookableLeft ? 'open' : nextWeek;
}

export function showsNextWeek(status: ScheduleStatus) {
  return status === 'nextWeekOpen' || status === 'nextWeekPending';
}

export function isSchedulePending(status: ScheduleStatus) {
  return status === 'thisWeekPending' || status === 'nextWeekPending';
}

export function scheduleStatusMessage(status: ScheduleStatus, now = new Date()): string | null {
  const sunday = now.getDay() === 0;
  switch (status) {
    case 'nextWeekOpen':
      return sunday
        ? 'Ya puedes reservar las clases de la próxima semana.'
        : 'Las clases de esta semana terminaron. Ya puedes reservar las de la próxima.';
    case 'nextWeekPending':
      return sunday
        ? 'El horario de la próxima semana se publica hoy. Vuelve más tarde para reservar.'
        : 'Las clases de esta semana terminaron. El horario de la próxima se publica el domingo y desde ese día puedes reservar.';
    case 'thisWeekPending':
      return 'El horario de esta semana aún no se publica. Vuelve más tarde para reservar.';
    case 'open':
      return null;
  }
}

function localKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
