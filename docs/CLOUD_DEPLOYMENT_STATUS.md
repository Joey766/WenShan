# 问山云端部署状态与发布验收

## 实际状态

| 服务 | 已核验事实 |
| --- | --- |
| GitHub | 已在 `Joey766` 名下创建 [WenShan 私有仓库](https://github.com/Joey766/WenShan)。仓库为空。仓库设置提示规则集在当前方案下不会强制执行 |
| Vercel | 当前 Edge 会话进入 Dashboard 时出现登录页。尚无 Preview 和正式地址 |
| Supabase | 当前 Dashboard 会话没有列出可复用组织或项目。生产与 Preview 数据库均未连接 |
| Gemini | Google AI Studio 显示一个已经存在的免费层级项目和一枚 Key。没有读取或传输 Key，没有远程模型调用 |
| Ollama | 保留为本地 Provider |

首次远程操作待用户确认。预定只推送 `dev/launch-readiness` 到 `Joey766/WenShan`。CI 在开发分支运行；Vercel 构建配置让 Preview 可继续，Production 需要同时是 `main` 且设置用户放行变量。GitHub Free 私库的强制规则限制需要人工审批补足。 [GitHub 分支保护](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) · [Vercel 构建设置](https://vercel.com/docs/project-configuration/project-settings#ignored-build-step)

## 首次推送范围

- 运行源码、运行时美术、测试、迁移、发布脚本与文档、依赖锁文件进入私库。原始素材包、参考图目录、旧录屏、真实用户数据、环境文件和数据库备份留在本机。
- 候选清单运行 `node scripts/audit-release.mjs`，输出文件数和发现数，检查凭据模式及禁止路径。功能测试使用构造数据。发布前由用户确认可在线展示 `public/` 内的运行素材。古文和整理来源见 [经文说明](ZHOUYI_SOURCES.md)。

## 正式 Supabase 变更影响

按版本有 4 个文件。先在用户指定的隔离 Preview 项目验证。生产项目识别、迁移历史、备份及恢复结果和正式授权须单独记录。

1. 基线建立私有 `companion` schema、角色、账号映射数据、灵宠、事件、投掷和历史，开启所有者隔离。现有兼容表使用幂等式建立。
2. 新增已验证身份映射、资料和背包，安装解锁触发器并为现有宠物补算背包。安装 Auth 用户删除触发器；今后明确删除一个登录身份时，其对应业务数据会级联删除。执行迁移本身不会删除用户。
3. 新增站点 Gemini 配额表和并发安全的原子预约函数。
4. 新增已验证账号的 Gemini 配额表和预约函数，和站点额度在同一事务检查。账号配额记录随账号删除。默认每站点每分钟 5 次、每日 40 次，每账号每分钟 2 次、每日 5 次。访客可读站内释意。

## 上线前验收

- [ ] 确认首次开发分支推送，GitHub Actions 的源码审计、构建、类型和测试全部通过。
- [ ] 打开 Vercel 受保护 Preview，健康检查返回正确提交，桌面、手机可用。
- [ ] 四宠屋、20 套动作、玩具、结契、成长与装扮在 Preview 实测通过。
- [ ] Supabase Preview 和 Production 分开。用 A/B 测试邮箱验证注册、验证码重置、跨设备、退出、重复绑定、隔离与删除测试账号。
- [ ] 用真实 Free Tier Key 在 Preview 发一条固定的非个人问题，确认 SSE 最终标记为 Gemini、卦象正确、无前端密钥、限额和降级正常。
- [ ] 验证生产备份与恢复、列明待迁移的 SQL 版本和影响。只有用户另行批准才执行正式数据库迁移。
- [ ] 用户明确回复「确认正式上线」后才能创建或合并 `main`、放行 Production 并验证正式地址。

日常更新按 [发布与恢复手册](RELEASE_RUNBOOK.md) 执行，持久库和正式网址持续复用。
