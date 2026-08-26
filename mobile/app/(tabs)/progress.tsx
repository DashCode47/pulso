import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mockProgress, mockAchievements, XP_PER_LEVEL } from '../../features/progress/mockData';
import { ProgressBar } from '../../components/ProgressBar';
import { Screen } from '../../components/Screen';
import { colors, radius, spacing, type } from '../../theme';

const statIcons = {
  streak: 'flame' as const,
  maxStreak: 'trophy' as const,
  classes: 'bicycle' as const,
  rank: 'podium' as const,
};

export default function Progress() {
  const xpIntoLevel = mockProgress.totalXp % XP_PER_LEVEL;
  const xpToNextLevel = XP_PER_LEVEL - xpIntoLevel;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Progreso</Text>

        <View style={styles.levelCard}>
          <View style={styles.levelHeader}>
            <View>
              <Text style={styles.level}>Nivel {mockProgress.level}</Text>
              <Text style={styles.xpTotal}>{mockProgress.totalXp} XP total</Text>
            </View>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>{mockProgress.level}</Text>
            </View>
          </View>
          <ProgressBar progress={xpIntoLevel / XP_PER_LEVEL} />
          <Text style={styles.xpToNext}>{xpToNextLevel} XP para el siguiente nivel</Text>
        </View>

        <View style={styles.statsGrid}>
          <Stat icon={statIcons.streak} label="Racha actual" value={`${mockProgress.currentStreakWeeks} semanas`} />
          <Stat icon={statIcons.maxStreak} label="Racha máxima" value={`${mockProgress.maxStreakWeeks} semanas`} />
          <Stat icon={statIcons.classes} label="Clases completadas" value={`${mockProgress.classesCompleted}`} />
          <Stat icon={statIcons.rank} label="Posición en ranking" value={`#${mockProgress.leaderboardPosition}`} />
        </View>

        <View style={styles.weeklyCard}>
          <View style={styles.weeklyHeader}>
            <Text style={styles.weeklyTitle}>Objetivo semanal</Text>
            <Text style={styles.weeklyCount}>
              {mockProgress.weeklyCompleted}/{mockProgress.weeklyGoal}
            </Text>
          </View>
          <ProgressBar progress={mockProgress.weeklyCompleted / mockProgress.weeklyGoal} />
        </View>

        <Text style={styles.sectionTitle}>Achievements</Text>
        <View style={styles.achievementsGrid}>
          {mockAchievements.map((a) => (
            <View key={a.code} style={[styles.achievement, !a.unlocked && styles.achievementLocked]}>
              <View style={[styles.achievementIconWrap, a.unlocked && styles.achievementIconWrapUnlocked]}>
                <Ionicons
                  name={a.unlocked ? 'trophy' : 'lock-closed'}
                  size={18}
                  color={a.unlocked ? colors.accent : colors.locked}
                />
              </View>
              <Text style={[styles.achievementName, !a.unlocked && styles.achievementNameLocked]}>{a.name}</Text>
              <Text style={styles.achievementDescription}>{a.description}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Stat({ icon, label, value }: { icon: (typeof statIcons)[keyof typeof statIcons]; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={colors.accent} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xxl, gap: spacing.xl },
  title: { ...type.title, color: colors.ink },

  levelCard: { backgroundColor: colors.ink, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm },
  levelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  level: { color: colors.onDark, fontSize: 22, fontWeight: '800' },
  xpTotal: { color: colors.onDarkSoft, fontSize: 14, marginTop: 2 },
  levelBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadgeText: { color: colors.onAccent, fontWeight: '800', fontSize: 16 },
  xpToNext: { color: colors.onDarkSoft, fontSize: 13, marginTop: 4 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: { flexBasis: '47%', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.xs },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.ink },
  statLabel: { ...type.caption, color: colors.inkSoft },

  weeklyCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  weeklyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weeklyTitle: { ...type.h2, color: colors.ink },
  weeklyCount: { ...type.h2, color: colors.accent },

  sectionTitle: { ...type.h2, color: colors.ink },
  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  achievement: { flexBasis: '47%', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.xs },
  achievementLocked: { opacity: 0.6 },
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
  achievementName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  achievementNameLocked: { color: colors.inkMuted },
  achievementDescription: { ...type.caption, color: colors.inkSoft },
});
