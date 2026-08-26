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
