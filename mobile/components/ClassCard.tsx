import { useState, type ReactNode } from 'react';
import { View, Text, Pressable, ActivityIndicator, LayoutAnimation, StyleSheet, type ViewStyle } from 'react-native';
import { CaretDownIcon, CaretUpIcon, CheckIcon, ClockIcon, HourglassIcon, LockIcon, UserIcon, UsersThreeIcon, WarningCircleIcon, XCircleIcon, type Icon } from './icons';
import type { ClassWithBikes } from '../features/bookings/useBookings';
import { BikeGrid } from './BikeGrid';
import { colors, radius, spacing, type, themed } from '../theme';

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
  const occupancy = classInfo.capacity ? Math.min(1, classInfo.bookedCount / classInfo.capacity) : 1;

  // Once the class capacity (not the physical bike count) is the limiting
  // factor, grey out the extra free bikes too -- picking one would just get
  // rejected by book_class()'s capacity check.
  const capacityReached = !bookedBikeId && spotsLeft <= 0;
  const bikesForGrid = capacityReached
    ? classInfo.bikes.map((b) => (b.taken ? b : { ...b, taken: true }))
    : classInfo.bikes;
  // A refetch may reveal someone else took the bike we picked -- drop it.
  const selectedBikeId = bikesForGrid.some((b) => b.id === pickedBikeId && !b.taken) ? pickedBikeId : null;
  const showGrid = !isFull && !(locked && !bookedBikeId);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((e) => !e);
  };

  return (
    <View style={[styles.card, !!bookedBikeId && styles.cardBooked]}>
      <Pressable onPress={toggle} style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}>
        <View style={styles.timeCol}>
          <Text style={styles.time}>
            {new Date(classInfo.startsAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <Text style={styles.duration}>{classInfo.durationMinutes} min</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {classInfo.title}
            </Text>
            {bookedBikeId ? (
              <View style={[styles.badge, styles.badgeBooked]}>
                <CheckIcon size={12} color={colors.onAccent} weight="bold" />
                <Text style={[styles.badgeText, { color: colors.onAccent }]}>Reservado</Text>
              </View>
            ) : myWaitlistEntryId ? (
              <View style={[styles.badge, styles.badgeOutline]}>
                <Text style={[styles.badgeText, { color: colors.ink }]}>En espera #{myWaitlistPosition}</Text>
              </View>
            ) : isFull ? (
              <View style={[styles.badge, { backgroundColor: colors.dangerSoft }]}>
                <Text style={[styles.badgeText, { color: colors.danger }]}>Completa</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.instructorRow}>
            <UserIcon size={12} color={colors.inkMuted} />
            <Text style={styles.instructor} numberOfLines={1}>
              {classInfo.instructorName}
            </Text>
          </View>

          <View style={styles.capacityRow}>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${occupancy * 100}%` }, isFull && styles.fillFull]} />
            </View>
            <Text style={styles.capacityText}>
              {isFull ? 'Sin cupos' : `${availableCount} ${availableCount === 1 ? 'libre' : 'libres'}`}
            </Text>
            {expanded ? <CaretUpIcon size={16} color={colors.inkMuted} weight="bold" /> : <CaretDownIcon size={16} color={colors.inkMuted} weight="bold" />}
          </View>
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          {showGrid && (
            <>
              <View style={styles.legend}>
                <LegendItem swatch={styles.swatchFree} label="Libre" />
                <LegendItem swatch={styles.swatchTaken} label="Ocupada" />
                <LegendItem swatch={styles.swatchMine} label={bookedBikeId ? 'Tuya' : 'Elegida'} />
              </View>
              <BikeGrid
                bikes={bikesForGrid}
                selectedBikeId={selectedBikeId}
                bookedBikeId={bookedBikeId}
                onSelect={(bikeId) => !bookedBikeId && setPickedBikeId(bikeId)}
              />
            </>
          )}

          {myReservationId ? (
            <>
              <Note icon={beforeDeadline ? ClockIcon : WarningCircleIcon}>
                {beforeDeadline
                  ? `Puedes cancelar hasta el ${formatDeadline(classInfo.cancelDeadline)}.`
                  : 'Ya pasó el plazo para cancelar esta clase.'}
              </Note>
              {beforeDeadline && (
                <Pressable
                  style={({ pressed }) => [styles.button, styles.buttonGhost, pressed && styles.pressed]}
                  disabled={busy}
                  onPress={() => onCancel(classInfo.id, myReservationId)}
                >
                  {busy ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.buttonGhostText}>Cancelar reserva</Text>}
                </Pressable>
              )}
            </>
          ) : myWaitlistEntryId ? (
            <>
              <Note icon={HourglassIcon}>
                Estás #{myWaitlistPosition} en la lista de espera. Si se libera un cupo te reservamos automáticamente y se
                descuenta 1 crédito.
              </Note>
              <Pressable
                style={({ pressed }) => [styles.button, styles.buttonGhost, pressed && styles.pressed]}
                disabled={busy}
                onPress={() => onLeaveWaitlist(classInfo.id, myWaitlistEntryId)}
              >
                {busy ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.buttonGhostText}>Salir de la lista</Text>}
              </Pressable>
            </>
          ) : locked ? (
            <Note icon={LockIcon}>Necesitas una membresía activa para reservar esta clase.</Note>
          ) : isFull ? (
            beforeDeadline ? (
              <>
                <Note icon={UsersThreeIcon}>Clase completa. Únete a la lista y te reservamos si se libera un cupo.</Note>
                <Pressable
                  style={({ pressed }) => [styles.button, pressed && styles.pressed]}
                  disabled={busy}
                  onPress={() => onJoinWaitlist(classInfo.id)}
                >
                  {busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.buttonText}>Unirme a la lista de espera</Text>}
                </Pressable>
              </>
            ) : (
              <Note icon={XCircleIcon}>Clase completa. La lista de espera ya cerró.</Note>
            )
          ) : (
            <>
              {!beforeDeadline && <Note icon={WarningCircleIcon}>Si reservas ahora ya no podrás cancelar.</Note>}
              <Pressable
                style={({ pressed }) => [styles.button, !selectedBikeId && styles.buttonDisabled, pressed && styles.pressed]}
                disabled={!selectedBikeId || busy}
                onPress={() => selectedBikeId && onBook(classInfo.id, selectedBikeId)}
              >
                {busy ? (
                  <ActivityIndicator color={colors.onAccent} />
                ) : (
                  <Text style={[styles.buttonText, !selectedBikeId && styles.buttonTextDisabled]}>
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

function Note({ icon: I, children }: { icon: Icon; children: ReactNode }) {
  return (
    <View style={styles.note}>
      <I size={14} color={colors.inkSoft} style={{ marginTop: 2 }} />
      <Text style={styles.noteText}>{children}</Text>
    </View>
  );
}

function LegendItem({ swatch, label }: { swatch: ViewStyle; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, swatch]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardBooked: { borderWidth: 1, borderColor: colors.accent },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.lg },
  headerPressed: { backgroundColor: colors.surfaceAlt },

  timeCol: { width: 52 },
  time: { fontSize: 17, fontWeight: '800', letterSpacing: -0.4, color: colors.ink, fontVariant: ['tabular-nums'] },
  duration: { ...type.caption, color: colors.inkMuted, marginTop: 2 },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.border },

  info: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...type.h2, color: colors.ink, flexShrink: 1, marginRight: 'auto' },
  instructorRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  instructor: { ...type.caption, color: colors.inkSoft, flexShrink: 1 },

  capacityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  track: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.inkSoft, borderRadius: 2 },
  fillFull: { backgroundColor: colors.danger },
  capacityText: { ...type.caption, color: colors.inkSoft, fontVariant: ['tabular-nums'] },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
  },
  badgeBooked: { backgroundColor: colors.accent },
  badgeOutline: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.inkSoft },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },

  body: {
    padding: spacing.lg,
    gap: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  legend: { flexDirection: 'row', gap: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { ...type.caption, color: colors.inkMuted },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  swatchFree: { borderWidth: 1, borderColor: colors.inkMuted },
  swatchTaken: { backgroundColor: colors.surfaceAlt },
  swatchMine: { backgroundColor: colors.accent },

  note: { flexDirection: 'row', gap: spacing.sm },
  noteText: { ...type.caption, lineHeight: 18, color: colors.inkSoft, flex: 1 },

  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { backgroundColor: colors.surfaceAlt },
  buttonText: { color: colors.onAccent, fontWeight: '700', fontSize: 15 },
  buttonTextDisabled: { color: colors.inkMuted },
  buttonGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.dangerSoft },
  buttonGhostText: { color: colors.danger, fontWeight: '600', fontSize: 15 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
}));
