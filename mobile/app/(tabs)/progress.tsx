import { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ArrowCircleUpIcon,
  ArrowRightIcon,
  BicycleIcon,
  CheckIcon,
  FireIcon,
  LockIcon,
  RankingIcon,
  TrophyIcon,
  type Icon,
} from '../../components/icons';
import { useMyProgress, weeklyGoalHint, XP_PER_LEVEL } from '../../features/progress/useMyProgress';
import type { MyProgress } from '../../services/backend';
import { ProgressBar } from '../../components/ProgressBar';
import { FadeIn } from '../../components/FadeIn';
import { Screen } from '../../components/Screen';
import { PulseLine } from '../../components/PulseLine';
import { XpGuide } from '../../components/XpGuide';
import { colors, radius, spacing, type, themed, useThemeMode } from '../../theme';

const statIcons = {
  streak: FireIcon,
  maxStreak: TrophyIcon,
  classes: BicycleIcon,
  rank: RankingIcon,
};

// Targets mirror earned_achievements() in the backend. early_bird/night_rider
// need per-hour counts the app doesn't load, so they show no bar.
function achievementProgress(code: string, p: MyProgress): { current: number; target: number } | null {
  const targets: Record<string, [number, number]> = {
    first_ride: [p.classesCompleted, 1],
    ten_rides: [p.classesCompleted, 10],
    twenty_rides: [p.classesCompleted, 20],
    consistent: [p.currentStreakWeeks, 4],
    on_fire: [p.currentStreakWeeks, 7],
  };
  const t = targets[code];
  return t ? { current: Math.min(t[0], t[1]), target: t[1] } : null;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function Progress() {
  useThemeMode((s) => s.mode); // re-render al cambiar de tema
  const router = useRouter();
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
  const weeklyMet = p.weeklyCompleted >= p.weeklyGoal;
  const unlockedCount = p.achievements.filter((a) => a.unlocked).length;

  return (
    <Screen>
      <ScrollView key={visits} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.eyebrow}>Tu camino</Text>
          <Text style={styles.title}>Progreso</Text>
          <Text style={styles.subtitle}>Cada clase suma XP: sube de nivel, mantén tu racha y escala en el ranking.</Text>
        </View>

        <FadeIn style={styles.levelCard}>
          <View style={styles.levelHeader}>
            <View>
              <Text style={styles.levelEyebrow}>Nivel actual</Text>
              <Text style={styles.level}>Nivel {p.level}</Text>
            </View>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>{p.level}</Text>
            </View>
          </View>
          <View style={styles.levelBarRow}>
            <Text style={styles.levelXp}>
              {xpIntoLevel}
              <Text style={styles.levelXpOf}> / {XP_PER_LEVEL} XP</Text>
            </Text>
            <Text style={styles.levelXpOf}>{p.totalXp} XP total</Text>
          </View>
          <ProgressBar progress={xpIntoLevel / XP_PER_LEVEL} delay={250} />
          <View style={styles.nextLevel}>
            <ArrowCircleUpIcon size={16} color={colors.ink} weight="fill" />
            <Text style={styles.nextLevelText}>
              Te faltan <Text style={styles.strong}>{xpToNextLevel} XP</Text> para el nivel {p.level + 1}.
            </Text>
          </View>
        </FadeIn>

        <FadeIn delay={120} style={styles.weeklyCard}>
          <View style={styles.weeklyHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.weeklyTitle}>Objetivo semanal</Text>
              <Text style={styles.weeklySub}>
                {plural(p.weeklyGoal, 'clase', 'clases')} por semana mantienen tu racha
              </Text>
            </View>
            <View style={[styles.rewardPill, weeklyMet && styles.rewardPillMet]}>
              {weeklyMet && <CheckIcon size={12} color={colors.success} weight="bold" />}
              <Text style={[styles.rewardPillText, weeklyMet && { color: colors.success }]}>+100 XP</Text>
            </View>
          </View>
          <View style={styles.segments}>
            {Array.from({ length: p.weeklyGoal }, (_, i) => (
              <View key={i} style={[styles.segment, i < p.weeklyCompleted && styles.segmentDone]} />
            ))}
          </View>
          <View style={styles.weeklyFooter}>
            <Text style={styles.weeklyHint}>{weeklyGoalHint(p.weeklyCompleted, p.weeklyGoal)}</Text>
            <Text style={styles.weeklyCount}>
              {p.weeklyCompleted}/{p.weeklyGoal}
            </Text>
          </View>
          {!weeklyMet && (
            <Pressable
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
              onPress={() => router.push('/(tabs)/bookings')}
            >
              <Text style={styles.ctaText}>Reservar una clase</Text>
              <ArrowRightIcon size={16} color={colors.onAccent} weight="bold" />
            </Pressable>
          )}
        </FadeIn>

        <View style={styles.statsGrid}>
          <Stat delay={180} icon={statIcons.streak} label="Racha actual" value={plural(p.currentStreakWeeks, 'semana', 'semanas')} />
          <Stat delay={220} icon={statIcons.maxStreak} label="Racha máxima" value={plural(p.maxStreakWeeks, 'semana', 'semanas')} />
          <Stat delay={260} icon={statIcons.classes} label="Clases completadas" value={`${p.classesCompleted}`} />
          <Stat delay={300} icon={statIcons.rank} label="Posición en ranking" value={p.rank ? `#${p.rank}` : '–'} />
        </View>

        <FadeIn delay={340}>
          <XpGuide defaultOpen={p.totalXp === 0} />
        </FadeIn>

        <FadeIn delay={380} style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Logros</Text>
          <Text style={styles.sectionCount}>
            {unlockedCount} de {p.achievements.length}
          </Text>
        </FadeIn>
        <View style={styles.achievementsGrid}>
          {p.achievements.map((a, i) => {
            const prog = a.unlocked ? null : achievementProgress(a.code, p);
            return (
              <FadeIn
                key={a.code}
                delay={420 + Math.min(i, 8) * 50}
                style={[styles.achievement, a.unlocked && styles.achievementUnlocked]}
              >
                <View style={styles.achievementTop}>
                  <View style={[styles.achievementIconWrap, a.unlocked && styles.achievementIconWrapUnlocked]}>
                    {a.unlocked ? (
                      <TrophyIcon size={16} color={colors.onAccent} weight="fill" />
                    ) : (
                      <LockIcon size={16} color={colors.inkMuted} weight="fill" />
                    )}
                  </View>
                  <View style={[styles.xpPill, a.unlocked && styles.xpPillUnlocked]}>
                    {a.unlocked && <CheckIcon size={12} color={colors.success} weight="bold" />}
                    <Text style={[styles.xpPillText, a.unlocked && styles.xpPillTextUnlocked]}>+{a.xpReward} XP</Text>
                  </View>
                </View>
                <Text style={[styles.achievementName, !a.unlocked && styles.achievementNameLocked]}>{a.name}</Text>
                <Text style={styles.achievementDescription}>{a.description}</Text>
                {prog && (
                  <View style={styles.achievementProgress}>
                    <View style={styles.miniTrack}>
                      <View style={[styles.miniFill, { width: `${(prog.current / prog.target) * 100}%` }]} />
                    </View>
                    <Text style={styles.miniCount}>
                      {prog.current}/{prog.target}
                    </Text>
                  </View>
                )}
              </FadeIn>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Stat({
  icon: I,
  label,
  value,
  delay,
}: {
  icon: Icon;
  label: string;
  value: string;
  delay: number;
}) {
  return (
    <FadeIn delay={delay} style={styles.stat}>
      <I size={18} color={colors.accent} weight="fill" />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </FadeIn>
  );
}

const card = () => ({
  backgroundColor: colors.surface,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: colors.border,
}) as const;

const styles = themed(() => StyleSheet.create({
  content: { padding: spacing.xxl, paddingBottom: spacing.xxl * 2, gap: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  errorText: { color: colors.inkSoft, fontSize: 14 },
  retryText: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  strong: { color: colors.ink, fontWeight: '700' },

  eyebrow: { ...type.eyebrow, color: colors.inkMuted, marginBottom: spacing.xs },
  title: { ...type.title, color: colors.ink },
  subtitle: { ...type.caption, fontSize: 13, lineHeight: 19, color: colors.inkSoft, marginTop: spacing.xs },

  levelCard: { ...card(), borderRadius: radius.xl, padding: spacing.xxl, gap: spacing.md },
  levelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  levelEyebrow: { ...type.eyebrow, color: colors.inkMuted, marginBottom: 2 },
  level: { ...type.title, color: colors.ink },
  levelBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadgeText: { color: colors.onAccent, fontWeight: '800', fontSize: 18 },
  levelBarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing.xs },
  levelXp: { fontSize: 17, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  levelXpOf: { ...type.caption, color: colors.inkMuted, fontWeight: '600' },
  nextLevel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  nextLevelText: { ...type.caption, fontSize: 13, lineHeight: 18, color: colors.inkSoft, flex: 1 },

  weeklyCard: { ...card(), borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  weeklyHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  weeklyTitle: { ...type.h2, color: colors.ink },
  weeklySub: { ...type.caption, color: colors.inkMuted, marginTop: 2 },
  rewardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  rewardPillMet: { backgroundColor: colors.successSoft },
  rewardPillText: { ...type.caption, fontWeight: '700', color: colors.inkSoft },
  segments: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt },
  segmentDone: { backgroundColor: colors.accent },
  weeklyFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  weeklyHint: { ...type.caption, color: colors.inkSoft, flex: 1 },
  weeklyCount: { ...type.label, color: colors.ink, fontVariant: ['tabular-nums'] },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    minHeight: 44,
    marginTop: spacing.xs,
  },
  ctaText: { color: colors.onAccent, fontWeight: '700' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: { ...card(), flexBasis: '47%', borderRadius: radius.md, padding: spacing.lg, gap: spacing.xs },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.ink },
  statLabel: { ...type.caption, color: colors.inkSoft },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing.sm },
  sectionTitle: { ...type.h2, color: colors.ink },
  sectionCount: { ...type.caption, color: colors.inkMuted, fontWeight: '600' },
  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  achievement: { ...card(), flexBasis: '47%', borderRadius: radius.md, padding: spacing.lg, gap: spacing.xs },
  achievementUnlocked: { borderColor: colors.inkMuted },
  achievementIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  achievementIconWrapUnlocked: { backgroundColor: colors.accent },
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
  achievementNameLocked: { color: colors.inkSoft },
  achievementDescription: { ...type.caption, color: colors.inkMuted },
  achievementProgress: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  miniTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  miniFill: { height: '100%', backgroundColor: colors.inkSoft },
  miniCount: { ...type.caption, fontSize: 11, color: colors.inkMuted, fontVariant: ['tabular-nums'] },
}));
