// Mock de memberships + credit_transactions + reservations (historial) para
// iterar la UI de Profile antes de conectar el backend real.
export const mockMembership = {
  planName: 'Standard',
  creditsBalance: 6,
  creditsPerCycle: 10,
  renewsOn: '1 de septiembre',
};

export type HistoryStatus = 'attended' | 'cancelled' | 'no_show';

export interface HistoryEntry {
  id: string;
  title: string;
  date: string;
  status: HistoryStatus;
}

export const mockHistory: HistoryEntry[] = [
  { id: '1', title: 'HIIT', date: 'Ayer · 19:00', status: 'attended' },
  { id: '2', title: 'Endurance', date: 'Hace 3 días · 12:30', status: 'attended' },
  { id: '3', title: 'Rhythm Ride', date: 'Hace 5 días · 07:00', status: 'cancelled' },
  { id: '4', title: 'HIIT', date: 'Hace 1 semana · 19:00', status: 'no_show' },
];

export const historyStatusLabel: Record<HistoryStatus, string> = {
  attended: 'Asististe',
  cancelled: 'Cancelada',
  no_show: 'No-show',
};
