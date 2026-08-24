// Datos de muestra para iterar la UI de reservas antes de conectar el
// backend real. La forma coincide con lo que vamos a traer de InsForge
// (classes + bikes + reservations) para que el swap después sea directo.
export interface MockBike {
  id: string;
  label: string;
  taken: boolean;
}

export interface MockClass {
  id: string;
  title: string;
  trainerName: string;
  startsAt: string; // "19:00"
  durationMinutes: number;
  bikes: MockBike[];
}

export interface MockDay {
  key: string;
  label: string;
  classes: MockClass[];
}

function bikes(takenCount: number, total = 10): MockBike[] {
  return Array.from({ length: total }, (_, i) => ({
    id: `bike-${i + 1}`,
    label: `Bike ${String(i + 1).padStart(2, '0')}`,
    taken: i < takenCount,
  }));
}

export const mockDays: MockDay[] = [
  {
    key: 'hoy',
    label: 'Hoy',
    classes: [
      { id: 'c1', title: 'HIIT', trainerName: 'Coach Dan', startsAt: '07:00', durationMinutes: 45, bikes: bikes(9) },
      { id: 'c2', title: 'Endurance', trainerName: 'Coach Mia', startsAt: '12:30', durationMinutes: 45, bikes: bikes(4) },
      { id: 'c3', title: 'Rhythm Ride', trainerName: 'Coach Dan', startsAt: '19:00', durationMinutes: 45, bikes: bikes(10) },
    ],
  },
  {
    key: 'manana',
    label: 'Mañana',
    classes: [
      { id: 'c4', title: 'HIIT', trainerName: 'Coach Mia', startsAt: '07:00', durationMinutes: 45, bikes: bikes(2) },
      { id: 'c5', title: 'Recovery Ride', trainerName: 'Coach Dan', startsAt: '18:00', durationMinutes: 30, bikes: bikes(6) },
    ],
  },
];
