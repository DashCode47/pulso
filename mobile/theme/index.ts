// Design tokens compartidos por toda la app. Cambiar un valor aquí lo cambia
// en todas las pantallas que lo usan — evita hex sueltos en los componentes.
export const colors = {
  bg: '#fff',
  surface: '#f5f5f5',
  surfaceAlt: '#eee',
  ink: '#111',
  inkSoft: '#555',
  inkMuted: '#777',
  border: '#e5e5e5',
  onDark: '#fff',
  onDarkSoft: '#ccc',

  accent: '#FF5A1F',
  accentSoft: '#FFE7DB',
  onAccent: '#fff',

  success: '#0a7d32',
  danger: '#c00',
  locked: '#999',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const type = {
  title: { fontSize: 28, fontWeight: '800' as const },
  h2: { fontSize: 18, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '500' as const },
  label: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
};
