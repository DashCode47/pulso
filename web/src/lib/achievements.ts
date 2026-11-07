import { createClient } from '@/lib/supabase/client';

// Mirrors the checks on the `achievements` table
// (supabase/migrations/*configurable-achievements.sql).
export type AchievementRule =
  | 'classes_total'
  | 'classes_before_hour'
  | 'classes_from_hour'
  | 'classes_with_instructor'
  | 'distinct_instructors'
  | 'classes_on_weekday'
  | 'classes_in_week'
  | 'streak_weeks'
  | 'leaderboard_top';

export type AchievementIcon =
  | 'trophy' | 'medal' | 'bicycle' | 'fire' | 'flag' | 'lightning'
  | 'sun' | 'moon' | 'ranking' | 'users' | 'calendar' | 'clock';

export const ruleOptions: { value: AchievementRule; label: string; thresholdLabel: string }[] = [
  { value: 'classes_total', label: 'Completar clases', thresholdLabel: 'Cantidad de clases' },
  { value: 'classes_before_hour', label: 'Clases antes de una hora', thresholdLabel: 'Cantidad de clases' },
  { value: 'classes_from_hour', label: 'Clases desde una hora', thresholdLabel: 'Cantidad de clases' },
  { value: 'classes_with_instructor', label: 'Clases con un instructor', thresholdLabel: 'Cantidad de clases' },
  { value: 'distinct_instructors', label: 'Instructores distintos', thresholdLabel: 'Cantidad de instructores' },
  { value: 'classes_on_weekday', label: 'Clases en un día de la semana', thresholdLabel: 'Cantidad de clases' },
  { value: 'classes_in_week', label: 'Clases en una misma semana', thresholdLabel: 'Clases en la semana' },
  { value: 'streak_weeks', label: 'Racha (objetivo semanal cumplido)', thresholdLabel: 'Semanas seguidas' },
  { value: 'leaderboard_top', label: 'Entrar al Top del ranking', thresholdLabel: 'Top' },
];

export const iconOptions: { value: AchievementIcon; label: string }[] = [
  { value: 'trophy', label: 'Trofeo' },
  { value: 'medal', label: 'Medalla' },
  { value: 'bicycle', label: 'Bicicleta' },
  { value: 'fire', label: 'Fuego' },
  { value: 'flag', label: 'Bandera' },
  { value: 'lightning', label: 'Rayo' },
  { value: 'sun', label: 'Sol' },
  { value: 'moon', label: 'Luna' },
  { value: 'ranking', label: 'Ranking' },
  { value: 'users', label: 'Personas' },
  { value: 'calendar', label: 'Calendario' },
  { value: 'clock', label: 'Reloj' },
];

export const weekdayOptions = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
];

export function ruleNeedsHour(rule: AchievementRule) {
  return rule === 'classes_before_hour' || rule === 'classes_from_hour';
}

export type Achievement = {
  id: string;
  name: string;
  description: string;
  xpReward: number;
  icon: AchievementIcon;
  rule: AchievementRule;
  threshold: number;
  hour: number | null;
  instructorId: string | null;
  weekday: number | null;
  startsOn: string | null; // YYYY-MM-DD, Bogota; null = all time
  endsOn: string | null; // YYYY-MM-DD, Bogota; null = no end
  unlockCount: number; // > 0 = locked for editing
};

export type AchievementInput = Omit<Achievement, 'id' | 'unlockCount'>;

// Plain-language summary of a rule, also used as the default description.
export function describeRule(
  input: Pick<AchievementInput, 'rule' | 'threshold' | 'hour' | 'weekday'>,
  instructorName?: string,
) {
  const n = input.threshold;
  const classes = n === 1 ? '1 clase' : `${n} clases`;
  const hour = input.hour != null ? `${String(input.hour).padStart(2, '0')}:00` : '--:--';
  switch (input.rule) {
    case 'classes_total':
      return `Completa ${classes}`;
    case 'classes_before_hour':
      return `Completa ${classes} antes de las ${hour}`;
    case 'classes_from_hour':
      return `Completa ${classes} desde las ${hour}`;
    case 'classes_with_instructor':
      return `Completa ${classes} con ${instructorName ?? 'el instructor'}`;
    case 'distinct_instructors':
      return `Entrena con ${n} instructores distintos`;
    case 'classes_on_weekday': {
      const day = weekdayOptions.find((d) => d.value === input.weekday)?.label.toLowerCase() ?? 'un día';
      return `Completa ${classes} un ${day}`;
    }
    case 'classes_in_week':
      return `Completa ${classes} en una misma semana`;
    case 'streak_weeks':
      return `Cumple tu objetivo semanal ${n} ${n === 1 ? 'semana' : 'semanas seguidas'}`;
    case 'leaderboard_top':
      return `Entra al Top ${n} del ranking`;
  }
}

type Row = {
  id: string;
  name: string;
  description: string;
  xp_reward: number;
  icon: AchievementIcon;
  rule: AchievementRule;
  threshold: number;
  hour: number | null;
  instructor_id: string | null;
  weekday: number | null;
  starts_on: string | null;
  ends_on: string | null;
  user_achievements: { count: number }[];
};

function toRow(input: AchievementInput) {
  return {
    name: input.name,
    description: input.description,
    xp_reward: input.xpReward,
    icon: input.icon,
    rule: input.rule,
    threshold: input.threshold,
    hour: ruleNeedsHour(input.rule) ? input.hour : null,
    instructor_id: input.rule === 'classes_with_instructor' ? input.instructorId : null,
    weekday: input.rule === 'classes_on_weekday' ? input.weekday : null,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
  };
}

// Admins read every card (RLS); removed ones (deleted_at) are left out.
export async function listAchievements(): Promise<Achievement[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('achievements')
    .select('id, name, description, xp_reward, icon, rule, threshold, hour, instructor_id, weekday, starts_on, ends_on, user_achievements(count)')
    .is('deleted_at', null)
    .order('created_at');
  if (error) throw error;
  return (data as Row[]).map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    xpReward: a.xp_reward,
    icon: a.icon,
    rule: a.rule,
    threshold: a.threshold,
    hour: a.hour,
    instructorId: a.instructor_id,
    weekday: a.weekday,
    startsOn: a.starts_on,
    endsOn: a.ends_on,
    unlockCount: a.user_achievements[0]?.count ?? 0,
  }));
}

const errorMessages: Record<string, string> = {
  achievement_locked: 'Este logro ya fue desbloqueado por algún miembro y no se puede editar.',
  achievement_deleted: 'Este logro fue eliminado.',
};

function friendly(error: { message: string } | null) {
  return error ? { message: errorMessages[error.message] ?? error.message } : null;
}

export async function createAchievement(input: AchievementInput) {
  const supabase = createClient();
  const { error } = await supabase.from('achievements').insert(toRow(input));
  return { error: friendly(error) };
}

export async function updateAchievement(id: string, input: AchievementInput) {
  const supabase = createClient();
  const { error } = await supabase.from('achievements').update(toRow(input)).eq('id', id);
  return { error: friendly(error) };
}

// Soft delete: the card disappears for everyone, members keep the XP.
export async function removeAchievement(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('achievements').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  return { error: friendly(error) };
}
