import { StyleSheet } from 'react-native';
import { colors, radius, spacing, type, themed } from '../../theme';

// Compartido por sign-in y sign-up (fuera de app/ para que expo-router no lo
// tome como ruta).
export const authStyles = themed(() => StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.xxl, gap: spacing.md, backgroundColor: colors.bg },
  title: { ...type.title, color: colors.ink, textAlign: 'center' },
  subtitle: { ...type.eyebrow, color: colors.inkMuted, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.xxl },
  body: { ...type.body, color: colors.inkSoft, textAlign: 'center' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    color: colors.ink,
  },
  inputWithIcon: { paddingRight: spacing.lg + 32 },
  eye: { position: 'absolute', right: spacing.lg, top: 0, bottom: 0, justifyContent: 'center' },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  buttonText: { color: colors.onAccent, fontSize: 16, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  link: { marginTop: spacing.lg, alignSelf: 'center' },
  linkText: { color: colors.inkSoft, fontSize: 14 },
  linkStrong: { color: colors.ink, fontWeight: '700' },
}));
