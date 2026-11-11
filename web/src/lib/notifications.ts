import { createClient } from '@/lib/supabase/client';

// Inserts into `notifications` with sent_at null -- same row shape every
// automatic notification already uses. The send-pending-notifications cron
// (every minute) delivers it; no separate dispatch path here.
// Audience: userId = one member, classId = everyone booked in that class,
// neither = every member with an active membership.
export async function sendNotification(input: { title: string; body: string; userId?: string | null; classId?: string | null }) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('admin_send_notification', {
    p_title: input.title,
    p_body: input.body,
    p_user_id: input.userId ?? null,
    p_class_id: input.classId ?? null,
  });
  return { count: data as number | null, error };
}

export type SentNotification = {
  sentAt: string;
  title: string;
  body: string;
  audience: 'all' | 'member' | 'class';
  recipients: number;
  recipientName: string | null;
  classTitle: string | null;
  classStartsAt: string | null;
};

export async function listNotificationHistory(limit = 30): Promise<SentNotification[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('admin_notification_history', { p_limit: limit });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    sentAt: r.sent_at as string,
    title: r.title as string,
    body: r.body as string,
    audience: r.audience as SentNotification['audience'],
    recipients: r.recipients as number,
    recipientName: (r.recipient_name as string | null) ?? null,
    classTitle: (r.class_title as string | null) ?? null,
    classStartsAt: (r.class_starts_at as string | null) ?? null,
  }));
}
