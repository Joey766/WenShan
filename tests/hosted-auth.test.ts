import { strict as assert } from "node:assert";
import test from "node:test";
import { hostedCompleteReset, hostedDelete, hostedIdentity, hostedRequestReset, hostedSendEmailCode, hostedSignIn,
  hostedVerifyEmailCode } from "../src/lib/server/hosted-accounts.ts";

test("Supabase adapter verifies token with Auth and accepts only verified account sessions", async context => {
  const environment = { SUPABASE_URL: "https://auth-example.invalid", SUPABASE_PUBLISHABLE_KEY: "test-publishable-key" };
  const prior = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]));
  Object.assign(process.env, environment);
  const calls: string[] = [];
  const user = { id: "a903f637-48c7-4d5d-90b3-b4bda683845b", email: "north@example.invalid", email_confirmed_at: "2026-11-19T00:00:00Z" };
  function answer(body: unknown, status = 200) {
    return Response.json(body, { status });
  }
  context.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    const path = new URL(url).pathname;
    calls.push(path);
    assert.equal(new Headers(options.headers).get("apikey"), environment.SUPABASE_PUBLISHABLE_KEY);
    if (path.endsWith("/signup")) return answer({ user: { ...user, email_confirmed_at: null } });
    if (path.endsWith("/verify")) {
      const request = JSON.parse(String(options.body));
      if (request.type === "recovery") {
        if (request.token !== "650130") return answer({ code: "otp_expired", msg: "Expired" }, 403);
        return answer({ user, access_token: "recovery-access", refresh_token: "recovery-refresh", expires_in: 3600, token_type: "bearer" });
      }
      assert.equal(request.type, "email");
      assert.equal(request.token, "543210");
      return answer({ user, access_token: "test-access", refresh_token: "test-refresh", expires_in: 3600, token_type: "bearer" });
    }
    if (path.endsWith("/token") && new URL(url).searchParams.get("grant_type") === "refresh_token") {
      assert.equal(JSON.parse(String(options.body)).refresh_token, "test-refresh");
      return answer({ user, access_token: "renewed-access", refresh_token: "renewed-refresh", expires_in: 3600, token_type: "bearer" });
    }
    if (path.endsWith("/user")) {
      if (options.method === "PUT") {
        assert.equal(new Headers(options.headers).get("authorization"), "Bearer recovery-access");
        assert.equal(JSON.parse(String(options.body)).password, "Synthetic-New-Password");
        return answer(user);
      }
      return new Headers(options.headers).get("authorization") === "Bearer test-access"
        ? answer(user) : answer({ code: "bad_jwt", msg: "Unauthorized" }, 401);
    }
    if (path.endsWith("/recover")) return answer({});
    if (path.endsWith("/logout")) {
      assert.equal(new URL(url).searchParams.get("scope"), "global");
      assert.equal(new Headers(options.headers).get("authorization"), "Bearer recovery-access");
      return new Response(null, { status: 204 });
    }
    return answer({ msg: "Unexpected" }, 400);
  });
  try {
    assert.equal(await hostedSignIn(user.email, "Only-Test-Password", "register", undefined), null);
    const result = await hostedSignIn(user.email, "", "verifyEmail", "543210");
    assert.equal(result?.subject, user.id);
    assert.equal((await hostedIdentity("test-access"))?.subject, user.id);
    assert.equal(await hostedIdentity("forged-token"), null);
    assert.equal((await hostedIdentity("expired-token", "test-refresh"))?.renewal?.refresh_token, "renewed-refresh");
    assert.deepEqual(calls, ["/auth/v1/signup", "/auth/v1/verify", "/auth/v1/user", "/auth/v1/user",
      "/auth/v1/user", "/auth/v1/token"]);
    await hostedRequestReset(user.email);
    await assert.rejects(hostedCompleteReset(user.email, "000000", "Synthetic-New-Password"), { status: 401 });
    await hostedCompleteReset(user.email, "650130", "Synthetic-New-Password");
    assert.deepEqual(calls.slice(-5), ["/auth/v1/recover", "/auth/v1/verify", "/auth/v1/verify", "/auth/v1/user", "/auth/v1/logout"]);
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("email code signs in the existing Auth identity and deletion requires a fresh code for that same account", async context => {
  const environment = { SUPABASE_URL: "https://auth-example.invalid", SUPABASE_PUBLISHABLE_KEY: "test-public-key",
    SUPABASE_AUTH_ADMIN_KEY: "test-admin-key" };
  const prior = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]));
  Object.assign(process.env, environment);
  const user = { id: "a903f637-48c7-4d5d-90b3-b4bda683845b", email: "north@example.invalid", email_confirmed_at: "2026-11-19T00:00:00Z" };
  const createOptions: boolean[] = [];
  const deleted: string[] = [];
  context.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    const path = new URL(url).pathname;
    if (path.endsWith("/otp")) {
      const payload = JSON.parse(String(options.body));
      assert.equal(payload.email, user.email);
      createOptions.push(payload.create_user);
      return Response.json(createOptions.length < 3 ? {} : { msg: "Too many requests" }, { status: createOptions.length < 3 ? 200 : 429 });
    }
    if (path.endsWith("/verify")) {
      const payload = JSON.parse(String(options.body));
      assert.equal(payload.email, user.email);
      assert.equal(payload.type, "email");
      if (payload.token === "000000") return Response.json({ code: "otp_expired", msg: "Expired" }, { status: 403 });
      const verified = payload.token === "222222" ? { ...user, id: "7fd00158-d32e-4977-b206-119f4f736a83" } : user;
      return Response.json({ user: verified, access_token: "test-access", refresh_token: "test-refresh", expires_in: 3600 });
    }
    assert.equal(new Headers(options.headers).get("apikey"), environment.SUPABASE_AUTH_ADMIN_KEY);
    assert.equal(path, `/auth/v1/admin/users/${user.id}`);
    if (options.method === "GET") return Response.json(user);
    assert.equal(options.method, "DELETE");
    deleted.push(path);
    return Response.json({});
  });
  try {
    await hostedSendEmailCode(user.email, true);
    await hostedSendEmailCode(user.email, false);
    await assert.rejects(hostedSendEmailCode(user.email, true), { status: 429 });
    assert.deepEqual(createOptions, [true, false, true]);
    await assert.rejects(hostedVerifyEmailCode(user.email, "abc"), { status: 400 });
    await assert.rejects(hostedVerifyEmailCode(user.email, "000000"), { status: 401 });
    const identity = await hostedVerifyEmailCode(user.email, "123456");
    assert.equal(identity.subject, user.id);
    assert.equal(identity.renewal?.access_token, "test-access");
    await assert.rejects(hostedDelete(identity, { code: "222222" }), { status: 401 });
    assert.deepEqual(deleted, []);
    await hostedDelete(identity, { code: "333333" });
    assert.deepEqual(deleted, [`/auth/v1/admin/users/${user.id}`]);
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
