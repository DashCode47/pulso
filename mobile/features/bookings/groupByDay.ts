export type DayGroup<T extends { startsAt: string }> = { key: string; label: string; classes: T[] };

// Groups the flat class list into day pills, labeling only today/tomorrow
// and falling back to a short date for anything further out.
export function groupClassesByDay<T extends { startsAt: string }>(classes: T[], now = new Date()): DayGroup<T>[] {
  const days = new Map<string, DayGroup<T>>();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  for (const classInfo of classes) {
    const startsAt = new Date(classInfo.startsAt);
    const dayStart = new Date(startsAt);
    dayStart.setHours(0, 0, 0, 0);
    const key = dayStart.toISOString().slice(0, 10);

    if (!days.has(key)) {
      const label =
        dayStart.getTime() === today.getTime()
          ? 'Hoy'
          : dayStart.getTime() === tomorrow.getTime()
            ? 'Mañana'
            : dayStart.toLocaleDateString('es', { weekday: 'short', day: 'numeric' });
      days.set(key, { key, label, classes: [] });
    }
    days.get(key)!.classes.push(classInfo);
  }

  return [...days.values()];
}

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// Schedules are published on Sundays for Monday–Saturday, so the screen always
// shows exactly one week: the current one Monday–Saturday, the next one on
// Sunday. Classes outside those six days are dropped.
export function groupClassesByWeekday<T extends { startsAt: string }>(classes: T[], now = new Date()): DayGroup<T>[] {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  const dow = monday.getDay(); // 0 = Sunday
  monday.setDate(monday.getDate() + (dow === 0 ? 1 : 1 - dow));

  const days = WEEKDAY_LABELS.map((label, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return { key: localKey(d), label, classes: [] as T[] };
  });
  for (const classInfo of classes) {
    days.find((d) => d.key === localKey(new Date(classInfo.startsAt)))?.classes.push(classInfo);
  }
  return days;
}

function localKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
