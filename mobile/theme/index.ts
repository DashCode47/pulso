// Design tokens compartidos por toda la app. Cambiar un valor aquí lo cambia
// en todas las pantallas que lo usan — evita hex sueltos en los componentes.
// Paleta monocromática sacada del logo: negro puro + blanco marfil. El acento
// ES el marfil (CTA claro sobre negro); el color solo aparece en estados.
export const colors = {
  bg: '#000000', // mismo negro del fondo del logo, así el logo no "flota" en una caja
  surface: '#111111',
  surfaceAlt: '#1A1A1A',
  border: '#262626',
  ink: '#F5F3EE',
  inkSoft: '#A1A09C',
  inkMuted: '#6B6A67',

  accent: '#F5F3EE',
  accentSoft: 'rgba(245,243,238,0.08)',
  onAccent: '#000000',

  success: '#7FD1A0',
  successSoft: 'rgba(127,209,160,0.12)',
  danger: '#FF7A70',
  dangerSoft: 'rgba(255,122,112,0.12)',
  locked: '#4A4A48',
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
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const type = {
  display: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -1 },
  title: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.6 },
  h2: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '500' as const, lineHeight: 22 },
  label: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
  eyebrow: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.6, textTransform: 'uppercase' as const },
};
