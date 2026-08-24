// Mock de user_stats + achievements/user_achievements reales (ver
// migrations/20260823234820_core-schema.sql) para iterar la UI de Progress.
export const mockProgress = {
  level: 14,
  totalXp: 8450,
  currentStreakWeeks: 7,
  maxStreakWeeks: 9,
  classesCompleted: 42,
  weeklyGoal: 3,
  weeklyCompleted: 2,
  leaderboardPosition: 4,
};

// xp_to_level() real es 500 XP por nivel (migrations/.../business-logic.sql)
export const XP_PER_LEVEL = 500;

export interface MockAchievement {
  code: string;
  name: string;
  description: string;
  unlocked: boolean;
}

export const mockAchievements: MockAchievement[] = [
  { code: 'first_ride', name: 'First Ride', description: 'Completa tu primera clase', unlocked: true },
  { code: 'ten_rides', name: '10 Rides', description: 'Completa 10 clases', unlocked: true },
  { code: 'fifty_rides', name: '50 Rides', description: 'Completa 50 clases', unlocked: false },
  { code: 'on_fire', name: 'On Fire', description: 'Mantén 7 semanas de racha', unlocked: true },
  { code: 'consistent', name: 'Consistent', description: 'Cumple tu objetivo semanal 4 semanas seguidas', unlocked: true },
  { code: 'top_3', name: 'Top 3', description: 'Termina una temporada en el Top 3', unlocked: false },
  { code: 'early_bird', name: 'Early Bird', description: 'Completa 5 clases antes de las 09:00', unlocked: false },
  { code: 'night_rider', name: 'Night Rider', description: 'Completa 5 clases después de las 19:00', unlocked: true },
];
