import { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMyProgress, weeklyGoalHint, XP_PER_LEVEL } from '../../features/progress/useMyProgress';
import { ProgressBar } from '../../components/ProgressBar';
import { FadeIn } from '../../components/FadeIn';
import { Screen } from '../../components/Screen';
import { PulseLine } from '../../components/PulseLine';
import { colors, radius, spacing, type } from '../../theme';

const statIcons = {
  streak: 'flame' as const,
  maxStreak: 'trophy' as const,
  classes: 'bicycle' as const,
  rank: 'podium' as const,
};

export default function Progress() {
  const { data: p, isLoading, isError, refetch } = useMyProgress();
  // Cada vez que la pestaña recibe foco: datos frescos y se remonta el contenido para repetir las animaciones.
  const [visits, setVisits] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setVisits((v) => v + 1);
      refetch();
    }, [refetch]),
  );

  if (isLoading || isError || !p) {
    return (
      <Screen style={styles.center}>
        {isError ? (
          <>
            <Text style={styles.errorText}>No se pudo cargar tu progreso.</Text>
            <Pressable onPress={() => refetch()}>
              <Text style={styles.retryText}>Reintentar</Text>
            </Pressable>
          </>
        ) : (
          <PulseLine />
        )}
      </Screen>
    );
  }

  const xpIntoLevel = p.totalXp % XP_PER_LEVEL;
  const xpToNextLevel = XP_PER_LEVEL - xpIntoLevel;

  return (
    <Screen>
      <ScrollView key={visits} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Progreso</Text>

        <FadeIn style={styles.levelCard}>
          <View style={styles.levelHeader}>
            <View>
              <Text style={styles.level}>Nivel {p.level}</Text>
              <Text style={styles.xpTotal}>{p.totalXp} XP total</Text>
            </View>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>{p.level}</Text>
            </View>
          </View>
          <ProgressBar progress={xpIntoLevel / XP_PER_LEVEL} delay={250} />
          <Text style={styles.xpToNext}>{xpToNextLevel} XP para el siguiente nivel</Text>
        </FadeIn>

        <View style={styles.statsGrid}>
          <Stat delay={120} icon={statIcons.streak} label="Racha actual" value={`${p.currentStreakWeeks} semanas`} />
          <Stat delay={180} icon={statIcons.maxStreak} label="Racha máxima" value={`${p.maxStreakWeeks} semanas`} />
          <Stat delay={240} icon={statIcons.classes} label="Clases completadas" value={`${p.classesCompleted}`} />
          <Stat delay={300} icon={statIcons.rank} label="Posición en ranking" value={p.rank ? `#${p.rank}` : '–'} />
        </View>

        <FadeIn delay={360} style={styles.weeklyCard}>
          <View style={styles.weeklyHeader}>
            <Text style={styles.weeklyTitle}>Objetivo semanal</Text>
            <Text style={styles.weeklyCount}>
              {p.weeklyCompleted}/{p.weeklyGoal}
            </Text>
          </View>
          <ProgressBar progress={p.weeklyCompleted / p.weeklyGoal} delay={600} />
          <Text style={styles.weeklyHint}>{weeklyGoalHint(p.weeklyCompleted, p.weeklyGoal)}</Text>
        </FadeIn>

        <FadeIn delay={420}>
          <Text style={styles.sectionTitle}>Achievements</Text>
        </FadeIn>
        <View style={styles.achievementsGrid}>
          {p.achievements.map((a, i) => (
            <FadeIn
              key={a.code}
              delay={480 + Math.min(i, 8) * 50}
              style={[styles.achievement, !a.unlocked && styles.achievementLocked]}
            >
              <View style={styles.achievementTop}>
                <View style={[styles.achievementIconWrap, a.unlocked && styles.achievementIconWrapUnlocked]}>
                  <Ionicons
                    name={a.unlocked ? 'trophy' : 'lock-closed'}
                    size={18}
                    color={a.unlocked ? colors.accent : colors.locked}
                  />
                </View>
                <View style={[styles.xpPill, a.unlocked && styles.xpPillUnlocked]}>
                  {a.unlocked && <Ionicons name="checkmark" size={12} color={colors.success} />}
                  <Text style={[styles.xpPillText, a.unlocked && styles.xpPillTextUnlocked]}>+{a.xpReward} XP</Text>
                </View>
              </View>
              <Text style={[styles.achievementName, !a.unlocked && styles.achievementNameLocked]}>{a.name}</Text>
              <Text style={styles.achievementDescription}>{a.description}</Text>
            </FadeIn>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Stat({
  icon,
  label,
  value,
  delay,
}: {
  icon: (typeof statIcons)[keyof typeof statIcons];
  label: string;
  value: string;
  delay: number;
}) {
  return (
    <FadeIn delay={delay} style={styles.stat}>
      <Ionicons name={icon} size={18} color={colors.accent} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xxl, gap: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  errorText: { color: colors.inkSoft, fontSize: 14 },
  retryText: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  title: { ...type.title, color: colors.ink },

  levelCard: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    gap: spacing.md,
  },
  levelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  level: { ...type.title, color: colors.ink },
  xpTotal: { ...type.eyebrow, color: colors.inkMuted, marginTop: spacing.xs },
  levelBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadgeText: { color: colors.onAccent, fontWeight: '800', fontSize: 16 },
  xpToNext: { color: colors.inkSoft, fontSize: 13 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: {
    flexBasis: '47%',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.ink },
  statLabel: { ...type.caption, color: colors.inkSoft },

  weeklyCard: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  weeklyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weeklyHint: { ...type.caption, color: colors.inkSoft },
  weeklyTitle: { ...type.h2, color: colors.ink },
  weeklyCount: { ...type.h2, color: colors.accent },

  sectionTitle: { ...type.h2, color: colors.ink },
  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  achievement: {
    flexBasis: '47%',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  achievementLocked: { opacity: 0.45 },
  achievementIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  achievementIconWrapUnlocked: { backgroundColor: colors.accentSoft },
  achievementTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  xpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  xpPillUnlocked: { backgroundColor: colors.successSoft },
  xpPillText: { ...type.caption, fontWeight: '700', color: colors.inkSoft },
  xpPillTextUnlocked: { color: colors.success },
  achievementName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  achievementNameLocked: { color: colors.inkMuted },
  achievementDescription: { ...type.caption, color: colors.inkSoft },
});
