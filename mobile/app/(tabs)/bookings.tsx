import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useUpcomingClasses,
  groupClassesByWeekday,
  useBookingActions,
  useSchedulePublishedUntil,
  useMyMembership,
} from '../../features/bookings/useBookings';
import type { ClassWithBikes } from '../../features/bookings/useBookings';
import {
  BOOK_ERROR_MESSAGES,
  CANCEL_ERROR_MESSAGES,
  WAITLIST_ERROR_MESSAGES,
  membershipBlockMessage,
} from '../../features/bookings/errorMessages';
import { ClassCard } from '../../components/ClassCard';
import { Screen } from '../../components/Screen';
import { showAlert } from '../../components/Dialog';
import { PulseLine } from '../../components/PulseLine';
import { colors, radius, spacing, type } from '../../theme';

export default function Bookings() {
  const { data: classes, isLoading, isError, refetch } = useUpcomingClasses();
  const actions = useBookingActions();
  const router = useRouter();
  const { classId } = useLocalSearchParams<{ classId?: string }>();
  const { data: publishedUntil } = useSchedulePublishedUntil();
  const { data: membership } = useMyMembership();
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

  const days = groupClassesByWeekday(classes ?? []);
  const today = localIsoDate();
  const blockMessage = membershipBlockMessage(membership, today);
  const nextWeekPublished = isSunday() && publishedUntil ? publishedUntil > today : null;
  const linkedDayKey = classId ? days.find((d) => d.classes.some((c) => c.id === classId))?.key : undefined;
  const hasBookable = (d: (typeof days)[number]) => d.classes.some((c) => !c.started);
  const activeDayKey = linkedDayKey ?? selectedDayKey ?? (days.find(hasBookable) ?? days[0]).key;
  const selectedDay = days.find((d) => d.key === activeDayKey);
  const upcoming = selectedDay?.classes.filter((c) => !c.started) ?? [];
  const started = selectedDay?.classes.filter((c) => c.started) ?? [];

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

      <View style={styles.dayPills}>
        {days.map((day) => {
          const past = day.key < today;
          return (
            <Pressable
              key={day.key}
              disabled={past}
              onPress={() => {
                setSelectedDayKey(day.key);
                if (classId) router.setParams({ classId: undefined });
              }}
              style={[
                styles.dayPill,
                !hasBookable(day) && styles.dayPillEmpty,
                past && styles.dayPillPast,
                day.key === activeDayKey && styles.dayPillActive,
              ]}
            >
              <Text
                style={[
                  styles.dayPillText,
                  past && styles.dayPillTextPast,
                  day.key === activeDayKey && styles.dayPillTextActive,
                ]}
              >
                {day.key === today ? 'Hoy' : day.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {blockMessage && (
        <Pressable style={styles.banner} onPress={() => router.push('/(tabs)/profile')}>
          <Ionicons name="lock-closed" size={16} color={colors.danger} />
          <Text style={styles.bannerText}>{blockMessage}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.danger} />
        </Pressable>
      )}

      {nextWeekPublished !== null && (
        <View style={[styles.banner, styles.bannerInfo]}>
          <Ionicons name={nextWeekPublished ? 'calendar' : 'time-outline'} size={16} color={colors.inkSoft} />
          <Text style={[styles.bannerText, styles.bannerTextInfo]}>
            {nextWeekPublished
              ? 'Ya puedes reservar las clases de la próxima semana.'
              : 'El horario de la próxima semana aún no se publica. Vuelve más tarde.'}
          </Text>
        </View>
      )}

      {notice && (
        <Pressable style={[styles.banner, notice.ok && styles.bannerOk]} onPress={() => setNotice(null)}>
          <Ionicons name={notice.ok ? 'checkmark-circle' : 'alert-circle'} size={16} color={notice.ok ? colors.success : colors.danger} />
          <Text style={[styles.bannerText, notice.ok && styles.bannerTextOk]}>{notice.text}</Text>
        </Pressable>
      )}

      <ScrollView contentContainerStyle={styles.list}>
        {upcoming.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={28} color={colors.inkMuted} />
            <Text style={styles.emptyText}>
              {started.length > 0 ? 'Las clases de hoy ya terminaron.' : 'No hay clases este día.'}
            </Text>
          </View>
        )}
        {upcoming.map((classInfo) => (
          <ClassCard
            key={classInfo.id}
            classInfo={classInfo}
            busy={busyClassId === classInfo.id}
            locked={!!blockMessage}
            onBook={handleBook}
            onCancel={handleCancel}
            onJoinWaitlist={handleJoinWaitlist}
            onLeaveWaitlist={handleLeaveWaitlist}
          />
        ))}
        {started.length > 0 && <Text style={styles.sectionLabel}>Ya pasaron</Text>}
        {started.map((classInfo) => (
          <StartedClassRow key={classInfo.id} classInfo={classInfo} />
        ))}
      </ScrollView>
    </Screen>
  );
}

// Compact, greyed-out row: started classes can't be booked, they're only
// listed so the day doesn't look empty.
function StartedClassRow({ classInfo }: { classInfo: ClassWithBikes }) {
  const startsAt = new Date(classInfo.startsAt);
  const inProgress = Date.now() < startsAt.getTime() + classInfo.durationMinutes * 60_000;
  return (
    <View style={styles.startedRow}>
      <Text style={styles.startedTime}>
        {startsAt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
      </Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.startedTitle}>{classInfo.title}</Text>
        <Text style={styles.startedMeta}>{classInfo.instructorName}</Text>
      </View>
      <Text style={[styles.startedBadge, inProgress && styles.startedBadgeLive]}>
        {inProgress ? 'En curso' : 'Finalizada'}
      </Text>
    </View>
  );
}

// ponytail: device-local date, assumes members are in the studio's timezone
// (Bogota); compare in America/Bogota if that stops being true.
function localIsoDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Schedules go up on Sundays, so that's the only day the status matters.
function isSunday() {
  return new Date().getDay() === 0;
}

const styles = StyleSheet.create({
  container: { paddingTop: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  title: { ...type.title, color: colors.ink, paddingHorizontal: spacing.xxl },
  errorText: { color: colors.inkSoft, fontSize: 14 },
  retryText: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  dayPills: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xxl, marginTop: spacing.lg },
  dayPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dayPillEmpty: { opacity: 0.45 },
  dayPillPast: { opacity: 0.25, backgroundColor: 'transparent' },
  dayPillTextPast: { textDecorationLine: 'line-through' },
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
  bannerInfo: { backgroundColor: colors.surface },
  bannerText: { color: colors.danger, fontSize: 13, fontWeight: '600', flex: 1 },
  bannerTextOk: { color: colors.success },
  bannerTextInfo: { color: colors.inkSoft },
  list: { padding: spacing.xxl, gap: spacing.md },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  sectionLabel: { ...type.caption, color: colors.inkMuted, fontWeight: '700', textTransform: 'uppercase', marginTop: spacing.sm },
  startedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderStyle: 'dashed',
    opacity: 0.55,
  },
  startedTime: { color: colors.inkMuted, fontWeight: '700', fontSize: 13, textDecorationLine: 'line-through' },
  startedTitle: { color: colors.inkSoft, fontWeight: '600', fontSize: 14 },
  startedMeta: { ...type.caption, color: colors.inkMuted },
  startedBadge: { color: colors.inkMuted, fontWeight: '700', fontSize: 12 },
  startedBadgeLive: { color: colors.accent },
  emptyText: { color: colors.inkSoft, fontSize: 14 },
});
