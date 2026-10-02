// Studio dates are Bogota dates ('YYYY-MM-DD'). Bogota is a fixed UTC-5 with
// no DST, so plain offset math is exact and avoids relying on Hermes' Intl
// time zone support.
const OFFSET_MS = 5 * 60 * 60 * 1000;

export function bogotaInstant(date: string, time = '00:00') {
  return new Date(`${date}T${time}:00-05:00`);
}

export function bogotaDate(d: Date | string) {
  return new Date(new Date(d).getTime() - OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function mondayOf(date: string) {
  return addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));
}

// 'lun 5', 'dom 11' -- noon UTC keeps the date stable in any device timezone.
export function formatDay(date: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric' }) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('es', opts);
}
