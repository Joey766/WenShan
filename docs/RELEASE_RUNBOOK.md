# 问山发布与恢复手册

当前实际配置见 [云端部署状态](CLOUD_DEPLOYMENT_STATUS.md)。Hobby 项目现已启用 Vercel Authentication 的 Standard Protection，临时生产追踪为 `release/production-hold`，生产域名自动分配关闭。GitHub 开发分支可直接走 Preview。Vercel 要求所填生产分支实际存在，首次生产条件未齐时保留停放分支。

## 环境隔离

| 环境 | 入口 | 数据与 AI |
| --- | --- | --- |
| Development | 本机 `npm.cmd run dev` | 默认保留 v1.6 的 PGlite 与 Ollama。可使用本机 Supabase 做集成验收 |
| Preview | Vercel 为 `dev/*` 分支或 PR 生成的网址 | 独立 Supabase 测试项目和假用户。日常用 `demo`，专项可使用独立的 Gemini 测试项目 |
| Production | Vercel 绑定 `main` 和同一个正式域名 | 专用 Supabase、正式 Gemini 项目、服务端密钥与独立配额 |

Vercel 云函数内的文件路径无法代替持久化数据库。Ollama 只连接运行 Next.js 的同一台机器，托管环境默认展示内置释意。Preview 与 Production 分别设置项目密钥和数据库，测试环境使用合成账号。预览访问启用 Vercel Authentication 等可用保护。 [Vercel Git 集成](https://vercel.com/docs/git/vercel-for-github) · [环境变量范围](https://vercel.com/docs/environment-variables) · [预览保护](https://vercel.com/docs/deployment-protection)

## 所需服务和一次性配置

1. **GitHub**。用户授权后创建或选择仓库，审查首次导入内容及版权。有了首个提交后建立 `main` 基线；以后 Codex 的日常修改只提交到独立 `dev/*` 分支。在 `.github/CODEOWNERS` 用 `* @账号名` 把用户的真实 GitHub 账号设为全仓库审阅人。在 `main` 保护中要求 PR、代码所有者批准、`build-unit-browser` 通过以及分支跟进基线，开启新提交作废旧批准，禁止直接推送、强推和删除，禁止绕过保护，关闭自动合并。由用户本人完成最终确认与合并。若私有仓库的方案缺少分支保护能力，先由用户决定选型，再启用自动正式发布。提 PR 的身份须与审批人区分。 [GitHub 分支保护与计划](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
2. **Vercel**。导入同一个仓库，框架选 Next.js，Production Branch 设为 `main`，启用正式域名的自动分配。Preview 与 Production 分别填写变量。把 Functions 区域与正式数据库选在相邻区域。连接已有 `main` 可能触发首个生产部署，须在首次发布获用户明确确认后执行。授权前可在本机验收，以后只打开 PR 生成的 Preview 网址。个人非商业用途可评估 Hobby；计划或条款不符时由用户决定。 [Vercel Git 部署](https://vercel.com/docs/git) · [Hobby 适用范围](https://vercel.com/docs/plans/hobby)
3. **Supabase 与邮件**。准备互相隔离的 Preview、Production 项目。配置 Email + Password 与 Confirm Email，分别在确认注册和重置密码模板显示 `{{ .Token }}`，用户在问山输入收到的对应验证码。上线前配置经用户同意的 SMTP 和发件域，验证 SPF、DKIM、DMARC、两个非团队收件地址、注册与密码重置投递。Supabase 的默认 SMTP 只适合团队内测试。 [确认邮件模板](https://supabase.com/docs/guides/auth/auth-email-templates) · [自定义 SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
4. **PostgreSQL 权限**。管理员在执行迁移后为已存在的 `wenshan_runtime` 开启登录并设置随机独立密码。用安全的交互式 `psql` 会话执行 `ALTER ROLE wenshan_runtime LOGIN;`，接着用 `\password wenshan_runtime` 输入密码。应用连接字符串使用 Supavisor 的事务池（端口 6543、用户名 `wenshan_runtime.<project-ref>`），启用证书验证。管理员连接只在备份和迁移时使用；不要在 Vercel 设置。应用用事务级角色和自定义 owner，查询不使用命名 prepared statement。 [Supabase 数据库连接](https://supabase.com/docs/guides/database/connecting-to-postgres)
5. **Google AI Studio**。用户创建并选择专用 Free Tier 项目，确认账号所在地区可调用 `gemini-3.1-flash-lite` 并核对该项目的实际限额。应用默认每分钟 5 次、每天 40 次，须按实际项目限额向下调整。默认限制是问山的保护值。将 `GEMINI_API_KEY` 写入 Vercel 对应环境的服务端变量，仅采用 API 用量限制内的模型，保持 Google 项目计费关闭。使用一个不含个人信息的固定问题完成一次真机流式测试，并截图实际文本和额度变化。Preview 默认不用 Production 的项目或 Key。 [Gemini 模型费用与数据使用](https://ai.google.dev/gemini-api/docs/pricing) · [Google 项目限额](https://ai.google.dev/gemini-api/docs/rate-limits)
6. **可选外部监测**。经确认后在用户已有的监测工具中配置 `/api/health` 的在线检查和接收告警的人。监测只读取状态与版本。域名、SMTP、第三方监测的采购和外部配置分别确认。

## 环境变量

以 [环境模板](../.env.example) 为准。不要在变量名前加 `NEXT_PUBLIC_`，也不要把 `.env.local`、数据库备份或验证码放进仓库。

构建后，用 `npm.cmd run test:ollama -- --one` 复验一次本机 Ollama。申请并确认免费测试凭据后，在本机终端为测试进程注入 `GEMINI_API_KEY` 与独立测试库连接变量，再运行 `npm.cmd run test:gemini`。脚本只使用一条固定的非私人测试问题，由应用服务端调用模型。

| 变量 | 用途 |
| --- | --- |
| `WENSHAN_ACCOUNT_BACKEND` | `local` 或 `supabase` |
| `WENSHAN_ACCOUNT_AUTH` | Supabase 邮箱验证码发信验收后设 `email-otp`，首次验证自动注册，后续同邮箱恢复原账号 |
| `SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY` | Supabase Auth API |
| `SUPABASE_AUTH_ADMIN_KEY` | 服务端 Auth 删除账号，要求用户再次输入当前密码；业务表走独立的受限 SQL 连接 |
| `WENSHAN_DATABASE_URL` | 应用受限 PostgreSQL 连接，Preview 与 Production 各自配置 |
| `WENSHAN_DATABASE_CA` | 对应 Supabase 的官方 PEM CA，保留换行，运行时校验证书链和主机名。从 Supabase Database Settings 的 SSL Configuration 下载 |
| `WENSHAN_ACCOUNT_ORIGIN` | 可选规范站点域名。生产可设 HTTPS 域名，动态 Preview 可留空 |
| `WENSHAN_AI_PROVIDER` | `ollama`、`gemini` 或 `demo` |
| `GEMINI_API_KEY`、`GEMINI_MODEL`、`GEMINI_LIMIT_PER_MINUTE`、`GEMINI_LIMIT_PER_DAY` | Gemini 配置，额度为 0 时停止云端调用 |
| `GEMINI_USER_LIMIT_PER_MINUTE`、`GEMINI_USER_LIMIT_PER_DAY` | 已验证账号的独立限额，默认每分钟 2 次、每天 5 次 |
| `WENSHAN_ALLOW_PRODUCTION` | 正式项目首次发布获得批准后，在 Production 设为 `true`，始终只允许 `main` 发布 |
| `OLLAMA_BASE_URL`、`OLLAMA_MODEL` | 本机模型服务、模型名 |
| `WENSHAN_ACCOUNTS_DATA`、`WENSHAN_DB_SSL` | 本地账号目录、仅供本地隔离测试临时禁用 SSL |
| `WENSHAN_RELEASE` | 可选自托管版本，Vercel 优先使用 Git SHA |
| `WENSHAN_MIGRATION_DATABASE_URL` | 管理员离线导入命令使用，服务器不需要此变量 |

### 邮箱验证码登录切换

1. 在 Preview Supabase 配置已获准的 SMTP。将 Magic Link 与 Confirm signup 两个模板改为发送 `{{ .Token }}`，并保留站内输入验证码。使用已有登录邮箱及新的非团队测试邮箱实测收信、过期码错误和重发限制。 [Supabase 无密码登录](https://supabase.com/docs/guides/auth/auth-email-passwordless)
2. 只在 Vercel Preview 启用 `WENSHAN_ACCOUNT_AUTH=email-otp` 并重建。验证同一邮箱再次登录读回原来的账号、灵宠和历史。用合成账号验证删除时要求同邮箱的验证码。应用使用现有 Auth ID，无需改数据表。
3. 正式发布获准后单独配置 Production 邮件服务与模板。Preview 试送的邮件、测试用户与密钥限定在 Preview。

## 修改 → 预览 → 验收 → 发布

首次公开发布须满足线上验收条件、数据库迁移的独立批准和用户明确发布指令。保留受保护的 Preview，生产放行变量保持缺省。首次发布获准后再建立 `main`、设置 Production Branch 并启用生产放行。后续每次正式发布仍须用户明确确认。 [Vercel 生产分支规则](https://vercel.com/docs/git) · [Vercel 构建门控](https://vercel.com/docs/project-configuration/project-settings#ignored-build-step)

1. 日常功能修改在独立开发分支进行。`main` 建立后，以它为基线开分支。首次发布前，现有上线准备可沿用 `dev/launch-readiness`。
2. 自动执行 `npm test`、`npm run build`、`npm run typecheck` 和适用的浏览器检查。测试通过后按用户的持续授权推送开发分支到私有 GitHub 仓库，触发 GitHub Actions 和 Vercel Git Preview。
3. 等 Preview 就绪后核对部署提交 SHA、`/api/health` 和改动涉及的功能，向用户交付本次实际验证过的受保护网址、结果和迁移影响。
4. 有数据库改动时，先审查版本化迁移，在独立 Preview 实测新旧版本兼容与恢复，验证备份后取得正式迁移批准。生产库沿用原项目，更新时保留账户、灵宠和历史数据。
5. 用户明确确认满意并要求发布后，合并审查通过的版本到 `main`，由同一 Vercel 项目自动更新原正式域名。部署沿用既有 Supabase 数据库和 Gemini 环境配置，素材通过版本库更新。上线后验证版本、账号读写和相关功能，记录上一稳定部署供回滚。

## 版本化迁移与历史账号

- 托管迁移由 `supabase/migrations/` 管理。安装 Supabase CLI 后在项目根目录生成必要的 CLI 配置，分别核对项目引用与迁移清单。先对已确认的目标执行 `supabase db push --dry-run --remote`。仅在身份、备份、兼容性与审批均通过时执行正式 `supabase db push --remote`。GitHub Actions 不连接正式数据库。 [Supabase CLI 迁移流程](https://supabase.com/docs/guides/local-development/cli-workflows)
- 兼容策略为先增加可选列、表或接口，再发布使用新结构的代码。等旧版本超过回滚窗口后单独审查清理。每次用上一正式版本与候选版本做读写检查，并对比账号数、每位用户的绑定、累计 XP、道具、装扮和历史记录。
- 若存在本地 v1.6 文件账本，停止写入并生成一份受访问控制的离线副本，核验副本能打开并查询记录。为每位旧账号核验所有权，先在目标 Auth 注册并验证邮箱，目标用户应在首次使用新站前完成映射。映射文件为 `{ "旧账号 UUID": "已验证的 Auth UUID" }`，放在不进版本库的安全目录。导入沿用旧账号 UUID，保留所绑宠物、进度、外观、事件、投掷和历史；用户使用新的 Supabase 凭据。
- 先在隔离库运行 `node scripts/import-legacy-accounts.mjs "<离线副本目录>" "<映射文件>" --dry-run`。这会执行相同的约束检查并完整回滚。确认计数、每个用户可见结果、重复导入冲突和跨账号读写后，才以 `--apply` 导入明确批准的目标。脚本要求完整且一对一的映射；已映射 Auth、已存在的旧 UUID 等冲突会让整批导入回滚。保护原始副本与映射文件。
- 浏览器游客历史仍由用户主动导入，生日和性别沿用现有的本机隐私边界。更新网站代码不会重建 Supabase 项目或更换数据源。

## 错误、回滚与恢复

- `GET /api/health` 提供运行版本、Provider、数据库权限可用性与配置状态。返回 `503` 时检查最近一次配置或迁移。它不会调用 Gemini、消耗模型预算或测试邮件投递。
- Vercel Runtime Logs 筛选 `next_request_error`、`account_operation_failed`、`database_idle_connection_error`、`readiness_unavailable` 和 `reading_fallback`。`reading_complete` 带 Provider 与耗时供排查。日志事件不带用户问题、验证码、令牌或密钥。日志保留时长取决于套餐。 [Vercel 运行日志](https://vercel.com/docs/logs/runtime)
- 版本故障先确认当前及上一稳定部署 SHA，在 Vercel 回滚站点，检查域名、账号访问和环境配置是否为预期。同时为 `main` 提交修复或回退 PR。Vercel Instant Rollback 后检查是否需要恢复自动域名分配。 [Vercel 快速回滚](https://vercel.com/docs/instant-rollback)
- 数据库异常优先停止写入并保存故障现场快照，采用向前修复迁移。需要恢复时，先在独立目标恢复经过验证的数据库和 Auth 数据，记录恢复点，核对恢复点之后的新写入如何补齐，确认后再切换应用连接。Supabase 自带备份与 PITR 能力取决于实际方案，采用免费方案时另行留存加密的离站备份。部署回滚和数据库恢复是两项操作。 [Supabase 备份与恢复](https://supabase.com/docs/guides/platform/backups)

## 小程序预留

未来客户端共用服务端起卦、解卦、灵宠和档案操作，以及 PostgreSQL 主用户 UUID。微信身份交换由服务端验证，再通过受审查的身份映射接入；数据读写继续按已验证主体执行。小程序仍需实现会话传输、微信登录、域名白名单与备案、隐私同意和流式显示适配。
