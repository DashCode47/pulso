import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { mockProgress, mockAchievements, XP_PER_LEVEL } from '../../features/progress/mockData';
import { ProgressBar } from '../../components/ProgressBar';
import { Screen } from '../../components/Screen';

export default function Progress() {
  const xpIntoLevel = mockProgress.totalXp % XP_PER_LEVEL;
  const xpToNextLevel = XP_PER_LEVEL - xpIntoLevel;

  return (
    <Screen>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Progreso</Text>

      <View style={styles.levelCard}>
        <Text style={styles.level}>Nivel {mockProgress.level}</Text>
        <Text style={styles.xpTotal}>{mockProgress.totalXp} XP</Text>
        <ProgressBar progress={xpIntoLevel / XP_PER_LEVEL} />
        <Text style={styles.xpToNext}>{xpToNextLevel} XP para el siguiente nivel</Text>
      </View>

      <View style={styles.statsGrid}>
        <Stat label="Racha actual" value={`🔥 ${mockProgress.currentStreakWeeks} semanas`} />
        <Stat label="Racha máxima" value={`${mockProgress.maxStreakWeeks} semanas`} />
        <Stat label="Clases completadas" value={`${mockProgress.classesCompleted}`} />
        <Stat label="Posición en ranking" value={`#${mockProgress.leaderboardPosition}`} />
      </View>

      <View style={styles.weeklyCard}>
        <Text style={styles.weeklyTitle}>Objetivo semanal</Text>
        <Text style={styles.weeklyCount}>
          {mockProgress.weeklyCompleted} / {mockProgress.weeklyGoal} clases
        </Text>
        <ProgressBar progress={mockProgress.weeklyCompleted / mockProgress.weeklyGoal} />
      </View>

      <Text style={styles.sectionTitle}>Achievements</Text>
      <View style={styles.achievementsGrid}>
        {mockAchievements.map((a) => (
          <View key={a.code} style={[styles.achievement, !a.unlocked && styles.achievementLocked]}>
            <Text style={styles.achievementIcon}>{a.unlocked ? '🏆' : '🔒'}</Text>
            <Text style={[styles.achievementName, !a.unlocked && styles.achievementNameLocked]}>{a.name}</Text>
            <Text style={styles.achievementDescription}>{a.description}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 20 },
  title: { fontSize: 24, fontWeight: '700' },
  levelCard: { backgroundColor: '#111', borderRadius: 12, padding: 20, gap: 8 },
  level: { color: '#fff', fontSize: 22, fontWeight: '700' },
  xpTotal: { color: '#ccc', fontSize: 14 },
  xpToNext: { color: '#ccc', fontSize: 13, marginTop: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexBasis: '47%', backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16, gap: 4 },
  statValue: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 13, color: '#666' },
  weeklyCard: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16, gap: 8 },
  weeklyTitle: { fontSize: 16, fontWeight: '600' },
  weeklyCount: { fontSize: 14, color: '#555' },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  achievement: { flexBasis: '47%', backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16, gap: 4 },
  achievementLocked: { opacity: 0.5 },
  achievementIcon: { fontSize: 22 },
  achievementName: { fontSize: 15, fontWeight: '700' },
  achievementNameLocked: { color: '#777' },
  achievementDescription: { fontSize: 12, color: '#666' },
});
