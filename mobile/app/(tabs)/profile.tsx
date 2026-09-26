import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../features/auth/useAuth';
import { CANCEL_ERROR_MESSAGES } from '../../features/bookings/errorMessages';
import * as backend from '../../services/backend';
import { ProgressBar } from '../../components/ProgressBar';
import { Screen } from '../../components/Screen';
import { showAlert } from '../../components/Dialog';
import { PulseLine } from '../../components/PulseLine';
import { colors, radius, spacing, type } from '../../theme';

const pastStatusStyle: Record<'attended' | 'cancelled' | 'no_show', { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  attended: { label: 'Asististe', color: colors.success, bg: colors.successSoft, icon: 'checkmark-circle' },
  cancelled: { label: 'Cancelada', color: colors.inkSoft, bg: colors.surfaceAlt, icon: 'close-circle' },
  no_show: { label: 'No-show', color: colors.danger, bg: colors.dangerSoft, icon: 'alert-circle' },
};

const membershipStatusLabel: Record<backend.MyMembership['status'], string> = {
  active: 'Activa',
  paused: 'Pausada',
  cancelled: 'Cancelada',
  expired: 'Vencida',
};

export default function Profile() {
  const { user, isAdmin, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { data: membership, isLoading: loadingMembership } = useQuery({
    queryKey: ['my-membership'],
    queryFn: backend.getMyMembership,
    enabled: !isAdmin,
  });
  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ['my-history'],
    queryFn: backend.listMyHistory,
    enabled: !isAdmin,
  });

  const upcoming = (history ?? []).filter((h) => h.status === 'booked');
  const past = (history ?? []).filter((h) => h.status !== 'booked') as (backend.MyHistoryEntry & {
    status: 'attended' | 'cancelled' | 'no_show';
  })[];

  function confirmCancel(entry: backend.MyHistoryEntry) {
    showAlert('Cancelar reserva', `¿Cancelar tu reserva para "${entry.classTitle}"?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          setCancellingId(entry.id);
          const { error } = await backend.cancelReservation(entry.id);
          setCancellingId(null);
          if (error) {
            showAlert('Error', CANCEL_ERROR_MESSAGES[error.message] ?? 'No se pudo cancelar la reserva.');
            return;
          }
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['my-history'] }),
            queryClient.invalidateQueries({ queryKey: ['classes', 'upcoming'] }),
          ]);
        },
      },
    ]);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
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
            {loadingMembership ? (
              <PulseLine style={{ alignSelf: 'center' }} />
            ) : membership ? (
              <View style={styles.membershipCard}>
                <View style={styles.membershipHeader}>
                  <Text style={styles.membershipPlan}>Plan {membership.planName}</Text>
                  <Text style={styles.membershipCredits}>
                    {membership.creditsBalance}/{membership.creditsPerCycle}
                  </Text>
                </View>
                <ProgressBar progress={membership.creditsBalance / membership.creditsPerCycle} />
                <Text style={styles.membershipRenews}>
                  {membership.status === 'active'
                    ? `Vence el ${new Date(membership.cycleEnd).toLocaleDateString('es', { day: '2-digit', month: 'long' })}`
                    : membershipStatusLabel[membership.status]}
                </Text>
              </View>
            ) : (
              <View style={styles.noMembershipCard}>
                <Ionicons name="card-outline" size={24} color={colors.inkMuted} />
                <Text style={styles.noMembershipText}>No tienes una membresía activa todavía.</Text>
              </View>
            )}

            <View>
              <Text style={styles.sectionTitle}>Mis reservas</Text>
              {loadingHistory ? (
                <PulseLine style={{ alignSelf: 'center' }} />
              ) : (
                <View style={styles.historyList}>
                  {upcoming.map((entry) => (
                    <View key={entry.id} style={styles.upcomingRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyTitle}>{entry.classTitle}</Text>
                        <Text style={styles.historyDate}>
                          {entry.startsAt
                            ? new Date(entry.startsAt).toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                            : ''}
                        </Text>
                      </View>
                      <Pressable
                        style={styles.cancelUpcomingButton}
                        disabled={cancellingId === entry.id}
                        onPress={() => confirmCancel(entry)}
                      >
                        {cancellingId === entry.id ? (
                          <ActivityIndicator size="small" color={colors.danger} />
                        ) : (
                          <Text style={styles.cancelUpcomingButtonText}>Cancelar</Text>
                        )}
                      </Pressable>
                    </View>
                  ))}
                  {upcoming.length === 0 && <Text style={styles.emptyText}>No tienes reservas próximas.</Text>}
                </View>
              )}
            </View>

            <View>
              <Text style={styles.sectionTitle}>Historial</Text>
              {loadingHistory ? (
                <PulseLine style={{ alignSelf: 'center' }} />
              ) : (
                <View style={styles.historyList}>
                  {past.map((entry) => {
                    const s = pastStatusStyle[entry.status];
                    return (
                      <View key={entry.id} style={styles.historyRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.historyTitle}>{entry.classTitle}</Text>
                          <Text style={styles.historyDate}>
                            {entry.startsAt
                              ? new Date(entry.startsAt).toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                              : ''}
                          </Text>
                        </View>
                        <View style={[styles.historyBadge, { backgroundColor: s.bg }]}>
                          <Ionicons name={s.icon} size={13} color={s.color} />
                          <Text style={[styles.historyStatus, { color: s.color }]}>{s.label}</Text>
                        </View>
                      </View>
                    );
                  })}
                  {past.length === 0 && <Text style={styles.emptyText}>Todavía no tienes historial.</Text>}
                </View>
              )}
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
  name: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, color: colors.ink },
  email: { fontSize: 14, color: colors.inkSoft },
  adminBadge: { backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingVertical: 2, paddingHorizontal: spacing.sm, alignSelf: 'flex-start', marginTop: spacing.xs },
  adminBadgeText: { color: colors.accent, fontWeight: '700', fontSize: 11, textTransform: 'uppercase' },

  membershipCard: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  membershipHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  membershipPlan: { ...type.h2, color: colors.ink },
  membershipCredits: { ...type.h2, color: colors.ink },
  membershipRenews: { ...type.caption, color: colors.inkSoft },

  noMembershipCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  noMembershipText: { color: colors.inkSoft, fontSize: 14, textAlign: 'center' },

  sectionTitle: { ...type.eyebrow, color: colors.inkMuted, marginBottom: spacing.md },
  historyList: { gap: spacing.sm },
  upcomingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cancelUpcomingButton: { borderWidth: 1, borderColor: colors.danger, borderRadius: radius.pill, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  cancelUpcomingButtonText: { color: colors.danger, fontWeight: '600', fontSize: 12 },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
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
  emptyText: { color: colors.inkSoft, fontSize: 14 },

  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    padding: spacing.md + 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  signOutText: { color: colors.danger, fontWeight: '600' },
});
