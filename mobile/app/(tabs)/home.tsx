import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../features/auth/store';
import { mockHomeSummary } from '../../features/home/mockData';
import * as backend from '../../services/backend';
import { ProgressBar } from '../../components/ProgressBar';
import { Screen } from '../../components/Screen';
import { colors, radius, spacing, type } from '../../theme';

export default function Home() {
  const isAdmin = useAuthStore((s) => s.isAdmin);
  return isAdmin ? <AdminHome /> : <MemberHome />;
}

function AdminHome() {
  const router = useRouter();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: backend.getAdminDashboard });

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.greeting}>Panel del estudio</Text>

        <View style={styles.quickActions}>
          <Pressable style={styles.quickAction} onPress={() => router.push('/(tabs)/admin')}>
            <Ionicons name="add-circle" size={20} color={colors.onAccent} />
            <Text style={styles.quickActionText}>Crear clase</Text>
          </Pressable>
          <Pressable style={[styles.quickAction, styles.quickActionDark]} onPress={() => router.push('/(tabs)/members')}>
            <Ionicons name="people" size={20} color={colors.onDark} />
            <Text style={[styles.quickActionText, { color: colors.onDark }]}>Ver miembros</Text>
          </Pressable>
        </View>

        {isLoading || !data ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statChip}>
                <Text style={styles.statValue}>{data.activeMembers}</Text>
                <Text style={styles.statLabel}>miembros activos</Text>
              </View>
              <View style={styles.statChip}>
                <Text style={styles.statValue}>{data.classesThisWeek}</Text>
                <Text style={styles.statLabel}>clases esta semana</Text>
              </View>
              <View style={styles.statChip}>
                <Text style={styles.statValue}>{data.creditsGrantedThisMonth}</Text>
                <Text style={styles.statLabel}>créditos este mes</Text>
              </View>
            </View>

            <View>
              <Text style={styles.sectionTitle}>Clases de hoy</Text>
              {data.todayClasses.length === 0 ? (
                <View style={styles.emptyTodayCard}>
                  <Text style={styles.emptyClassTextDark}>No hay clases programadas hoy.</Text>
                </View>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {data.todayClasses.map((c) => {
                    const isFull = c.bookedCount >= c.capacity;
                    return (
                      <View key={c.id} style={styles.todayRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.todayTitle}>{c.title}</Text>
                          <Text style={styles.todayMeta}>
                            {new Date(c.startsAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                        <View style={[styles.occupancyBadge, isFull && styles.occupancyBadgeFull]}>
                          <Text style={[styles.occupancyText, isFull && styles.occupancyTextFull]}>
                            {c.bookedCount}/{c.capacity}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function MemberHome() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const summary = mockHomeSummary;
  const firstName = (user?.name ?? user?.email ?? '').split(' ')[0].split('@')[0];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.greeting}>Hola, {firstName} 👋</Text>

        {summary.nextClass ? (
          <View style={styles.nextClassCard}>
            <Text style={styles.nextClassLabel}>Próxima clase</Text>
            <Text style={styles.nextClassTitle}>{summary.nextClass.title}</Text>
            <Text style={styles.nextClassMeta}>
              {summary.nextClass.dayLabel} · {summary.nextClass.startsAt} · {summary.nextClass.bikeLabel}
            </Text>
            <Pressable style={styles.viewButton} onPress={() => router.push('/(tabs)/bookings')}>
              <Text style={styles.viewButtonText}>Ver reserva</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.onAccent} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.emptyClassCard}>
            <Ionicons name="calendar-outline" size={28} color={colors.onDarkSoft} />
            <Text style={styles.emptyClassText}>No tienes clases reservadas.</Text>
            <Pressable style={styles.bookButton} onPress={() => router.push('/(tabs)/bookings')}>
              <Text style={styles.bookButtonText}>Reservar una clase</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={styles.statValue}>{summary.currentStreakWeeks}</Text>
            <Text style={styles.statLabel}>semanas</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{summary.weeklyXp}</Text>
            <Text style={styles.statLabel}>XP semana</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>#{summary.leaderboardPosition}</Text>
            <Text style={styles.statLabel}>ranking</Text>
          </View>
        </View>

        <View style={styles.weeklyCard}>
          <View style={styles.weeklyHeader}>
            <Text style={styles.weeklyTitle}>Objetivo semanal</Text>
            <Text style={styles.weeklyCount}>
              {summary.weeklyCompleted}/{summary.weeklyGoal}
            </Text>
          </View>
          <ProgressBar progress={summary.weeklyCompleted / summary.weeklyGoal} />
          <Text style={styles.weeklyHint}>
            {summary.weeklyGoal - summary.weeklyCompleted > 0
              ? `${summary.weeklyGoal - summary.weeklyCompleted} clases más para cumplir tu meta`
              : '¡Meta semanal completada!'}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xxl, gap: spacing.xl },
  greeting: { ...type.title, color: colors.ink },

  quickActions: { flexDirection: 'row', gap: spacing.sm },
  quickAction: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  quickActionDark: { backgroundColor: colors.ink },
  quickActionText: { color: colors.onAccent, fontWeight: '700' },

  sectionTitle: { ...type.h2, color: colors.ink, marginBottom: spacing.sm },
  emptyTodayCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.xl, alignItems: 'center' },
  emptyClassTextDark: { color: colors.inkSoft, fontSize: 14 },

  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  todayTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  todayMeta: { ...type.caption, color: colors.inkSoft, marginTop: 2 },
  occupancyBadge: { backgroundColor: '#e6f4ea', borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: spacing.sm },
  occupancyBadgeFull: { backgroundColor: '#fdeceb' },
  occupancyText: { color: colors.success, fontWeight: '700', fontSize: 12 },
  occupancyTextFull: { color: colors.danger },

  nextClassCard: { backgroundColor: colors.accent, borderRadius: radius.lg, padding: spacing.xl, gap: 4 },
  nextClassLabel: { color: colors.onAccent, opacity: 0.85, fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  nextClassTitle: { color: colors.onAccent, fontSize: 24, fontWeight: '800', marginTop: 2 },
  nextClassMeta: { color: colors.onAccent, opacity: 0.9, fontSize: 14 },
  viewButton: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: radius.sm,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  viewButtonText: { color: colors.onAccent, fontWeight: '700' },

  emptyClassCard: {
    backgroundColor: colors.ink,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyClassText: { color: colors.onDarkSoft, fontSize: 14 },
  bookButton: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, marginTop: spacing.xs },
  bookButtonText: { color: colors.onAccent, fontWeight: '700' },

  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statChip: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  statEmoji: { fontSize: 16 },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.ink },
  statLabel: { ...type.caption, color: colors.inkSoft },

  weeklyCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  weeklyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weeklyTitle: { ...type.h2, color: colors.ink },
  weeklyCount: { ...type.h2, color: colors.accent },
  weeklyHint: { ...type.caption, color: colors.inkSoft },
});
