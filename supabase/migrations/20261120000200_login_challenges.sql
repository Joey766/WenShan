CREATE TABLE companion.login_challenges (
  subject uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nonce_hash text UNIQUE NOT NULL,
  address_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5)
);
CREATE INDEX login_challenges_expiry ON companion.login_challenges (expires_at);
ALTER TABLE companion.login_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_login_challenges ON companion.login_challenges TO wenshan_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON companion.login_challenges TO wenshan_runtime;
