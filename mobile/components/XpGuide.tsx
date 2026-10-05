import { useState } from 'react';
import { View, Text, Pressable, LayoutAnimation, StyleSheet } from 'react-native';
import {
  BicycleIcon,
  CaretDownIcon,
  CaretUpIcon,
  FireIcon,
  FlagIcon,
  LightningIcon,
  TrophyIcon,
  XCircleIcon,
} from './icons';
import { XP_PER_LEVEL } from '../features/progress/useMyProgress';
import { colors, radius, spacing, type, themed } from '../theme';

// ponytail: amounts mirror the SQL (complete_class, update_weekly_streaks,
// achievements.xp_reward, mark_no_show); move to a view if they start changing.
const RULES = [
  { icon: BicycleIcon, title: 'Asiste a una clase', hint: 'Se suma al terminar la clase', xp: 100 },
  { icon: FlagIcon, title: 'Cumple tu objetivo semanal', hint: 'Se paga el lunes', xp: 100 },
  { icon: FireIcon, title: 'Mantén tu racha', hint: 'Desde la 2ª semana seguida', xp: 50 },
  { icon: TrophyIcon, title: 'Desbloquea un logro', hint: 'Cada logro, una vez', xp: 100 },
  { icon: XCircleIcon, title: 'Faltar a una reserva', hint: 'Se descuenta la clase', xp: -100 },
] as const;

export function XpGuide({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.header}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen((o) => !o);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View style={styles.headerIcon}>
          <LightningIcon size={14} color={colors.onAccent} weight="fill" />
        </View>
        <Text style={styles.headerTitle}>¿Cómo sumo XP?</Text>
        {open ? <CaretUpIcon size={16} color={colors.inkMuted} weight="bold" /> : <CaretDownIcon size={16} color={colors.inkMuted} weight="bold" />}
      </Pressable>

      {open && (
        <View style={styles.body}>
          {RULES.map((r) => (
            <View key={r.title} style={styles.rule}>
              <r.icon size={16} color={r.xp < 0 ? colors.danger : colors.inkSoft} weight="fill" />
              <View style={{ flex: 1 }}>
                <Text style={styles.ruleTitle}>{r.title}</Text>
                <Text style={styles.ruleHint}>{r.hint}</Text>
              </View>
              <Text style={[styles.ruleXp, r.xp < 0 && { color: colors.danger }]}>
                {r.xp > 0 ? '+' : '−'}
                {Math.abs(r.xp)} XP
              </Text>
            </View>
          ))}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Cada <Text style={styles.footerStrong}>{XP_PER_LEVEL} XP</Text> subes de nivel. El ranking ordena a todos los
              miembros por su XP total.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  headerIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...type.label, fontSize: 15, color: colors.ink, flex: 1 },
  body: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rule: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  ruleTitle: { ...type.label, color: colors.ink },
  ruleHint: { ...type.caption, color: colors.inkMuted, marginTop: 1 },
  ruleXp: { ...type.label, color: colors.success, fontVariant: ['tabular-nums'] },
  footer: { padding: spacing.lg, backgroundColor: colors.surfaceAlt },
  footerText: { ...type.caption, lineHeight: 18, color: colors.inkSoft },
  footerStrong: { color: colors.ink, fontWeight: '700' },
}));
