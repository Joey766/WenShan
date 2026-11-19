import { execFileSync } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";

const listed = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" });
const candidates = [...new Set(listed.split("\0").filter(Boolean))];
const blocked = /(?:^|\/)(?:\.env[^/]*|\.npmrc|(?:\.work|\.vercel|node_modules|\.next|test-results|output)\/|[^/]+\.(?:zip|dump|key|pem|p12|pfx|sqlite\w*|db)$)/i;
const checkText = /\.(?:json|js|mjs|ts|tsx|md|txt|ya?ml|toml|sql|html|css|svg)$/i;
const credentials = [
  ["Google API key", /\bAIza[\w-]{35}\b/],
  ["GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/],
  ["Supabase secret", /\bsb_secret_[\w-]{25,}\b/],
  ["Private key", /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/],
  ["JWT", /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{18,}\.[A-Za-z0-9_-]{24,}\b/],
  ["Credential in URL", /\b(?:https?|postgres(?:ql)?):\/\/[^\s:@/'"]+:(?!PASSWORD@)[^\s@/'"]+@[^\s/'"]+/i],
];
let bytes = 0;
const findings = [];
for (const path of candidates) {
  if (path !== ".env.example" && blocked.test(path)) { findings.push(path + " — blocked path"); continue; }
  const stat = await lstat(path);
  if (!stat.isFile() || stat.size > 25 * 1024 * 1024) {
    findings.push(path + " — unsupported file or size above 25 MiB");
    continue;
  }
  bytes += stat.size;
  if (path !== ".env.example" && !checkText.test(path)) continue;
  const contents = await readFile(path, "utf8");
  for (const [kind, pattern] of credentials) if (pattern.test(contents)) findings.push(path + " — " + kind);
}
for (const finding of findings) console.error(finding);
console.log(JSON.stringify({ candidates: candidates.length, bytes, findings: findings.length }));
process.exitCode = Number(findings.length > 0);
