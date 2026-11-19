import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { Client } from "pg";

const tables = ["pets", "events", "casts", "history"];
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

// Caller owns the transaction. The dry run exercises the same writes and rolls them back.
export async function importLegacy(source, target, links) {
  const owners = (await source.query("SELECT id FROM companion.accounts ORDER BY id")).rows;
  if (!links || Array.isArray(links) || typeof links !== "object" ||
      Object.keys(links).length !== owners.length ||
      owners.some(({ id }) => typeof links[id] !== "string" || !uuid.test(links[id])) ||
      new Set(Object.values(links).map(id => id.toLowerCase())).size !== owners.length) {
    throw new Error("Provide exactly one verified Auth UUID for each legacy account.");
  }
  const counts = { accounts: 0, pets: 0, events: 0, casts: 0, history: 0 };
  for (const { id } of owners) {
    const subject = links[id];
    const verified = await target.query("SELECT 1 FROM auth.users WHERE id=$1 AND email_confirmed_at IS NOT NULL", [subject]);
    if (!verified.rows.length) throw new Error("Every destination Auth identity must be email-verified.");
    await target.query("INSERT INTO companion.accounts VALUES($1,$2,'supabase-migrated')", [id, "legacy-" + id]);
    await target.query("INSERT INTO companion.hosted_identities(subject_id,owner_id) VALUES($1,$2)", [subject, id]);
    await target.query("INSERT INTO companion.profiles(owner_id) VALUES($1)", [id]);
    counts.accounts++;
    for (const table of tables) {
      const { rows } = await source.query(`SELECT row_to_json(t) AS row FROM companion.${table} t WHERE owner_id=$1`, [id]);
      for (const { row } of rows) {
        await target.query(`INSERT INTO companion.${table}
          SELECT * FROM jsonb_populate_record(NULL::companion.${table},$1)`, [JSON.stringify(row)]);
        counts[table]++;
      }
    }
  }
  return counts;
}

async function main() {
  const [backup, mapping, flag] = process.argv.slice(2);
  const database = process.env.WENSHAN_MIGRATION_DATABASE_URL;
  if (!backup || !mapping || !["--dry-run", "--apply"].includes(flag) || !database ||
      !(await stat(backup)).isDirectory() || resolve(backup) === resolve(process.env.WENSHAN_ACCOUNTS_DATA ?? ".work/wenshan-account-db")) {
    throw new Error("Use an offline copy, a verified mapping JSON, a dedicated migration URL and --dry-run or --apply.");
  }
  const links = JSON.parse(await readFile(mapping, "utf8"));
  const target = new Client({ connectionString: database, ssl: { rejectUnauthorized: true } });
  const source = await PGlite.create(resolve(backup));
  try {
    await target.connect();
    await target.query("BEGIN");
    const counts = await importLegacy(source, target, links);
    await target.query(flag === "--apply" ? "COMMIT" : "ROLLBACK");
    console.log(JSON.stringify({ mode: flag, counts }));
  } finally {
    await target.end().catch(() => undefined);
    await source.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    // Never print SQL details, owners, emails, password hashes or connection strings.
    console.error("Legacy migration did not complete. Verify the offline backup, mapping, target schema and whether the identities are already linked.");
    if (error.code) console.error("Database error code:", error.code);
    process.exitCode = 1;
  });
}
