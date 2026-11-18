// "72,5" from a Spanish keypad and "72.5" both parse. NaN-safe: null = invalid.
export function parseDecimal(text: string, min: number, max: number): number | null {
  const n = Number(text.trim().replace(',', '.'));
  if (!text.trim() || !Number.isFinite(n) || n < min || n > max) return null;
  return Math.round(n * 10) / 10;
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

// Values -> [x, y] in a width x height box, evenly spaced, y flipped (heavier =
// higher). A flat series sits in the middle instead of dividing by zero.
export function chartPoints(values: number[], width: number, height: number, pad = 8): [number, number][] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  return values.map((v, i) => [
    pad + i * step,
    max === min ? height / 2 : pad + ((max - v) / (max - min)) * (height - pad * 2),
  ]);
}

// Local calendar date, not UTC (toISOString would roll over at 7pm in Bogota).
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
