# 问山上线准备

**目标** 现有工程可以分环境测试，用户确认后再发布。账号数据和 AI 配额独立于站点实例持久化。

- [x] 在 `supabase/migrations/` 建立兼容现有 companion 业务表的版本化迁移。用 PGlite 运行同一组托管 SQL，测试两位用户、升级旧记录、角色权限和并发配额。
- [x] 用 `src/lib/server/hosted-accounts.ts` 接入 Supabase Auth 和 PostgreSQL。保留原有 `/api/companion` 操作、业务校验和本地后端。在本地模拟 Auth 验证邮箱确认、会话刷新和伪造凭证拒绝。
- [x] 用 `src/lib/server/ai-provider.ts` 统一模型传输，沿用卦象验证和 NDJSON。模拟 Gemini SSE、超额和断流，云端请求排除个人资料。
- [x] 增加 GitHub 检查、运行健康接口与日志，整理环境配置、独立数据库恢复、迁移旧账号及发布操作。本地构建、TypeScript、单测和浏览器回归通过。

本轮的外部服务操作止于核对官方资料。正式密钥、远端发布和生产迁移由后续经确认的步骤处理。
