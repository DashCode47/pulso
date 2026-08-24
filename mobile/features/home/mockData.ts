// Mock del resumen de Home (user_stats + próxima reservation + posición en
// leaderboard_weekly) para iterar la UI antes de conectar el backend real.
export const mockHomeSummary = {
  currentStreakWeeks: 7,
  weeklyXp: 850,
  leaderboardPosition: 4,
  weeklyGoal: 3,
  weeklyCompleted: 2,
  nextClass: {
    title: 'HIIT',
    dayLabel: 'Hoy',
    startsAt: '19:00',
    bikeLabel: 'Bike 12',
  } as null | { title: string; dayLabel: string; startsAt: string; bikeLabel: string },
};
