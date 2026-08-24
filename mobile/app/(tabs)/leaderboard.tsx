import { useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { mockWeeklyLeaderboard, mockMonthlyLeaderboard, type LeaderboardEntry } from '../../features/leaderboard/mockData';
import { Screen } from '../../components/Screen';

const periods = [
  { key: 'weekly', label: 'Semanal', data: mockWeeklyLeaderboard },
  { key: 'monthly', label: 'Mensual', data: mockMonthlyLeaderboard },
] as const;

const medals = ['🥇', '🥈', '🥉'];

function LeaderboardRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  return (
    <View style={[styles.row, entry.isMe && styles.rowMe]}>
      <Text style={styles.rank}>{rank <= 3 ? medals[rank - 1] : rank}</Text>
      <Text style={[styles.name, entry.isMe && styles.nameMe]}>{entry.name}</Text>
      <Text style={[styles.xp, entry.isMe && styles.nameMe]}>{entry.xp} XP</Text>
    </View>
  );
}

export default function Leaderboard() {
  const [periodKey, setPeriodKey] = useState<(typeof periods)[number]['key']>('weekly');
  const period = periods.find((p) => p.key === periodKey)!;

  return (
    <Screen style={styles.container}>
      <Text style={styles.title}>Ranking</Text>

      <View style={styles.pills}>
        {periods.map((p) => (
          <Pressable
            key={p.key}
            onPress={() => setPeriodKey(p.key)}
            style={[styles.pill, p.key === periodKey && styles.pillActive]}
          >
            <Text style={[styles.pillText, p.key === periodKey && styles.pillTextActive]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={period.data}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => <LeaderboardRow entry={item} rank={index + 1} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 8 },
  title: { fontSize: 24, fontWeight: '700', paddingHorizontal: 24 },
  pills: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, marginTop: 16 },
  pill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#f0f0f0' },
  pillActive: { backgroundColor: '#111' },
  pillText: { fontWeight: '600', color: '#111' },
  pillTextActive: { color: '#fff' },
  list: { padding: 24, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    gap: 12,
  },
  rowMe: { backgroundColor: '#111' },
  rank: { width: 28, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  name: { flex: 1, fontSize: 16, fontWeight: '600' },
  xp: { fontSize: 15, color: '#555' },
  nameMe: { color: '#fff' },
});
