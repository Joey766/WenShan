DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='wenshan_runtime') THEN
    CREATE ROLE wenshan_runtime NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
END $$;
GRANT wenshan_member TO wenshan_runtime;
GRANT USAGE ON SCHEMA companion TO wenshan_runtime;
REVOKE ALL ON SCHEMA companion FROM anon, authenticated;

CREATE TABLE companion.hosted_identities (
  subject_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id uuid UNIQUE NOT NULL REFERENCES companion.accounts(id) ON DELETE CASCADE
);
CREATE TABLE companion.profiles (
  owner_id uuid PRIMARY KEY REFERENCES companion.accounts(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '' CHECK (char_length(display_name) <= 32)
);
CREATE TABLE companion.inventory (
  owner_id uuid NOT NULL REFERENCES companion.pets(owner_id) ON DELETE CASCADE,
  item text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id,item)
);
ALTER TABLE companion.hosted_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE companion.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companion.profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY own_rows ON companion.profiles TO wenshan_member
  USING (owner_id::text=current_setting('wenshan.owner',true))
  WITH CHECK (owner_id::text=current_setting('wenshan.owner',true));
ALTER TABLE companion.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE companion.inventory FORCE ROW LEVEL SECURITY;
CREATE POLICY own_rows ON companion.inventory FOR SELECT TO wenshan_member
  USING (owner_id::text=current_setting('wenshan.owner',true));
GRANT SELECT, INSERT (owner_id,display_name), UPDATE (display_name) ON companion.profiles TO wenshan_member;
GRANT SELECT ON companion.inventory TO wenshan_member;

-- Only the trusted server may pass an Auth user ID verified with Supabase.
-- A mapped legacy owner keeps their existing primary key.
CREATE FUNCTION companion.hosted_owner(subject uuid) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result uuid;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(subject::text, 0));
  SELECT owner_id INTO result FROM companion.hosted_identities WHERE subject_id=subject;
  IF result IS NOT NULL THEN RETURN result; END IF;
  IF NOT EXISTS (SELECT FROM auth.users WHERE id=subject AND email_confirmed_at IS NOT NULL) THEN
    RETURN NULL;
  END IF;
  result := pg_catalog.gen_random_uuid();
  INSERT INTO companion.accounts(id,label,password_hash)
    VALUES (result,'hosted-' || result::text,'supabase-managed');
  INSERT INTO companion.hosted_identities(subject_id,owner_id) VALUES (subject,result);
  INSERT INTO companion.profiles(owner_id) VALUES (result);
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION companion.hosted_owner(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION companion.hosted_owner(uuid) TO wenshan_runtime;

CREATE FUNCTION companion.remove_hosted_data() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM companion.accounts
    WHERE id=(SELECT owner_id FROM companion.hosted_identities WHERE subject_id=OLD.id);
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION companion.remove_hosted_data() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER wenshan_remove_hosted_data BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION companion.remove_hosted_data();

CREATE FUNCTION companion.sync_unlocked_items() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO companion.inventory(owner_id,item)
    SELECT NEW.owner_id,item
    FROM (VALUES ('shared_rolling_ball',0),('shared_soft_cushion',0),
      ('form:normal',0),('form:slightly_plump',60),('form:extra_cuddly',180),
      ('decoration_star_mobiles',180),('decoration_moon_lamp',180),
      (CASE NEW.pet WHEN 'xiaogua' THEN 'xiaogua_coin_toy'
        WHEN 'yunyao' THEN 'yunyao_cloud_ball' WHEN 'qingpu' THEN 'qingpu_dew_ball'
        WHEN 'xuanji' THEN 'xuanji_orbit_ball' END,60),
      (CASE NEW.pet WHEN 'xiaogua' THEN 'decoration_wind_chime'
        WHEN 'yunyao' THEN 'decoration_cloud_mobile' WHEN 'qingpu' THEN 'decoration_blossom'
        WHEN 'xuanji' THEN 'decoration_star_mobiles' END,
        CASE WHEN NEW.pet='xuanji' THEN 180 ELSE 60 END))
      AS catalog(item,min_xp) WHERE NEW.xp>=min_xp
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION companion.sync_unlocked_items() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER wenshan_inventory AFTER INSERT OR UPDATE OF xp ON companion.pets
  FOR EACH ROW EXECUTE FUNCTION companion.sync_unlocked_items();
-- Backfill existing pets without changing their experience or choices.
UPDATE companion.pets SET xp=xp;
