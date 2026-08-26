import { View, Pressable, Text, StyleSheet } from 'react-native';
import type { Bike } from '../features/bookings/useBookings';
import { colors, radius } from '../theme';

interface Props {
  bikes: Bike[];
  selectedBikeId: string | null;
  bookedBikeId: string | null;
  onSelect: (bikeId: string) => void;
}

export function BikeGrid({ bikes, selectedBikeId, bookedBikeId, onSelect }: Props) {
  return (
    <View style={styles.grid}>
      {bikes.map((bike) => {
        const isBooked = bike.id === bookedBikeId;
        const isSelected = bike.id === selectedBikeId;
        const isDisabled = bike.taken && !isBooked;

        return (
          <Pressable
            key={bike.id}
            disabled={isDisabled}
            onPress={() => onSelect(bike.id)}
            style={[
              styles.bike,
              isDisabled && styles.bikeTaken,
              isSelected && styles.bikeSelected,
              isBooked && styles.bikeBooked,
            ]}
          >
            <Text style={[styles.bikeLabel, isDisabled && styles.bikeLabelTaken, isBooked && styles.bikeLabelBooked]}>
              {bike.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bike: {
    width: 64,
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  bikeTaken: { backgroundColor: colors.surfaceAlt, borderColor: colors.surfaceAlt },
  bikeSelected: { borderColor: colors.accent, borderWidth: 2, backgroundColor: colors.accentSoft },
  bikeBooked: { backgroundColor: colors.accent, borderColor: colors.accent },
  bikeLabel: { fontSize: 12, fontWeight: '600', color: colors.ink },
  bikeLabelTaken: { color: colors.locked },
  bikeLabelBooked: { color: colors.onAccent },
});
