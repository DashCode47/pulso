import { useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { mockWeeklyLeaderboard, mockMonthlyLeaderboard, type LeaderboardEntry } from '../../features/leaderboard/mockData';
import { Screen } from '../../components/Screen';
import { colors, radius, spacing, type } from '../../theme';

const periods = [
  { key: 'weekly', label: 'Semanal', data: mockWeeklyLeaderboard },
  { key: 'monthly', label: 'Mensual', data: mockMonthlyLeaderboard },
] as const;

const medals = ['🥇', '🥈', '🥉'];

function LeaderboardRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const isTopThree = rank <= 3;
  return (
    <View style={[styles.row, entry.isMe && styles.rowMe]}>
      <View style={[styles.rankBadge, isTopThree && styles.rankBadgeTop]}>
        <Text style={styles.rank}>{isTopThree ? medals[rank - 1] : rank}</Text>
      </View>
      <Text style={[styles.name, entry.isMe && styles.nameMe]} numberOfLines={1}>
        {entry.name}
      </Text>
      <Text style={[styles.xp, entry.isMe && styles.xpMe]}>{entry.xp} XP</Text>
    </View>
  );
}

export default function Leaderboard() {
  const [periodKey, setPeriodKey] = useState<(typeof periods)[number]['key']>('weekly');
  const period = periods.find((p) => p.key === periodKey)!;
  const myEntry = period.data.find((e) => e.isMe);
  const myRank = myEntry ? period.data.indexOf(myEntry) + 1 : null;

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

      {myEntry && myRank && (
        <View style={styles.myRankCard}>
          <Text style={styles.myRankLabel}>Tu posición</Text>
          <Text style={styles.myRankValue}>
            #{myRank} · {myEntry.xp} XP
          </Text>
        </View>
      )}

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
  container: { paddingTop: spacing.sm },
  title: { ...type.title, color: colors.ink, paddingHorizontal: spacing.xxl },
  pills: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xxl, marginTop: spacing.lg },
  pill: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.surface },
  pillActive: { backgroundColor: colors.ink },
  pillText: { fontWeight: '600', color: colors.ink },
  pillTextActive: { color: colors.onDark },
  myRankCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginHorizontal: spacing.xxl,
    marginTop: spacing.lg,
  },
  myRankLabel: { ...type.label, color: colors.ink },
  myRankValue: { ...type.label, color: colors.accent },
  list: { padding: spacing.xxl, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  rowMe: { backgroundColor: colors.ink },
  rankBadge: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  rankBadgeTop: { backgroundColor: colors.accentSoft },
  rank: { fontSize: 16, fontWeight: '700', textAlign: 'center', color: colors.ink },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.ink },
  xp: { fontSize: 15, color: colors.inkSoft, fontWeight: '600' },
  nameMe: { color: colors.onDark },
  xpMe: { color: colors.accent },
});
