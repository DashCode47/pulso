import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet, Switch } from 'react-native';
import { Image } from 'expo-image';
import { CameraIcon, CheckCircleIcon, CreditCardIcon, MoonIcon, ShieldCheckIcon, SignOutIcon, SunIcon, UserIcon, WarningCircleIcon, XCircleIcon, type Icon } from '../../components/icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useAuth } from '../../features/auth/useAuth';
import { CANCEL_ERROR_MESSAGES } from '../../features/bookings/errorMessages';
import { useBookingActions } from '../../features/bookings/useBookings';
import { useChangeAvatar, useMyAvatar } from '../../features/profile/useAvatar';
import * as backend from '../../services/backend';
import { ProgressBar } from '../../components/ProgressBar';
import { Screen } from '../../components/Screen';
import { showAlert } from '../../components/Dialog';
import { PulseLine } from '../../components/PulseLine';
import { colors, radius, spacing, type, themed, useThemeMode } from '../../theme';

const pastStatusStyle = themed((): Record<'attended' | 'cancelled' | 'no_show', { label: string; color: string; icon: Icon }> => ({
  attended: { label: 'Asististe', color: colors.success, icon: CheckCircleIcon },
  cancelled: { label: 'Cancelada', color: colors.inkSoft, icon: XCircleIcon },
  no_show: { label: 'No-show', color: colors.danger, icon: WarningCircleIcon },
}));

const membershipStatusLabel: Record<backend.MyMembership['status'], string> = {
  active: 'Activa',
  cancelled: 'Cancelada',
  expired: 'Vencida',
};

// cycle_end is a plain date: parse it as local midnight. new Date('YYYY-MM-DD')
// is UTC midnight, which in Bogota shows the previous day.
function formatDay(isoDate: string) {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('es', { day: '2-digit', month: 'long' });
}

