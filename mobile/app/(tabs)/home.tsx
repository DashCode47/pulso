import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../features/auth/store';
import { mockHomeSummary } from '../../features/home/mockData';
import { ProgressBar } from '../../components/ProgressBar';
import { Screen } from '../../components/Screen';

export default function Home() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const summary = mockHomeSummary;

  return (
    <Screen>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>Hola, {user?.name ?? user?.email}</Text>

      <View style={styles.headline}>
        <Text style={styles.streak}>🔥 {summary.currentStreakWeeks} semanas de racha</Text>
        <Text style={styles.subline}>{summary.weeklyXp} XP esta semana</Text>
        <Text style={styles.subline}>#{summary.leaderboardPosition} en el ranking</Text>
      </View>

      <View style={styles.weeklyCard}>
        <Text style={styles.weeklyTitle}>Objetivo semanal</Text>
        <Text style={styles.weeklyCount}>
          {summary.weeklyCompleted} / {summary.weeklyGoal} clases
        </Text>
        <ProgressBar progress={summary.weeklyCompleted / summary.weeklyGoal} />
      </View>

      <View>
        <Text style={styles.sectionTitle}>Próxima clase</Text>
        {summary.nextClass ? (
          <View style={styles.nextClassCard}>
            <Text style={styles.nextClassTitle}>{summary.nextClass.title}</Text>
            <Text style={styles.nextClassMeta}>
              {summary.nextClass.dayLabel} · {summary.nextClass.startsAt}
            </Text>
            <Text style={styles.nextClassMeta}>{summary.nextClass.bikeLabel}</Text>
            <Pressable style={styles.viewButton} onPress={() => router.push('/(tabs)/bookings')}>
              <Text style={styles.viewButtonText}>Ver reserva</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.nextClassCard}>
            <Text style={styles.nextClassMeta}>No tienes clases reservadas.</Text>
            <Pressable style={styles.viewButton} onPress={() => router.push('/(tabs)/bookings')}>
              <Text style={styles.viewButtonText}>Reservar una clase</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 20 },
  greeting: { fontSize: 24, fontWeight: '700' },
  headline: { gap: 4 },
  streak: { fontSize: 20, fontWeight: '700' },
  subline: { fontSize: 15, color: '#555' },
  weeklyCard: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16, gap: 8 },
  weeklyTitle: { fontSize: 16, fontWeight: '600' },
  weeklyCount: { fontSize: 14, color: '#555' },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  nextClassCard: { backgroundColor: '#111', borderRadius: 12, padding: 20, gap: 4 },
  nextClassTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  nextClassMeta: { color: '#ccc', fontSize: 14 },
  viewButton: { backgroundColor: '#fff', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 12 },
  viewButtonText: { color: '#111', fontWeight: '700' },
});
