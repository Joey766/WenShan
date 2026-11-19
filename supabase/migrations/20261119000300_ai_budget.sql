CREATE TABLE companion.ai_usage (
  bucket text PRIMARY KEY,
  used integer NOT NULL CHECK (used > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE companion.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION companion.reserve_ai(minute_limit integer, day_limit integer) RETURNS text
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  minute_key text := 'm:' || floor(extract(epoch FROM statement_timestamp()) / 60)::text;
  day_key text := 'd:' || (statement_timestamp() AT TIME ZONE 'America/Los_Angeles')::date::text;
BEGIN
  IF minute_limit < 1 OR day_limit < 1 THEN RETURN 'disabled'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(147207781,1);
  IF coalesce((SELECT used FROM companion.ai_usage WHERE bucket=day_key),0) >= day_limit THEN RETURN 'day'; END IF;
  IF coalesce((SELECT used FROM companion.ai_usage WHERE bucket=minute_key),0) >= minute_limit THEN RETURN 'minute'; END IF;
  DELETE FROM companion.ai_usage WHERE created_at < statement_timestamp() - interval '3 days';
  INSERT INTO companion.ai_usage AS budget(bucket,used) VALUES (minute_key,1),(day_key,1)
    ON CONFLICT (bucket) DO UPDATE SET used=budget.used+1;
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION companion.reserve_ai(integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION companion.reserve_ai(integer,integer) TO wenshan_runtime;
