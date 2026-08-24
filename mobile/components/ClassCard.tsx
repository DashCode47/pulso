import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { MockClass } from '../features/bookings/mockData';
import { BikeGrid } from './BikeGrid';

interface Props {
  classInfo: MockClass;
  bookedBikeId: string | null;
  onBook: (classId: string, bikeId: string) => void;
  onCancel: (classId: string) => void;
}

export function ClassCard({ classInfo, bookedBikeId, onBook, onCancel }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selectedBikeId, setSelectedBikeId] = useState<string | null>(null);

  const availableCount = classInfo.bikes.filter((b) => !b.taken || b.id === bookedBikeId).length;
  const isFull = availableCount === 0 && !bookedBikeId;

  return (
    <View style={styles.card}>
      <Pressable onPress={() => setExpanded((e) => !e)} style={styles.header}>
        <View>
          <Text style={styles.title}>{classInfo.title}</Text>
          <Text style={styles.meta}>
            {classInfo.startsAt} · {classInfo.durationMinutes} min · {classInfo.trainerName}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {bookedBikeId ? (
            <Text style={styles.bookedBadge}>Reservado</Text>
          ) : (
            <Text style={isFull ? styles.fullBadge : styles.availableBadge}>
              {isFull ? 'Completa' : `${availableCount} libres`}
            </Text>
          )}
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          <BikeGrid
            bikes={classInfo.bikes}
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
  card: { borderRadius: 12, backgroundColor: '#f5f5f5', overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  meta: { fontSize: 13, color: '#666', marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  availableBadge: { color: '#0a7d32', fontWeight: '600' },
  fullBadge: { color: '#c00', fontWeight: '600' },
  bookedBadge: { color: '#111', fontWeight: '700' },
  body: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  bookButton: { backgroundColor: '#111', borderRadius: 8, padding: 12, alignItems: 'center' },
  bookButtonDisabled: { backgroundColor: '#ccc' },
  bookButtonText: { color: '#fff', fontWeight: '600' },
  cancelButton: { borderRadius: 8, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#c00' },
  cancelButtonText: { color: '#c00', fontWeight: '600' },
});
