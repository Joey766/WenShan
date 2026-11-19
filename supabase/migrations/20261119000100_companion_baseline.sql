CREATE SCHEMA IF NOT EXISTS companion;
REVOKE ALL ON SCHEMA companion FROM PUBLIC;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wenshan_member') THEN
    CREATE ROLE wenshan_member NOLOGIN NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA companion TO wenshan_member;
CREATE TABLE IF NOT EXISTS companion.accounts (
  id uuid PRIMARY KEY, label text UNIQUE NOT NULL, password_hash text NOT NULL
);
CREATE TABLE IF NOT EXISTS companion.sessions (
  token_hash text PRIMARY KEY, owner_id uuid NOT NULL REFERENCES companion.accounts(id) ON DELETE CASCADE, expires bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS companion.pets (
  owner_id uuid PRIMARY KEY REFERENCES companion.accounts(id) ON DELETE CASCADE,
  pet text NOT NULL CHECK (pet IN ('xiaogua','yunyao','qingpu','xuanji')),
  bound_at bigint NOT NULL, xp integer NOT NULL DEFAULT 0 CHECK (xp >= 0),
  shape text NOT NULL DEFAULT 'normal' CHECK (shape IN ('normal','slightly_plump','extra_cuddly')),
  decoration text
);
CREATE TABLE IF NOT EXISTS companion.events (
  owner_id uuid NOT NULL REFERENCES companion.pets(owner_id) ON DELETE CASCADE,
  event_id text NOT NULL, kind text NOT NULL CHECK (kind IN ('visit','cast','touch')),
  day date NOT NULL, event_at bigint NOT NULL, xp integer NOT NULL CHECK (xp IN (2,5,10)),
  PRIMARY KEY (owner_id,event_id)
);
CREATE INDEX IF NOT EXISTS companion_events_day ON companion.events(owner_id,day,kind);
CREATE TABLE IF NOT EXISTS companion.casts (
  owner_id uuid NOT NULL REFERENCES companion.pets(owner_id) ON DELETE CASCADE,
  cast_id uuid NOT NULL, question text NOT NULL,
  coins jsonb NOT NULL DEFAULT '[]', started_at bigint NOT NULL, PRIMARY KEY (owner_id,cast_id)
);
CREATE TABLE IF NOT EXISTS companion.history (
  owner_id uuid NOT NULL REFERENCES companion.accounts(id) ON DELETE CASCADE,
  entry_id text NOT NULL, created_at bigint NOT NULL, record jsonb NOT NULL,
  PRIMARY KEY (owner_id,entry_id)
);
CREATE TABLE IF NOT EXISTS companion.identity_links (
  provider text NOT NULL, provider_subject text NOT NULL,
  owner_id uuid NOT NULL REFERENCES companion.accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (provider,provider_subject)
);
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['sessions','pets','events','casts','history','identity_links'] LOOP
    EXECUTE 'ALTER TABLE companion.' || quote_ident(table_name) || ' ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE companion.' || quote_ident(table_name) || ' FORCE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='companion' AND tablename=table_name AND policyname='own_rows') THEN
      EXECUTE format('CREATE POLICY own_rows ON companion.%I TO wenshan_member USING
        (owner_id::text=current_setting(''wenshan.owner'',true)) WITH CHECK
        (owner_id::text=current_setting(''wenshan.owner'',true))',table_name);
    END IF;
  END LOOP;
END $$;
ALTER TABLE companion.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE companion.accounts FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='companion' AND tablename='accounts' AND policyname='own_account') THEN
    CREATE POLICY own_account ON companion.accounts FOR SELECT TO wenshan_member
      USING (id::text=current_setting('wenshan.owner',true));
  END IF;
END $$;
GRANT SELECT (id,label) ON companion.accounts TO wenshan_member;
      GRANT SELECT, INSERT (owner_id,pet,bound_at), UPDATE (xp,shape,decoration) ON companion.pets TO wenshan_member;
      GRANT SELECT, INSERT ON companion.events TO wenshan_member;
      GRANT SELECT, INSERT, UPDATE (coins), DELETE ON companion.casts TO wenshan_member;
      GRANT SELECT, INSERT, UPDATE, DELETE ON companion.history TO wenshan_member;
