import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { mockDays } from '../../features/bookings/mockData';
import { ClassCard } from '../../components/ClassCard';
import { Screen } from '../../components/Screen';

export default function Bookings() {
  const [selectedDayKey, setSelectedDayKey] = useState(mockDays[0].key);
  // classId -> bikeId reservado. Solo estado local mientras trabajamos con mocks.
  const [myBookings, setMyBookings] = useState<Record<string, string>>({});

  const selectedDay = mockDays.find((d) => d.key === selectedDayKey)!;

  return (
    <Screen style={styles.container}>
      <Text style={styles.title}>Reservar</Text>

      <View style={styles.dayPills}>
        {mockDays.map((day) => (
          <Pressable
            key={day.key}
            onPress={() => setSelectedDayKey(day.key)}
            style={[styles.dayPill, day.key === selectedDayKey && styles.dayPillActive]}
          >
            <Text style={[styles.dayPillText, day.key === selectedDayKey && styles.dayPillTextActive]}>
              {day.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {selectedDay.classes.map((classInfo) => (
          <ClassCard
            key={classInfo.id}
            classInfo={classInfo}
            bookedBikeId={myBookings[classInfo.id] ?? null}
            onBook={(classId, bikeId) => setMyBookings((prev) => ({ ...prev, [classId]: bikeId }))}
            onCancel={(classId) =>
              setMyBookings((prev) => {
                const next = { ...prev };
                delete next[classId];
                return next;
              })
            }
          />
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 8 },
  title: { fontSize: 24, fontWeight: '700', paddingHorizontal: 24 },
  dayPills: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, marginTop: 16 },
  dayPill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#f0f0f0' },
  dayPillActive: { backgroundColor: '#111' },
  dayPillText: { fontWeight: '600', color: '#111' },
  dayPillTextActive: { color: '#fff' },
  list: { padding: 24, gap: 12 },
});
