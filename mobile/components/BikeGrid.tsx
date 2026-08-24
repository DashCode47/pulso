import { View, Pressable, Text, StyleSheet } from 'react-native';
import type { MockBike } from '../features/bookings/mockData';

interface Props {
  bikes: MockBike[];
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  bikeTaken: { backgroundColor: '#eee', borderColor: '#eee' },
  bikeSelected: { borderColor: '#111', borderWidth: 2 },
  bikeBooked: { backgroundColor: '#111', borderColor: '#111' },
  bikeLabel: { fontSize: 12, fontWeight: '600', color: '#111' },
  bikeLabelTaken: { color: '#999' },
  bikeLabelBooked: { color: '#fff' },
});
