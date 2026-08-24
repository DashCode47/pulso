// Mock del leaderboard_weekly / leaderboard_monthly reales (ver
// migrations/20260823234824_access-control.sql) -- misma forma: user_id,
// full_name, xp. "isMe" es solo para resaltar la fila propia en la UI mock.
export interface LeaderboardEntry {
  userId: string;
  name: string;
  xp: number;
  isMe?: boolean;
}

export const mockWeeklyLeaderboard: LeaderboardEntry[] = [
  { userId: '1', name: 'David', xp: 850 },
  { userId: '2', name: 'Carlos', xp: 800 },
  { userId: '3', name: 'Ana', xp: 750 },
  { userId: '4', name: 'Sofía', xp: 620 },
  { userId: 'me', name: 'Tú', xp: 540, isMe: true },
  { userId: '5', name: 'Luis', xp: 480 },
  { userId: '6', name: 'Valentina', xp: 410 },
];

export const mockMonthlyLeaderboard: LeaderboardEntry[] = [
  { userId: '2', name: 'Carlos', xp: 3200 },
  { userId: '1', name: 'David', xp: 3050 },
  { userId: '4', name: 'Sofía', xp: 2680 },
  { userId: 'me', name: 'Tú', xp: 2410, isMe: true },
  { userId: '3', name: 'Ana', xp: 2200 },
  { userId: '5', name: 'Luis', xp: 1890 },
  { userId: '6', name: 'Valentina', xp: 1540 },
];
