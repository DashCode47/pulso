import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUpcomingClasses, groupClassesByDay, useBookingActions } from '../../features/bookings/useBookings';
import { BOOK_ERROR_MESSAGES, CANCEL_ERROR_MESSAGES, WAITLIST_ERROR_MESSAGES } from '../../features/bookings/errorMessages';
import { ClassCard } from '../../components/ClassCard';
import { Screen } from '../../components/Screen';
import { showAlert } from '../../components/Dialog';
import { PulseLine } from '../../components/PulseLine';
import { colors, radius, spacing, type } from '../../theme';

export default function Bookings() {
  const { data: classes, isLoading, isError, refetch } = useUpcomingClasses();
  const actions = useBookingActions();
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyClassId, setBusyClassId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Screen style={styles.center}>
        <PulseLine />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={28} color={colors.inkMuted} />
        <Text style={styles.errorText}>No se pudieron cargar las clases.</Text>
        <Pressable onPress={() => refetch()}>
          <Text style={styles.retryText}>Reintentar</Text>
        </Pressable>
      </Screen>
    );
  }

  const days = groupClassesByDay(classes ?? []);
  const activeDayKey = selectedDayKey ?? days[0]?.key;
  const selectedDay = days.find((d) => d.key === activeDayKey);

  // One action at a time per class: the button shows a spinner and ignores
  // extra taps until the RPC answers.
  async function run(
    classId: string,
    action: () => Promise<{ error: { message: string } | null }>,
    messages: Record<string, string>,
    fallback: string,
    success: string,
  ) {
    if (busyClassId) return;
    setNotice(null);
    setBusyClassId(classId);
    const { error } = await action();
    setBusyClassId(null);
    setNotice(error ? { ok: false, text: messages[error.message] ?? fallback } : { ok: true, text: success });
  }

  const handleBook = (classId: string, bikeId: string) =>
    run(classId, () => actions.book(classId, bikeId), BOOK_ERROR_MESSAGES, 'No se pudo reservar. Revisa tu conexión.', '¡Reserva confirmada!');

  const handleCancel = (classId: string, reservationId: string) =>
    showAlert('Cancelar reserva', 'Se te devolverá el crédito.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: () =>
          run(classId, () => actions.cancel(reservationId), CANCEL_ERROR_MESSAGES, 'No se pudo cancelar. Revisa tu conexión.', 'Reserva cancelada. Crédito devuelto.'),
      },
    ]);

  const handleJoinWaitlist = (classId: string) =>
    run(
      classId,
      () => actions.joinWaitlist(classId),
      WAITLIST_ERROR_MESSAGES,
      'No se pudo unir a la lista. Revisa tu conexión.',
      'Estás en la lista de espera. Si se libera un cupo, te reservamos automáticamente.',
    );

  const handleLeaveWaitlist = (classId: string, entryId: string) =>
    run(classId, () => actions.leaveWaitlist(entryId), WAITLIST_ERROR_MESSAGES, 'No se pudo salir de la lista.', 'Saliste de la lista de espera.');

  return (
    <Screen style={styles.container}>
      <Text style={styles.title}>Reservar</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dayPillsScroll}
        contentContainerStyle={styles.dayPills}
      >
        {days.map((day) => (
          <Pressable
            key={day.key}
            onPress={() => setSelectedDayKey(day.key)}
            style={[styles.dayPill, day.key === activeDayKey && styles.dayPillActive]}
          >
            <Text style={[styles.dayPillText, day.key === activeDayKey && styles.dayPillTextActive]}>
              {day.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {notice && (
        <Pressable style={[styles.banner, notice.ok && styles.bannerOk]} onPress={() => setNotice(null)}>
          <Ionicons name={notice.ok ? 'checkmark-circle' : 'alert-circle'} size={16} color={notice.ok ? colors.success : colors.danger} />
          <Text style={[styles.bannerText, notice.ok && styles.bannerTextOk]}>{notice.text}</Text>
        </Pressable>
      )}

      <ScrollView contentContainerStyle={styles.list}>
        {!selectedDay || selectedDay.classes.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={28} color={colors.inkMuted} />
            <Text style={styles.emptyText}>No hay clases próximas.</Text>
          </View>
        ) : (
          selectedDay.classes.map((classInfo) => (
            <ClassCard
              key={classInfo.id}
              classInfo={classInfo}
              busy={busyClassId === classInfo.id}
              onBook={handleBook}
              onCancel={handleCancel}
              onJoinWaitlist={handleJoinWaitlist}
              onLeaveWaitlist={handleLeaveWaitlist}
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  title: { ...type.title, color: colors.ink, paddingHorizontal: spacing.xxl },
  errorText: { color: colors.inkSoft, fontSize: 14 },
  retryText: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  dayPillsScroll: { flexGrow: 0, marginTop: spacing.lg },
  dayPills: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.xxl },
  dayPill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dayPillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayPillText: { fontWeight: '600', color: colors.inkSoft },
  dayPillTextActive: { color: colors.onAccent },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginHorizontal: spacing.xxl,
    marginTop: spacing.sm,
  },
  bannerOk: { backgroundColor: colors.successSoft },
  bannerText: { color: colors.danger, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  bannerTextOk: { color: colors.success },
  list: { padding: spacing.xxl, gap: spacing.md },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyText: { color: colors.inkSoft, fontSize: 14 },
});
