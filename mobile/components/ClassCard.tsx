import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ClassWithBikes } from '../features/bookings/useBookings';
import { BikeGrid } from './BikeGrid';
import { colors, radius, spacing, type } from '../theme';

interface Props {
  classInfo: ClassWithBikes;
  bookedBikeId: string | null;
  onBook: (classId: string, bikeId: string) => void;
  onCancel: (classId: string) => void;
}

export function ClassCard({ classInfo, bookedBikeId, onBook, onCancel }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selectedBikeId, setSelectedBikeId] = useState<string | null>(null);

  const freeBikes = classInfo.bikes.filter((b) => !b.taken || b.id === bookedBikeId);
  const spotsLeft = Math.max(0, classInfo.capacity - classInfo.bookedCount);
  const availableCount = bookedBikeId ? freeBikes.length : Math.min(freeBikes.length, spotsLeft);
  const isFull = availableCount === 0 && !bookedBikeId;

  // Once the class capacity (not the physical bike count) is the limiting
  // factor, grey out the extra free bikes too -- picking one would just get
  // rejected by book_class()'s capacity check.
  const capacityReached = !bookedBikeId && spotsLeft <= 0;
  const bikesForGrid = capacityReached
    ? classInfo.bikes.map((b) => (b.taken ? b : { ...b, taken: true }))
    : classInfo.bikes;

  return (
    <View style={[styles.card, !!bookedBikeId && styles.cardBooked]}>
      <Pressable onPress={() => setExpanded((e) => !e)} style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{classInfo.title}</Text>
          <Text style={styles.meta}>
            {new Date(classInfo.startsAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })} ·{' '}
            {classInfo.durationMinutes} min · {classInfo.instructorName}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {bookedBikeId ? (
            <View style={styles.bookedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.onAccent} />
              <Text style={styles.bookedBadgeText}>Reservado</Text>
            </View>
          ) : (
            <View style={isFull ? styles.fullBadge : styles.availableBadge}>
              <Text style={isFull ? styles.fullBadgeText : styles.availableBadgeText}>
                {isFull ? 'Completa' : `${availableCount} libres`}
              </Text>
            </View>
          )}
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.inkMuted}
            style={styles.chevron}
          />
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          <BikeGrid
            bikes={bikesForGrid}
            selectedBikeId={selectedBikeId}
            bookedBikeId={bookedBikeId}
            onSelect={(bikeId) => !bookedBikeId && setSelectedBikeId(bikeId)}
          />

          {bookedBikeId ? (
            <Pressable style={styles.cancelButton} onPress={() => onCancel(classInfo.id)}>
              <Text style={styles.cancelButtonText}>Cancelar reserva</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.bookButton, !selectedBikeId && styles.bookButtonDisabled]}
              disabled={!selectedBikeId}
              onPress={() => selectedBikeId && onBook(classInfo.id, selectedBikeId)}
            >
              <Text style={styles.bookButtonText}>
                {selectedBikeId ? `Reservar ${classInfo.bikes.find((b) => b.id === selectedBikeId)?.label}` : 'Elige una bici'}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' },
  cardBooked: { borderWidth: 1.5, borderColor: colors.accent },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, gap: spacing.sm },
  title: { ...type.h2, color: colors.ink },
  meta: { ...type.caption, color: colors.inkSoft, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chevron: { marginLeft: 2 },
  availableBadge: { backgroundColor: '#e6f4ea', borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: spacing.sm },
  availableBadgeText: { color: colors.success, fontWeight: '700', fontSize: 12 },
  fullBadge: { backgroundColor: '#fdeceb', borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: spacing.sm },
  fullBadgeText: { color: colors.danger, fontWeight: '700', fontSize: 12 },
  bookedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  bookedBadgeText: { color: colors.onAccent, fontWeight: '700', fontSize: 12 },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md },
  bookButton: { backgroundColor: colors.ink, borderRadius: radius.sm, padding: spacing.md, alignItems: 'center' },
  bookButtonDisabled: { backgroundColor: colors.locked },
  bookButtonText: { color: colors.onDark, fontWeight: '600' },
  cancelButton: { borderRadius: radius.sm, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.danger },
  cancelButtonText: { color: colors.danger, fontWeight: '600' },
});
