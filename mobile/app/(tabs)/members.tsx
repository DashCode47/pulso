import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as backend from '../../services/backend';
import { Screen } from '../../components/Screen';
import { colors, radius, spacing, type } from '../../theme';

const reservationStatusLabel: Record<backend.MemberReservation['status'], string> = {
  booked: 'Reservada',
  attended: 'Asistió',
  cancelled: 'Cancelada',
  no_show: 'No-show',
};

function MemberRow({ member }: { member: backend.MemberSummary }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const { data: reservations, isLoading } = useQuery({
    queryKey: ['admin', 'member-reservations', member.userId],
    queryFn: () => backend.listMemberReservations(member.userId),
    enabled: expanded,
  });

  async function handleAdjust(amount: number) {
    if (busy) return;
    setBusy(true);
    await backend.adjustCredits(member.userId, amount);
    setBusy(false);
    setAdjustAmount('');
    await queryClient.invalidateQueries({ queryKey: ['admin', 'members'] });
  }

  async function handleNoShow(reservationId: string) {
    setBusy(true);
    await backend.markNoShow(reservationId);
    setBusy(false);
    await queryClient.invalidateQueries({ queryKey: ['admin', 'member-reservations', member.userId] });
  }

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={() => setExpanded((e) => !e)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{member.fullName}</Text>
          <Text style={styles.meta}>
            {member.membershipStatus === 'active' ? 'Membresía activa' : 'Sin membresía activa'}
          </Text>
        </View>
        <Text style={styles.credits}>{member.creditsBalance} créditos</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.inkMuted} />
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          <View style={styles.adjustRow}>
            <TextInput
              style={styles.adjustInput}
              placeholder="Cantidad"
              placeholderTextColor={colors.inkMuted}
              keyboardType="numbers-and-punctuation"
              value={adjustAmount}
              onChangeText={setAdjustAmount}
            />
            <Pressable
              style={[styles.adjustButton, (!Number(adjustAmount) || busy) && styles.adjustButtonDisabled]}
              disabled={!Number(adjustAmount) || busy}
              onPress={() => handleAdjust(Number(adjustAmount))}
            >
              <Text style={styles.adjustButtonText}>Ajustar créditos</Text>
            </Pressable>
          </View>

          <Text style={styles.historyTitle}>Reservas recientes</Text>
          {isLoading ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            (reservations ?? []).map((r) => (
              <View key={r.id} style={styles.reservationRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reservationTitle}>{r.classTitle}</Text>
                  <Text style={styles.reservationMeta}>
                    {r.startsAt ? new Date(r.startsAt).toLocaleDateString('es', { day: '2-digit', month: 'short' }) : ''} ·{' '}
                    {reservationStatusLabel[r.status]}
                  </Text>
                </View>
                {r.status === 'booked' && (
                  <Pressable style={styles.noShowButton} disabled={busy} onPress={() => handleNoShow(r.id)}>
                    <Text style={styles.noShowButtonText}>Marcar no-show</Text>
                  </Pressable>
                )}
              </View>
            ))
          )}
          {reservations?.length === 0 && <Text style={styles.emptyText}>Sin reservas.</Text>}
        </View>
      )}
    </View>
  );
}

export default function Members() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const { data: members, isLoading } = useQuery({
    queryKey: ['admin', 'members', debouncedQuery],
    queryFn: () => backend.searchMembers(debouncedQuery),
  });

  return (
    <Screen>
      <View style={styles.content}>
        <Text style={styles.title}>Miembros</Text>

        <TextInput
          style={styles.search}
          placeholder="Buscar por nombre..."
          placeholderTextColor={colors.inkMuted}
          value={query}
          onChangeText={setQuery}
        />

        {isLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {(members ?? []).map((m) => (
              <MemberRow key={m.userId} member={m} />
            ))}
            {members?.length === 0 && <Text style={styles.emptyText}>No se encontraron miembros.</Text>}
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: spacing.xxl, gap: spacing.lg },
  title: { ...type.title, color: colors.ink },
  search: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: 15,
    color: colors.ink,
  },
  list: { gap: spacing.md, paddingBottom: spacing.xxl },

  card: { backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.sm },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  meta: { ...type.caption, color: colors.inkSoft, marginTop: 2 },
  credits: { ...type.label, color: colors.accent },

  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md },
  adjustRow: { flexDirection: 'row', gap: spacing.sm },
  adjustInput: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    color: colors.ink,
  },
  adjustButton: { backgroundColor: colors.ink, borderRadius: radius.sm, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  adjustButtonDisabled: { backgroundColor: colors.locked },
  adjustButtonText: { color: colors.onDark, fontWeight: '600', fontSize: 13 },

  historyTitle: { ...type.label, color: colors.ink },
  reservationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.sm,
  },
  reservationTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  reservationMeta: { ...type.caption, color: colors.inkSoft, marginTop: 2 },
  noShowButton: { borderWidth: 1, borderColor: colors.danger, borderRadius: radius.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  noShowButtonText: { color: colors.danger, fontWeight: '600', fontSize: 12 },
  emptyText: { color: colors.inkSoft, fontSize: 14 },
});
