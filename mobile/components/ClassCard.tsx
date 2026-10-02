import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ClassWithBikes } from '../features/bookings/useBookings';
import { BikeGrid } from './BikeGrid';
import { colors, radius, spacing, type } from '../theme';

interface Props {
  classInfo: ClassWithBikes;
  busy: boolean;
  // No valid membership: can still cancel/leave the waitlist, not book or join.
  locked: boolean;
  onBook: (classId: string, bikeId: string) => void;
  onCancel: (classId: string, reservationId: string) => void;
  onJoinWaitlist: (classId: string) => void;
  onLeaveWaitlist: (classId: string, entryId: string) => void;
}

const formatDeadline = (iso: string) =>
  new Date(iso).toLocaleString('es', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export function ClassCard({ classInfo, busy, locked, onBook, onCancel, onJoinWaitlist, onLeaveWaitlist }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [pickedBikeId, setPickedBikeId] = useState<string | null>(null);
  const { bookedBikeId, myReservationId, myWaitlistEntryId, myWaitlistPosition } = classInfo;
  // Past the deadline: no cancelling, and the waitlist is closed.
  const beforeDeadline = Date.now() < new Date(classInfo.cancelDeadline).getTime();

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
  // A refetch may reveal someone else took the bike we picked -- drop it.
  const selectedBikeId = bikesForGrid.some((b) => b.id === pickedBikeId && !b.taken) ? pickedBikeId : null;

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
          ) : myWaitlistEntryId ? (
            <View style={styles.fullBadge}>
              <Text style={styles.fullBadgeText}>En espera #{myWaitlistPosition}</Text>
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
          {!isFull && !(locked && !bookedBikeId) && (
            <BikeGrid
              bikes={bikesForGrid}
              selectedBikeId={selectedBikeId}
              bookedBikeId={bookedBikeId}
              onSelect={(bikeId) => !bookedBikeId && setPickedBikeId(bikeId)}
            />
          )}

          {myReservationId ? (
            <>
              <Text style={styles.note}>
                {beforeDeadline
                  ? `Puedes cancelar hasta el ${formatDeadline(classInfo.cancelDeadline)}.`
                  : 'Ya pasó el plazo para cancelar esta clase.'}
              </Text>
              {beforeDeadline && (
                <Pressable style={styles.cancelButton} disabled={busy} onPress={() => onCancel(classInfo.id, myReservationId)}>
                  {busy ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.cancelButtonText}>Cancelar reserva</Text>}
                </Pressable>
              )}
            </>
          ) : myWaitlistEntryId ? (
            <>
              <Text style={styles.note}>
                Estás #{myWaitlistPosition} en la lista de espera. Si se libera un cupo te reservamos automáticamente y se
                descuenta 1 crédito.
              </Text>
              <Pressable style={styles.cancelButton} disabled={busy} onPress={() => onLeaveWaitlist(classInfo.id, myWaitlistEntryId)}>
                {busy ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.cancelButtonText}>Salir de la lista</Text>}
              </Pressable>
            </>
          ) : locked ? (
            <View style={styles.lockedNote}>
              <Ionicons name="lock-closed" size={14} color={colors.inkSoft} />
              <Text style={styles.note}>Necesitas una membresía activa para reservar esta clase.</Text>
            </View>
          ) : isFull ? (
            beforeDeadline ? (
              <Pressable style={styles.bookButton} disabled={busy} onPress={() => onJoinWaitlist(classInfo.id)}>
                {busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.bookButtonText}>Unirme a la lista de espera</Text>}
              </Pressable>
            ) : (
              <Text style={styles.note}>Clase completa. La lista de espera ya cerró.</Text>
            )
          ) : (
            <>
              {!beforeDeadline && <Text style={styles.note}>Si reservas ahora ya no podrás cancelar.</Text>}
              <Pressable
                style={[styles.bookButton, !selectedBikeId && styles.bookButtonDisabled]}
                disabled={!selectedBikeId || busy}
                onPress={() => selectedBikeId && onBook(classInfo.id, selectedBikeId)}
              >
                {busy ? (
                  <ActivityIndicator color={colors.onAccent} />
                ) : (
                  <Text style={styles.bookButtonText}>
                    {selectedBikeId ? `Reservar ${classInfo.bikes.find((b) => b.id === selectedBikeId)?.label}` : 'Elige una bici'}
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardBooked: { borderWidth: 1, borderColor: colors.accent },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, gap: spacing.sm },
  title: { ...type.h2, color: colors.ink },
  meta: { ...type.caption, color: colors.inkSoft, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chevron: { marginLeft: 2 },
  availableBadge: { backgroundColor: colors.successSoft, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: spacing.sm },
  availableBadgeText: { color: colors.success, fontWeight: '700', fontSize: 12 },
  fullBadge: { backgroundColor: colors.dangerSoft, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: spacing.sm },
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
  note: { ...type.caption, color: colors.inkSoft },
  lockedNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bookButton: { backgroundColor: colors.accent, borderRadius: radius.pill, padding: spacing.md + 2, alignItems: 'center' },
  bookButtonDisabled: { opacity: 0.3 },
  bookButtonText: { color: colors.onAccent, fontWeight: '700' },
  cancelButton: { borderRadius: radius.pill, padding: spacing.md + 2, alignItems: 'center', borderWidth: 1, borderColor: colors.danger },
  cancelButtonText: { color: colors.danger, fontWeight: '600' },
});
