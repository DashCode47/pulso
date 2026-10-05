import { View, Pressable, Text, StyleSheet } from 'react-native';
import { XIcon } from './icons';
import type { Bike } from '../features/bookings/useBookings';
import { colors, radius, themed } from '../theme';

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
        const filled = isBooked || isSelected;

        return (
          <Pressable
            key={bike.id}
            disabled={isDisabled}
            onPress={() => onSelect(bike.id)}
            accessibilityLabel={`Bici ${bike.label}${isDisabled ? ', ocupada' : ''}`}
            style={({ pressed }) => [
              styles.bike,
              isDisabled && styles.bikeTaken,
              filled && styles.bikeFilled,
              pressed && styles.pressed,
            ]}
          >
            {isDisabled ? (
              <XIcon size={14} color={colors.locked} weight="bold" />
            ) : (
              <Text style={[styles.bikeLabel, filled && styles.bikeLabelFilled]}>{bike.label}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bike: {
    width: 52,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.inkMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bikeTaken: { backgroundColor: colors.surfaceAlt, borderColor: colors.surfaceAlt },
  bikeFilled: { backgroundColor: colors.accent, borderColor: colors.accent },
  bikeLabel: { fontSize: 13, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  bikeLabelFilled: { color: colors.onAccent },
  pressed: { transform: [{ scale: 0.94 }] },
}));
