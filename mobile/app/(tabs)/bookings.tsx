import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUpcomingClasses, groupClassesByDay, useBookingActions } from '../../features/bookings/useBookings';
import { ClassCard } from '../../components/ClassCard';
import { Screen } from '../../components/Screen';
import { colors, radius, spacing, type } from '../../theme';

const BOOK_ERROR_MESSAGES: Record<string, string> = {
  no_active_membership: 'No tienes una membresía activa.',
  class_not_available: 'Esta clase ya no está disponible.',
  class_already_started: 'Esta clase ya comenzó.',
  insufficient_credits: 'No te quedan créditos.',
  bike_or_class_unavailable: 'Alguien más tomó esa bici, elige otra.',
};

export default function Bookings() {
  const { data: classes, isLoading, isError } = useUpcomingClasses();
  const { book, cancel } = useBookingActions();
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={28} color={colors.inkMuted} />
        <Text style={styles.errorText}>No se pudieron cargar las clases.</Text>
      </Screen>
    );
  }

  const days = groupClassesByDay(classes ?? []);
  const activeDayKey = selectedDayKey ?? days[0]?.key;
  const selectedDay = days.find((d) => d.key === activeDayKey);

  async function handleBook(classId: string, bikeId: string) {
    setActionError(null);
    const { error } = await book(classId, bikeId);
    if (error) setActionError(BOOK_ERROR_MESSAGES[error.message] ?? 'No se pudo reservar.');
  }

  async function handleCancel(classId: string) {
    setActionError(null);
    const { error } = await cancel(classId);
    if (error) setActionError('No se pudo cancelar.');
  }

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

      {actionError && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={colors.danger} />
          <Text style={styles.errorBannerText}>{actionError}</Text>
        </View>
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
              bookedBikeId={classInfo.bookedBikeId}
              onBook={handleBook}
              onCancel={handleCancel}
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
  dayPillsScroll: { flexGrow: 0, marginTop: spacing.lg },
  dayPills: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.xxl },
  dayPill: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.surface },
  dayPillActive: { backgroundColor: colors.ink },
  dayPillText: { fontWeight: '600', color: colors.ink },
  dayPillTextActive: { color: colors.onDark },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#fdeceb',
    borderRadius: radius.sm,
    padding: spacing.md,
    marginHorizontal: spacing.xxl,
    marginTop: spacing.sm,
  },
  errorBannerText: { color: colors.danger, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  list: { padding: spacing.xxl, gap: spacing.md },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyText: { color: colors.inkSoft, fontSize: 14 },
});
