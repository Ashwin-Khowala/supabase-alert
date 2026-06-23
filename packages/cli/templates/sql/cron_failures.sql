-- supabase-alerts: Cron Failures Watchdog
-- Alerts when any pg_cron job has failed in the last check interval.
-- Requires pg_cron extension (enabled by default on Supabase).
--
-- Schedule this check itself:
--   select cron.schedule('alert-cron-failures', '*/10 * * * *', 'select check_cron_failures()');

create or replace function check_cron_failures()
returns void
language plpgsql
security definer
as $$
declare
  v_failures jsonb;
  v_count    int;
begin
  select
    count(*),
    jsonb_agg(
      jsonb_build_object(
        'jobid',      jrd.jobid,
        'jobname',    j.jobname,
        'status',     jrd.status,
        'return_msg', jrd.return_message,
        'started_at', jrd.start_time
      )
    )
  into v_count, v_failures
  from cron.job_run_details jrd
  join cron.job j on j.jobid = jrd.jobid
  where
    jrd.status = 'failed'
    and jrd.start_time > now() - interval '15 minutes';

  if v_count > 0 then
    perform net.http_post(
      url     := current_setting('app.alert_webhook_url', true),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := json_build_object(
        'context',  'db/cron-failures',
        'severity', 'error',
        'meta', json_build_object(
          'failed_count', v_count,
          'failures',     v_failures
        )
      )::text
    );
  end if;
end;
$$;
