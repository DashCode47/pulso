import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { CalendarBlankIcon, CalendarCheckIcon, CaretRightIcon, CheckIcon, ClockIcon, CloudSlashIcon, ExclamationMarkIcon, LockIcon, MoonIcon, type Icon } from '../../components/icons';
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
import { colors, radius, spacing, type, themed, useThemeMode } from '../../theme';

export default function Bookings() {
  useThemeMode((s) => s.mode); // re-render al cambiar de tema
  const { data: classes, isLoading, isError, refetch } = useUpcomingClasses();
  const actions = useBookingActions();
  const router = useRouter();
  const { classId } = useLocalSearchParams<{ classId?: string }>();
  const { data: publishedUntil } = useSchedulePublishedUntil();
  const { data: membership } = useMyMembership();
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyClassId, setBusyClassId] = useState<string | null>(null);

  // Success toasts clear themselves; errors stay until tapped.
  useEffect(() => {
    if (!notice?.ok) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

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
        <View style={styles.emptyIcon}>
          <CloudSlashIcon size={24} color={colors.inkSoft} />
        </View>
        <Text style={styles.emptyTitle}>Sin conexión</Text>
        <Text style={styles.emptyText}>No se pudieron cargar las clases.</Text>
        <Pressable style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]} onPress={() => refetch()}>
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
  const hasMine = (d: (typeof days)[number]) => d.classes.some((c) => c.bookedBikeId || c.myWaitlistEntryId);
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

  const classCount = selectedDay?.classes.length ?? 0;

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>
          Semana · {shortDate(days[0].key)} – {shortDate(days[days.length - 1].key)}
        </Text>
        <Text style={styles.title}>Reservar</Text>
      </View>

      <View style={styles.days}>
        {days.map((day) => {
          const past = day.key < today;
          const active = day.key === activeDayKey;
          const empty = !hasBookable(day);
          return (
            <Pressable
              key={day.key}
              disabled={past}
              onPress={() => {
                setSelectedDayKey(day.key);
                if (classId) router.setParams({ classId: undefined });
              }}
              style={({ pressed }) => [
                styles.day,
                day.key === today && styles.dayToday,
                active && styles.dayActive,
                past && styles.dayPast,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.dayWeekday, active && styles.dayWeekdayActive]}>
                {day.key === today ? 'Hoy' : day.label}
              </Text>
              <Text style={[styles.dayNumber, empty && styles.dayNumberEmpty, active && styles.dayNumberActive]}>
                {Number(day.key.slice(8))}
              </Text>
              <View style={[styles.dayDot, hasMine(day) && (active ? styles.dayDotActive : styles.dayDotOn)]} />
            </Pressable>
          );
        })}
      </View>

      {blockMessage && (
        <Banner tone="danger" icon={LockIcon} text={blockMessage} onPress={() => router.push('/(tabs)/profile')} chevron />
      )}

      {nextWeekPublished !== null && (
        <Banner
          tone="info"
          icon={nextWeekPublished ? CalendarCheckIcon : ClockIcon}
          text={
            nextWeekPublished
              ? 'Ya puedes reservar las clases de la próxima semana.'
              : 'El horario de la próxima semana aún no se publica. Vuelve más tarde.'
          }
        />
      )}

      {notice && (
        <Banner
          tone={notice.ok ? 'success' : 'danger'}
          icon={notice.ok ? CheckIcon : ExclamationMarkIcon}
          text={notice.text}
          onPress={() => setNotice(null)}
        />
      )}

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {selectedDay && (
          <View style={styles.dayHeader}>
            <Text style={styles.dayHeaderTitle}>{longDate(selectedDay.key)}</Text>
            {classCount > 0 && (
              <Text style={styles.dayHeaderCount}>
                {classCount} {classCount === 1 ? 'clase' : 'clases'}
              </Text>
            )}
          </View>
        )}

        {upcoming.length === 0 && (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              {started.length > 0 ? <MoonIcon size={24} color={colors.inkSoft} /> : <CalendarBlankIcon size={24} color={colors.inkSoft} />}
            </View>
            <Text style={styles.emptyTitle}>{started.length > 0 ? 'Día terminado' : 'Sin clases'}</Text>
            <Text style={styles.emptyText}>
              {started.length > 0 ? 'Las clases de hoy ya terminaron.' : 'No hay clases programadas este día.'}
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

        {started.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Ya pasaron</Text>
            <View style={styles.startedGroup}>
              {started.map((classInfo, i) => (
                <StartedClassRow key={classInfo.id} classInfo={classInfo} first={i === 0} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const BANNER_TONES = themed(() => ({
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  success: { bg: colors.successSoft, fg: colors.success },
  info: { bg: colors.surface, fg: colors.inkSoft },
}));

function Banner({
  tone,
  icon: I,
  text,
  onPress,
  chevron,
}: {
  tone: keyof typeof BANNER_TONES;
  icon: Icon;
  text: string;
  onPress?: () => void;
  chevron?: boolean;
}) {
  const { bg, fg } = BANNER_TONES[tone];
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.banner, { backgroundColor: bg }, pressed && styles.pressed]}
    >
      <View style={[styles.bannerIcon, { borderColor: fg }]}>
        <I size={12} color={fg} weight="bold" />
      </View>
      <Text style={[styles.bannerText, tone !== 'info' && { color: fg }]}>{text}</Text>
      {chevron && <CaretRightIcon size={16} color={fg} weight="bold" />}
    </Pressable>
  );
}

// Compact, greyed-out row: started classes can't be booked, they're only
// listed so the day doesn't look empty.
function StartedClassRow({ classInfo, first }: { classInfo: ClassWithBikes; first: boolean }) {
  const startsAt = new Date(classInfo.startsAt);
  const inProgress = Date.now() < startsAt.getTime() + classInfo.durationMinutes * 60_000;
  return (
    <View style={[styles.startedRow, !first && styles.startedRowDivider]}>
      <Text style={styles.startedTime}>{startsAt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.startedTitle} numberOfLines={1}>
          {classInfo.title}
        </Text>
        <Text style={styles.startedMeta} numberOfLines={1}>
          {classInfo.instructorName}
        </Text>
      </View>
      <View style={styles.startedBadge}>
        {inProgress && <View style={styles.liveDot} />}
        <Text style={[styles.startedBadgeText, inProgress && styles.startedBadgeTextLive]}>
          {inProgress ? 'En curso' : 'Finalizada'}
        </Text>
      </View>
    </View>
  );
}

// ponytail: device-local date, assumes members are in the studio's timezone
// (Bogota); compare in America/Bogota if that stops being true.
function localIsoDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Day keys are local "YYYY-MM-DD"; parse as local, not UTC.
function fromKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// "29 sep"
function shortDate(key: string) {
  return fromKey(key).toLocaleDateString('es', { day: 'numeric', month: 'short' }).replace('.', '');
}

// "Lunes 29 de septiembre"
function longDate(key: string) {
  const s = fromKey(key).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Schedules go up on Sundays, so that's the only day the status matters.
function isSunday() {
  return new Date().getDay() === 0;
}

const styles = themed(() => StyleSheet.create({
  container: { paddingTop: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xxl },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },

  header: { paddingHorizontal: spacing.xxl },
  eyebrow: { ...type.eyebrow, color: colors.inkMuted, marginBottom: spacing.xs },
  title: { ...type.title, color: colors.ink },

  days: { flexDirection: 'row', gap: 6, paddingHorizontal: spacing.xxl, marginTop: spacing.xl, marginBottom: spacing.sm },
  day: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm,
    gap: 2,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  dayToday: { borderColor: colors.inkMuted },
  dayActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayPast: { opacity: 0.3, backgroundColor: 'transparent' },
  dayWeekday: { ...type.eyebrow, fontSize: 10, letterSpacing: 1, color: colors.inkMuted },
  dayWeekdayActive: { color: colors.onAccent, opacity: 0.6 },
  dayNumber: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5, color: colors.ink, fontVariant: ['tabular-nums'] },
  dayNumberEmpty: { color: colors.inkMuted },
  dayNumberActive: { color: colors.onAccent },
  dayDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  dayDotOn: { backgroundColor: colors.accent },
  dayDotActive: { backgroundColor: colors.onAccent },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.xxl,
    marginTop: spacing.sm,
  },
  bannerIcon: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.2, alignItems: 'center', justifyContent: 'center' },
  bannerText: { ...type.label, lineHeight: 18, color: colors.inkSoft, flex: 1 },

  list: { paddingHorizontal: spacing.xxl, paddingTop: spacing.lg, paddingBottom: spacing.xxl * 2, gap: spacing.md },
  dayHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.xs },
  dayHeaderTitle: { ...type.h2, color: colors.ink },
  dayHeaderCount: { ...type.caption, color: colors.inkMuted },

  empty: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xxl * 2 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  emptyTitle: { ...type.h2, color: colors.ink },
  emptyText: { ...type.caption, fontSize: 13, color: colors.inkSoft, textAlign: 'center' },
  retryButton: {
    marginTop: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
  },
  retryText: { color: colors.ink, fontWeight: '600', fontSize: 14 },

  sectionLabel: { ...type.eyebrow, color: colors.inkMuted, marginTop: spacing.lg },
  startedGroup: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  startedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  startedRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  startedTime: { width: 52, color: colors.inkMuted, fontWeight: '700', fontSize: 14, fontVariant: ['tabular-nums'] },
  startedTitle: { color: colors.inkSoft, fontWeight: '600', fontSize: 14 },
  startedMeta: { ...type.caption, color: colors.inkMuted },
  startedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  startedBadgeText: { ...type.caption, fontWeight: '700', color: colors.inkMuted },
  startedBadgeTextLive: { color: colors.success },
}));
