-- supabase-alerts: Long Queries Watchdog
-- Alerts when any query has been running longer than 30 seconds.
-- Requires pg_net extension (available in Supabase by default).
--
-- Set up a cron job to call this function periodically:
--   select cron.schedule('alert-long-queries', '*/5 * * * *', 'select check_long_queries()');

create or replace function check_long_queries()
returns void
language plpgsql
security definer
as $$
declare
  v_count   int;
  v_details text;
begin
  select
    count(*),
    string_agg(
      format(
        'pid=%s, duration=%s, state=%s, query=%.200s',
        pid,
        now() - query_start,
        state,
        query
      ),
      E'\n'
    )
  into v_count, v_details
  from pg_stat_activity
  where
    state != 'idle'
    and query_start is not null
    and now() - query_start > interval '30 seconds'
    and query not ilike '%check_long_queries%';   -- exclude self

  if v_count > 0 then
    perform net.http_post(
      url     := current_setting('app.alert_webhook_url', true),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := json_build_object(
        'context',  'db/long-queries',
        'severity', 'warn',
        'meta', json_build_object(
          'count',   v_count,
          'details', v_details
        )
      )::text
    );
  end if;
end;
$$;
