-- supabase-alerts: Connections Watchdog
-- Alerts when the number of active connections exceeds the threshold.
-- Supabase free tier limit is typically 60 direct connections.
--
-- Set up a cron job:
--   select cron.schedule('alert-connections', '*/5 * * * *', 'select check_connections()');

create or replace function check_connections()
returns void
language plpgsql
security definer
as $$
declare
  v_total     int;
  v_active    int;
  v_idle      int;
  v_max       int;
  v_threshold int := 80;  -- alert at 80% capacity, adjust as needed
begin
  select
    count(*)                                           as total,
    count(*) filter (where state = 'active')           as active,
    count(*) filter (where state = 'idle')             as idle,
    (select setting::int from pg_settings where name = 'max_connections') as max_conn
  into v_total, v_active, v_idle, v_max
  from pg_stat_activity;

  -- Alert if usage >= threshold %
  if v_total * 100 / v_max >= v_threshold then
    perform net.http_post(
      url     := current_setting('app.alert_webhook_url', true),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := json_build_object(
        'context',  'db/connections',
        'severity', case
          when v_total * 100 / v_max >= 95 then 'critical'
          when v_total * 100 / v_max >= 80 then 'warn'
          else 'info'
        end,
        'meta', json_build_object(
          'total',      v_total,
          'active',     v_active,
          'idle',       v_idle,
          'max',        v_max,
          'usage_pct',  (v_total * 100 / v_max)::text || '%'
        )
      )::text
    );
  end if;
end;
$$;
