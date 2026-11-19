const { VERCEL_ENV: deployment, VERCEL_GIT_COMMIT_REF: branch, WENSHAN_ALLOW_PRODUCTION: approved } = process.env;
const allowed = deployment === "preview" || (deployment === "production" && branch === "main" && approved === "true");
if (!allowed) console.error("WenShan deployment held. Production requires main and the owner-enabled production setting.");
process.exitCode = process.argv.includes("--ignore") ? Number(allowed) : Number(!allowed);
