import { createClient } from '@/lib/supabase/client';

// Inserts into `notifications` with sent_at null -- same row shape every
// automatic notification already uses. The send-pending-notifications cron
// (every minute) delivers it; no separate dispatch path here.
export async function sendNotification(input: { title: string; body: string; userId: string | null }) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('admin_send_notification', {
    p_title: input.title,
    p_body: input.body,
    p_user_id: input.userId,
  });
  return { count: data as number | null, error };
}