export default function Profile() {
  const { user, isAdmin, signOut } = useAuth();
  const { mode, setMode } = useThemeMode();
  const actions = useBookingActions();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { data: avatarUrl } = useMyAvatar();
  const changeAvatar = useChangeAvatar();
  const { data: membership, isLoading: loadingMembership } = useQuery({
    queryKey: ['my-membership'],
    queryFn: backend.getMyMembership,
    enabled: !isAdmin,
  });
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  // Both keys start with 'my-history' so booking actions invalidate them together.
  const { data: upcoming = [], isLoading: loadingUpcoming } = useQuery({
    queryKey: ['my-history', 'upcoming'],
    queryFn: () => backend.listMyHistory('upcoming'),
    enabled: !isAdmin,
  });
  const pastQuery = useInfiniteQuery({
    queryKey: ['my-history', 'past'],
    queryFn: ({ pageParam }) => backend.listMyHistory('past', pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === backend.HISTORY_PAGE_SIZE ? all.length : undefined),
    enabled: !isAdmin && tab === 'past',
  });
  const past = (pastQuery.data?.pages.flat() ?? []) as (backend.MyHistoryEntry & {
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
          const { error } = await actions.cancel(entry.id);
          setCancellingId(null);
          if (error) showAlert('Error', CANCEL_ERROR_MESSAGES[error.message] ?? 'No se pudo cancelar la reserva.');
        },
      },
    ]);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            style={styles.avatar}
            disabled={changeAvatar.isPending}
            accessibilityLabel="Cambiar foto de perfil"
            onPress={() =>
              changeAvatar.mutate(undefined, { onError: () => showAlert('Error', 'No se pudo actualizar la foto de perfil.') })
            }
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} cachePolicy="memory-disk" />
            ) : isAdmin ? (
              <ShieldCheckIcon size={28} color={colors.onAccent} weight="fill" />
            ) : (
              <UserIcon size={28} color={colors.onAccent} weight="fill" />
            )}
            {changeAvatar.isPending ? (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator size="small" color={colors.onAccent} />
              </View>
            ) : (
              <View style={styles.avatarBadge}>
                <CameraIcon size={12} color={colors.ink} weight="fill" />
              </View>
            )}
          </Pressable>
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
                    ? `Vence el ${formatDay(membership.cycleEnd)}`
                    : membership.status === 'expired'
                      ? `Vencida el ${formatDay(membership.cycleEnd)}`
                      : membershipStatusLabel[membership.status]}
                </Text>
              </View>
            ) : (
              <View style={styles.noMembershipCard}>
                <CreditCardIcon size={24} color={colors.inkMuted} />
                <Text style={styles.noMembershipText}>No tienes una membresía activa todavía.</Text>
              </View>
            )}

            <View>
              <View style={styles.tabs} accessibilityRole="tablist">
                {(['upcoming', 'past'] as const).map((key) => (
                  <Pressable
                    key={key}
                    style={[styles.tab, tab === key && styles.tabActive]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: tab === key }}
                    onPress={() => setTab(key)}
                  >
                    <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
                      {key === 'upcoming' ? 'Próximas' : 'Historial'}
                    </Text>
                    {key === 'upcoming' && upcoming.length > 0 && (
                      <View style={[styles.tabCount, tab === key && styles.tabCountActive]}>
                        <Text style={[styles.tabCountText, tab === key && styles.tabCountTextActive]}>{upcoming.length}</Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>

              {tab === 'upcoming' ? (
                loadingUpcoming ? (
                  <PulseLine style={{ alignSelf: 'center' }} />
                ) : upcoming.length === 0 ? (
                  <Text style={styles.emptyText}>No tienes reservas próximas.</Text>
                ) : (
                  <View style={styles.upcomingList}>
                    {upcoming.map((entry) => {
                      const d = new Date(entry.startsAt);
                      return (
                        <View key={entry.id} style={styles.upcomingCard}>
                          <View style={styles.dateBlock}>
                            <Text style={styles.dateDay}>{d.getDate()}</Text>
                            <Text style={styles.dateMonth}>{d.toLocaleDateString('es', { month: 'short' }).replace('.', '')}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.historyTitle}>{entry.classTitle}</Text>
                            <Text style={styles.historyDate}>
                              {d.toLocaleDateString('es', { weekday: 'long' })} ·{' '}
                              {d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
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
                      );
                    })}
                  </View>
                )
              ) : pastQuery.isLoading ? (
                <PulseLine style={{ alignSelf: 'center' }} />
              ) : past.length === 0 ? (
                <Text style={styles.emptyText}>Todavía no tienes historial.</Text>
              ) : (
                <View style={styles.historyGroup}>
                  {past.map((entry, i) => {
                    const s = pastStatusStyle[entry.status];
                    return (
                      <View key={entry.id} style={[styles.historyRow, i > 0 && styles.historyRowDivider]}>
                        <s.icon size={18} color={s.color} weight="fill" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.historyTitle}>{entry.classTitle}</Text>
                          <Text style={styles.historyDate}>
                            {entry.startsAt
                              ? new Date(entry.startsAt).toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                              : ''}
                          </Text>
                        </View>
                        <Text style={[styles.historyStatus, { color: s.color }]}>{s.label}</Text>
                      </View>
                    );
                  })}
                  {pastQuery.hasNextPage && (
                    <Pressable
                      style={[styles.historyRow, styles.historyRowDivider, styles.loadMore]}
                      disabled={pastQuery.isFetchingNextPage}
                      onPress={() => pastQuery.fetchNextPage()}
                    >
                      {pastQuery.isFetchingNextPage ? (
                        <ActivityIndicator size="small" color={colors.inkSoft} />
                      ) : (
                        <Text style={styles.loadMoreText}>Ver más</Text>
                      )}
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          </>
        )}

        <View style={styles.themeRow}>
          {mode === 'dark' ? <MoonIcon size={18} color={colors.ink} weight="fill" /> : <SunIcon size={18} color={colors.ink} weight="fill" />}
          <Text style={styles.themeText}>Tema claro</Text>
          <Switch
            value={mode === 'light'}
            onValueChange={(on) => setMode(on ? 'light' : 'dark')}
            trackColor={{ false: colors.surfaceAlt, true: colors.accent }}
            thumbColor={colors.onAccent}
            accessibilityLabel="Tema claro"
          />
        </View>

        <Pressable style={styles.signOutButton} onPress={signOut}>
          <SignOutIcon size={18} color={colors.danger} />
          <Text style={styles.signOutText}>Cerrar sesión</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  content: { padding: spacing.xxl, gap: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 56, height: 56, borderRadius: 28 },
  avatarOverlay: { ...StyleSheet.absoluteFill, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
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

  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
  },
  tabActive: { backgroundColor: colors.accent },
  tabText: { ...type.label, color: colors.inkSoft },
  tabTextActive: { color: colors.onAccent },
  tabCount: { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, minWidth: 18, paddingHorizontal: 5, alignItems: 'center' },
  tabCountActive: { backgroundColor: colors.onAccent },
  tabCountText: { fontSize: 11, fontWeight: '700', color: colors.inkSoft },
  tabCountTextActive: { color: colors.accent },

  upcomingList: { gap: spacing.sm },
  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  dateBlock: { width: 48, paddingVertical: spacing.xs, borderRadius: radius.sm, backgroundColor: colors.accentSoft, alignItems: 'center' },
  dateDay: { fontSize: 20, fontWeight: '800', color: colors.ink, lineHeight: 24 },
  dateMonth: { ...type.eyebrow, fontSize: 10, letterSpacing: 1, color: colors.inkSoft },
  cancelUpcomingButton: { borderWidth: 1, borderColor: colors.danger, borderRadius: radius.pill, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  cancelUpcomingButtonText: { color: colors.danger, fontWeight: '600', fontSize: 12 },

  historyGroup: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.md },
  historyRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  historyTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  historyDate: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  historyStatus: { fontSize: 12, fontWeight: '700' },
  loadMore: { justifyContent: 'center' },
  loadMoreText: { ...type.label, color: colors.ink },
  emptyText: { color: colors.inkSoft, fontSize: 14 },

  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  themeText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink },

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
}));
