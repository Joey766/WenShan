CREATE TABLE companion.ai_user_usage (
  subject_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket text NOT NULL,
  used integer NOT NULL CHECK (used > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_id,bucket)
);
ALTER TABLE companion.ai_user_usage ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION companion.reserve_user_ai(
  subject uuid, minute_limit integer, day_limit integer, user_minute_limit integer, user_day_limit integer
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  minute_key text := 'm:' || floor(extract(epoch FROM statement_timestamp()) / 60)::text;
  day_key text := 'd:' || (statement_timestamp() AT TIME ZONE 'America/Los_Angeles')::date::text;
  global_result text;
BEGIN
  IF user_minute_limit < 1 OR user_day_limit < 1 THEN RETURN 'disabled'; END IF;
  IF NOT EXISTS (SELECT FROM auth.users WHERE id=subject AND email_confirmed_at IS NOT NULL) THEN RETURN 'identity'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(147207781,1);
  IF coalesce((SELECT used FROM companion.ai_user_usage WHERE subject_id=subject AND bucket=day_key),0) >= user_day_limit
    THEN RETURN 'user_day'; END IF;
  IF coalesce((SELECT used FROM companion.ai_user_usage WHERE subject_id=subject AND bucket=minute_key),0) >= user_minute_limit
    THEN RETURN 'user_minute'; END IF;
  global_result := companion.reserve_ai(minute_limit, day_limit);
  IF global_result <> 'ok' THEN RETURN global_result; END IF;
  DELETE FROM companion.ai_user_usage WHERE created_at < statement_timestamp() - interval '3 days';
  INSERT INTO companion.ai_user_usage AS budget(subject_id,bucket,used) VALUES (subject,minute_key,1),(subject,day_key,1)
    ON CONFLICT (subject_id,bucket) DO UPDATE SET used=budget.used+1;
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION companion.reserve_user_ai(uuid,integer,integer,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION companion.reserve_user_ai(uuid,integer,integer,integer,integer) TO wenshan_runtime;
