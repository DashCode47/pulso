// Runs one of the housekeeping jobs defined in run_scheduled_job() (see
// migrations/20260823234828_business-logic.sql). InsForge schedules hit an
// HTTP endpoint on a cron cadence rather than running SQL directly, so this
// is the single thin wrapper all five schedules point at, distinguished by
// the "job" field in the request body.
//
// Protected by a shared secret (CRON_SECRET) instead of a user token: these
// jobs have no per-user context, and the endpoint URL is otherwise public.
import { createAdminClient } from 'npm:@insforge/sdk';

export default async function (req: Request): Promise<Response> {
  if (req.headers.get('Authorization') !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { job } = await req.json();

  const client = createAdminClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    apiKey: Deno.env.get('API_KEY'),
  });

  const { error } = await client.database.rpc('run_scheduled_job', { p_job_name: job });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify({ ok: true, job }), { status: 200 });
}
