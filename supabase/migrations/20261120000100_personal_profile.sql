ALTER TABLE companion.profiles ADD COLUMN personal jsonb NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(personal) = 'object');
GRANT INSERT (personal), UPDATE (personal) ON companion.profiles TO wenshan_member;
