import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

// Design tokens compartidos por toda la app. Cambiar un valor aquí lo cambia
// en todas las pantallas que lo usan — evita hex sueltos en los componentes.
// Paleta monocromática sacada del logo: negro puro + blanco marfil. El acento
// ES el marfil (CTA claro sobre negro); el color solo aparece en estados.
const dark = {
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
  // Tarjeta destacada (p. ej. "Tu posición"): en oscuro es el marfil invertido.
  featured: '#F5F3EE',
  onFeatured: '#000000',
  featuredSoft: 'rgba(0,0,0,0.07)',
  highlight: '#F5C451', // dorado (mismo oro del podio): detalles que deben resaltar

  success: '#7FD1A0',
  successSoft: 'rgba(127,209,160,0.12)',
  danger: '#FF7A70',
  dangerSoft: 'rgba(255,122,112,0.12)',
  locked: '#4A4A48',

  // Canales RGB de bg/ink para armar rgba() con alpha propio (scrims sobre fotos).
  bgRgb: '0,0,0',
  inkRgb: '245,243,238',
};

export type Palette = Record<keyof typeof dark, string>;

// Mismo esquema invertido: marfil de fondo, el acento pasa a ser el negro.
const light: Palette = {
  bg: '#F5F3EE',
  surface: '#FFFFFF',
  surfaceAlt: '#ECEAE4',
  border: '#E0DED8',
  ink: '#111111',
  inkSoft: '#5C5B58',
  inkMuted: '#8C8B87',

  accent: '#111111',
  accentSoft: 'rgba(17,17,17,0.06)',
  onAccent: '#F5F3EE',
  // En claro una tarjeta negra parece del tema oscuro: blanca con borde.
  featured: '#FFFFFF',
  onFeatured: '#111111',
  featuredSoft: 'rgba(17,17,17,0.06)',
  highlight: '#C4901A', // oro más oscuro: el #F5C451 no contrasta sobre marfil

  success: '#2E9D5B',
  successSoft: 'rgba(46,157,91,0.12)',
  danger: '#D93F33',
  dangerSoft: 'rgba(217,63,51,0.1)',
  locked: '#C4C3BF',

  bgRgb: '245,243,238',
  inkRgb: '17,17,17',
};

export type ThemeMode = 'dark' | 'light';
const palettes: Record<ThemeMode, Palette> = { dark, light };
const STORAGE_KEY = 'theme-mode';

// getItem síncrono: el tema correcto desde el primer frame, sin flash.
export const useThemeMode = create<{ mode: ThemeMode; setMode: (mode: ThemeMode) => void }>((set) => ({
  mode: SecureStore.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark',
  setMode: (mode) => {
    SecureStore.setItem(STORAGE_KEY, mode);
    set({ mode });
  },
}));

const currentMode = () => useThemeMode.getState().mode;

// ponytail: `colors.x` y `themed()` leen la paleta activa en cada acceso, así
// los componentes siguen usando `colors`/`styles` sin hooks. Para repintar,
// cada pantalla (y los layouts) se suscribe a useThemeMode, y <Screen> lleva
// key={mode} para remontar listas memoizadas. Pantalla nueva = suscribirla.
export const colors = new Proxy({} as Palette, {
  get: (_, key: keyof Palette) => palettes[currentMode()][key],
});

// Reemplazo de StyleSheet.create (que hoy es identidad) para objetos que
// dependen de `colors`: se evalúa una vez por tema y se cachea.
export function themed<T extends object>(build: () => T): T {
  const cache: Partial<Record<ThemeMode, T>> = {};
  return new Proxy({} as T, {
    get: (_, key) => {
      const mode = currentMode();
      return (cache[mode] ??= build())[key as keyof T];
    },
  });
}

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
