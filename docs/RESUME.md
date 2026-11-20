# 恢复问山开发

每次收到「继续」先用 Codex 官方用量接口读取 300 分钟与 10,080 分钟窗口。5 小时剩余不高于 5% 或每周剩余不高于 3% 时暂停新增任务。读不到任一数字时先向用户确认。

2026-11-20 已执行用户批准的 `20261120000100`（可选个人资料列）和 `20261120000200`（登录挑战表）。已复查正式库迁移清单、行级安全和运行角色权限。加密备份与验证见[云端部署状态](CLOUD_DEPLOYMENT_STATUS.md)。正式 Supabase 项目是 `qbcbtarlmgzmfbhkitig`，Preview 是 `zribhqvanbrfipchjgkg`。不要重复执行迁移。

2026-11-20 v1.0 已正式公开。入口为 [问山](https://project-0h873.vercel.app)，Vercel 追踪 `main` 并启用正式域名自动更新。正式 SMTP 已完成真实邮件验收，公开注册现已开启并要求验证邮箱。已验证正式账号隔离、公开网页资料保存和 Gemini 流式解卦。五天换宠延后。日常修改走开发分支和受保护 Preview，下一次正式发布依然需要用户明确指令。

登录代码延续 `dev/profile-personalization`，混合模式是 `WENSHAN_ACCOUNT_AUTH=password-or-email-code`。注册需要密码和确认验证码，登录在密码或已注册邮箱验证码中任选一种，刷新复用已有会话。问心台选填背景常显。个人资料授权逐卦默认关闭，开启时可逐项调整发送给 Gemini 的资料；时间与背景可改到提交解卦前。

工作目录为 `D:\塔罗project`。四个独立素材包已经安全合并。先看 [开发进度](PROJECT_PROGRESS.md)、[素材盘点](ASSET_INVENTORY.md) 与 [使用说明](../README.md)。

2026-11-20 Supabase 和 Vercel CLI 均已完成用户授权。两个 Free 项目已完成各自的数据库迁移。早期受保护 [Preview](https://wenshan-b4rvhvnlh-joey766s-projects.vercel.app) 已通过真实 A/B 和 Gemini 测试。当前 Windows 用户可从凭据管理器复用 `WenShan/Supabase/wenshan-preview/` 和 `WenShan/Supabase/wenshan-production/` 下的数据库凭据。

上线进度见 [云端部署状态](CLOUD_DEPLOYMENT_STATUS.md) 与 [发布与恢复手册](RELEASE_RUNBOOK.md)。`dev/launch-readiness` 的 Git 提交 `75708c1` 已包含 TLS CA 修复，Git 触发的 [Preview](https://wenshan-7yunbiguo-joey766s-projects.vercel.app) 已通过实际健康检查。长期日常改动在验证后可自动推送开发分支，合并 `main` 仍须用户明确要求。旧的 `dev/email-code-login` 已整合到 v1.0。未来新增正式库迁移仍须单独批准。

当前为 v1.6。三幕问卦、知识库和本地解读继续使用现有实现，并增加真实账号、一人一宠、`/pet-home` 四主题小屋及轻量成长。旧版饥饿和切宠逻辑仍归档在 `src/deferred/pet-home/`。当前范围、账号安全和测试证据见 [v1.6 集成报告](PET_V16_INTEGRATION_REPORT.md)。

用 `npm.cmd test`、`npm.cmd run build` 和 `npm.cmd run typecheck` 检查引擎及构建。生产构建后用 `npm.cmd run test:e2e` 验证 Edge 桌面、移动端和模型断开回退，用 `npm.cmd run test:ollama` 核对本地 Qwen3 两轮对话。

第三轮的变更及验收见 [第三轮总结](ROUND3_REFACTOR_SUMMARY.md)、[灵宠动作](ROUND3_ANIMATION_NOTES.md) 和 [本地解读](ROUND3_AI_NOTES.md)。首版源码备份在 `.work/wenshan-round1-backup.zip`。素材用途和旧验收见 [二轮素材映射](ROUND2_ASSET_MAP.md) 与 [二轮验收](ROUND2_VALIDATION.md)。

开机后在原目录运行 `npm.cmd start -- --port 3116`，浏览器打开 `http://127.0.0.1:3116`。要复测真实模型，确保本机 Ollama 正在运行且有 `qwen3:4b`。服务不可用时页面会标明演示模式。

最新角色沿用 v6 贴地坐姿。各宠从出场开始自动顺次循环自己的五套动作，点击选择陪伴、投掷铜钱和小屋玩具均不重置轮换。`src/components/pet-motion.ts` 控制顺序和弹簧，`src/components/companion-mesh.ts` 控制足底和头部，`src/components/pet-sprite.ts` 负责不支持 WebGL 时的自动精灵帧。先构建，再运行 `node scripts/capture-pet-v16.mjs --cycle` 重录最新版，需要本机 Edge 和 FFmpeg。旧的小黄风格录屏保存在此前输出目录。

最新面部节拍在 `src/components/pet-expression.ts`。使用 `python scripts/prepare-companion-motion.py --expressions` 生成实时图集，构建后运行 `node scripts/render-pet-expression-sheets.mjs` 输出 20 张透明动作表，再运行 `python scripts/prepare-pet-expression-sheets.py` 核验并压缩精灵表。新版实录在 `output/playwright/pet-expression-pass/`。

小屋的玩具轨迹和灵宠反应共用 `src/components/room-interaction.ts`，叠加在自主轮播上。座垫独立于玩具摆放，布置回馈在当前灵宠身上即时体现。用于复查的录制命令是 `node scripts/capture-pet-v16.mjs --room-interactions`，输出位于 `output/playwright/pet-room-interactions/`。访客小屋底部的结契按钮已收起，登录方案待讨论。

四只各五个独立动作现以 v1.6 清单为准。用 `python scripts/prepare-pet-v16.py` 重建运行资源，用 `node scripts/capture-pet-v16.mjs` 重录桌面和手机视口。后台账号目录默认是 `.work/wenshan-account-db/`，单进程使用。不要将此目录或真实账号数据打包。未完成的是实体手机、公网部署及外部账号服务验证。

需要单独复测彩票时，设置 `WENSHAN_AI_CASE=LOTTERY` 后运行 `npm.cmd run test:ollama`。实体手机的帧节奏和 CText 逐字异文校勘仍待完成。
