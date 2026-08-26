import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../features/auth/useAuth';
import { mockMembership, mockHistory, historyStatusLabel, type HistoryStatus } from '../../features/profile/mockData';
import { ProgressBar } from '../../components/ProgressBar';
import { Screen } from '../../components/Screen';
import { colors, radius, spacing, type } from '../../theme';

const statusStyle: Record<HistoryStatus, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  attended: { color: colors.success, bg: '#e6f4ea', icon: 'checkmark-circle' },
  cancelled: { color: colors.locked, bg: colors.surfaceAlt, icon: 'close-circle' },
  no_show: { color: colors.danger, bg: '#fdeceb', icon: 'alert-circle' },
};

export default function Profile() {
  const { user, isAdmin, signOut } = useAuth();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={[styles.avatar, isAdmin && styles.avatarAdmin]}>
            <Ionicons name={isAdmin ? 'shield-checkmark' : 'person'} size={28} color={colors.onAccent} />
          </View>
          <View>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            {isAdmin && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>Administrador</Text>
              </View>
            )}
          </View>
        </View>

        {!isAdmin && (
          <>
            <View style={styles.membershipCard}>
              <View style={styles.membershipHeader}>
                <Text style={styles.membershipPlan}>Plan {mockMembership.planName}</Text>
                <Text style={styles.membershipCredits}>
                  {mockMembership.creditsBalance}/{mockMembership.creditsPerCycle}
                </Text>
              </View>
              <ProgressBar progress={mockMembership.creditsBalance / mockMembership.creditsPerCycle} />
              <Text style={styles.membershipRenews}>Se renueva el {mockMembership.renewsOn}</Text>
            </View>

            <View>
              <Text style={styles.sectionTitle}>Historial</Text>
              <View style={styles.historyList}>
                {mockHistory.map((entry) => {
                  const s = statusStyle[entry.status];
                  return (
                    <View key={entry.id} style={styles.historyRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyTitle}>{entry.title}</Text>
                        <Text style={styles.historyDate}>{entry.date}</Text>
                      </View>
                      <View style={[styles.historyBadge, { backgroundColor: s.bg }]}>
                        <Ionicons name={s.icon} size={13} color={s.color} />
                        <Text style={[styles.historyStatus, { color: s.color }]}>{historyStatusLabel[entry.status]}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}

        <Pressable style={styles.signOutButton} onPress={signOut}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={styles.signOutText}>Cerrar sesión</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xxl, gap: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarAdmin: { backgroundColor: colors.ink },
  name: { fontSize: 18, fontWeight: '700', color: colors.ink },
  email: { fontSize: 14, color: colors.inkSoft },
  adminBadge: { backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingVertical: 2, paddingHorizontal: spacing.sm, alignSelf: 'flex-start', marginTop: spacing.xs },
  adminBadgeText: { color: colors.accent, fontWeight: '700', fontSize: 11, textTransform: 'uppercase' },

  membershipCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  membershipHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  membershipPlan: { ...type.h2, color: colors.ink },
  membershipCredits: { ...type.h2, color: colors.accent },
  membershipRenews: { ...type.caption, color: colors.inkSoft },

  sectionTitle: { ...type.h2, color: colors.ink, marginBottom: spacing.sm },
  historyList: { gap: spacing.sm },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.sm,
  },
  historyTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  historyDate: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  historyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  historyStatus: { fontSize: 12, fontWeight: '700' },

  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  signOutText: { color: colors.danger, fontWeight: '600' },
});
