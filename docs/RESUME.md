# 恢复问山开发

每次收到「继续」先用 Codex 官方用量接口读取 300 分钟与 10,080 分钟窗口。5 小时剩余不高于 5% 或每周剩余不高于 3% 时暂停新增任务。读不到任一数字时先向用户确认。

工作目录为 `D:\塔罗project`。四个独立素材包已经安全合并。先看 [开发进度](PROJECT_PROGRESS.md)、[素材盘点](ASSET_INVENTORY.md) 与 [使用说明](../README.md)。

上线准备见 [检查报告](LAUNCH_READINESS_REPORT.md) 和 [发布与恢复手册](RELEASE_RUNBOOK.md)。本地 Git 在 `dev/launch-readiness`，首次提交、远程仓库和 Vercel 连接待用户授权。日常发布需要独立分支 Preview、CI 和用户批准，代码更新继续使用同一持久数据库。

当前为 v1.6。三幕问卦、知识库和本地解读继续使用现有实现，并增加真实账号、一人一宠、`/pet-home` 四主题小屋及轻量成长。旧版饥饿和切宠逻辑仍归档在 `src/deferred/pet-home/`。当前范围、账号安全和测试证据见 [v1.6 集成报告](PET_V16_INTEGRATION_REPORT.md)。

用 `npm.cmd test`、`npm.cmd run build` 和 `npm.cmd run typecheck` 检查引擎及构建。生产构建后用 `npm.cmd run test:e2e` 验证 Edge 桌面、移动端和模型断开回退，用 `npm.cmd run test:ollama` 核对本地 Qwen3 两轮对话。

第三轮的变更及验收见 [第三轮总结](ROUND3_REFACTOR_SUMMARY.md)、[灵宠动作](ROUND3_ANIMATION_NOTES.md) 和 [本地解读](ROUND3_AI_NOTES.md)。首版源码备份在 `.work/wenshan-round1-backup.zip`。素材用途和旧验收见 [二轮素材映射](ROUND2_ASSET_MAP.md) 与 [二轮验收](ROUND2_VALIDATION.md)。

开机后在原目录运行 `npm.cmd start -- --port 3116`，浏览器打开 `http://127.0.0.1:3116`。要复测真实模型，确保本机 Ollama 正在运行且有 `qwen3:4b`。服务不可用时页面会标明演示模式。

最新角色沿用 v6 贴地坐姿。各宠从出场开始自动顺次循环自己的五套动作，点击选择陪伴、投掷铜钱和小屋玩具均不重置轮换。`src/components/pet-motion.ts` 控制顺序和弹簧，`src/components/companion-mesh.ts` 控制足底和头部，`src/components/pet-sprite.ts` 负责不支持 WebGL 时的自动精灵帧。先构建，再运行 `node scripts/capture-pet-v16.mjs --cycle` 重录最新版，需要本机 Edge 和 FFmpeg。旧的小黄风格录屏保存在此前输出目录。

最新面部节拍在 `src/components/pet-expression.ts`。使用 `python scripts/prepare-companion-motion.py --expressions` 生成实时图集，构建后运行 `node scripts/render-pet-expression-sheets.mjs` 输出 20 张透明动作表，再运行 `python scripts/prepare-pet-expression-sheets.py` 核验并压缩精灵表。新版实录在 `output/playwright/pet-expression-pass/`。

小屋的玩具轨迹和灵宠反应共用 `src/components/room-interaction.ts`，叠加在自主轮播上。座垫独立于玩具摆放，布置回馈在当前灵宠身上即时体现。用于复查的录制命令是 `node scripts/capture-pet-v16.mjs --room-interactions`，输出位于 `output/playwright/pet-room-interactions/`。访客小屋底部的结契按钮已收起，登录方案待讨论。

四只各五个独立动作现以 v1.6 清单为准。用 `python scripts/prepare-pet-v16.py` 重建运行资源，用 `node scripts/capture-pet-v16.mjs` 重录桌面和手机视口。后台账号目录默认是 `.work/wenshan-account-db/`，单进程使用。不要将此目录或真实账号数据打包。未完成的是实体手机、公网部署及外部账号服务验证。

需要单独复测彩票时，设置 `WENSHAN_AI_CASE=LOTTERY` 后运行 `npm.cmd run test:ollama`。实体手机的帧节奏和 CText 逐字异文校勘仍待完成。
