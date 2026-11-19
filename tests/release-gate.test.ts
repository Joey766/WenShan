import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("Vercel allows previews and blocks every unapproved production build", () => {
  function check(deployment: string, branch: string, approved = "", ignore = false) {
    return spawnSync(process.execPath, ["scripts/vercel-release-gate.mjs", ...(ignore ? ["--ignore"] : [])], {
      env: { ...process.env, VERCEL_ENV: deployment, VERCEL_GIT_COMMIT_REF: branch, WENSHAN_ALLOW_PRODUCTION: approved },
      stdio: "ignore",
    }).status;
  }
  assert.equal(check("preview", "dev/launch-readiness"), 0);
  assert.equal(check("preview", "dev/launch-readiness", "", true), 1);
  assert.equal(check("production", "dev/launch-readiness", "true"), 1);
  assert.equal(check("production", "main", "", true), 0);
  assert.equal(check("production", "main", "false"), 1);
  assert.equal(check("", "main", "true"), 1);
  assert.equal(check("production", "main", "true"), 0);
});
