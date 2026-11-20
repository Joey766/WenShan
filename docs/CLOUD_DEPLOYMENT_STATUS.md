# 问山云端部署状态与发布验收

## 实际状态

2026-11-20 已将 `20261120000100_personal_profile.sql` 和 `20261120000200_login_challenges.sql` 应用至正式库。SQL 文件逐一核对发布候选 SHA `3636c5b`，CLI 迁移预演只列出这两项，执行后预演无待运行迁移。复查资料表强制 RLS、登录挑战表 RLS、运行角色无 `BYPASSRLS`，普通业务角色无法读取登录挑战。实际运行前无正式账号。

正式库迁移前备份位于当前 Windows 用户权限下的 `.work/backups/wenshan-production-pre-v1-20261120-062038.pgdump.dpapi`，SHA-256 为 `60C3E93EF58D21340CA31DB8EB9DED3E4FDA799C131EBA6E62017C878B109766`。已解密核对归档目录，并实际解包 Auth 及 companion 的 SQL 数据流。没有把备份写入版本库。

正式项目保持邮箱确认必需，公开注册仍关闭。自定义 SMTP 首次核查为空，正式注册、登录验证码和找回密码邮件均须真实投递验收。正式公开部署暂缓。

| 服务 | 已核验事实 |
| --- | --- |
| GitHub | [WenShan 私有仓库](https://github.com/Joey766/WenShan) 的 `dev/launch-readiness` 已推送 `7c16642`，[GitHub Actions](https://github.com/Joey766/WenShan/actions/runs/44479012572) 构建、TypeScript、单测及 20 项浏览器测试已通过。私库方案的规则集不强制执行 |
| Vercel | Hobby 项目 `wenshan` 从 `dev/launch-readiness` 自动构建 TLS 修复提交 `75708c1`。[开发分支 Preview](https://wenshan-git-dev-launch-readiness-joey766s-projects.vercel.app) 已更新，对应 [固定部署](https://wenshan-7yunbiguo-joey766s-projects.vercel.app) 的健康检查显示数据库已就绪。Production 当前无可访问部署 |
| Supabase | `WenShan` 组织套餐确认 Free。`wenshan-preview`（`zribhqvanbrfipchjgkg`）和 `wenshan-production`（`qbcbtarlmgzmfbhkitig`）均位于 `us-east-1`，两者均显示健康。四项迁移仅应用于 Preview。两个管理员密码和 Preview 受限运行角色密码分别存放在当前 Windows 用户的凭据管理器 |
| Gemini | Preview 继续使用用户原先设置的 Secret 和 `gemini-3.1-flash-lite`。已完成真实中文流式解卦、拒绝云端处理后的回退、账号阈值触发后的回退。未启用计费 |
| Ollama | 保留为本地 Provider |

Vercel 在连接 Git 时把唯一的开发分支选作 Production，构建门控成功取消了该次尝试。Vercel 校验目标分支必须已存在，因此在同一已审计 SHA 上临时建立 `release/production-hold`，将 Production 追踪改为该分支，关闭生产域名自动分配后，从 `dev/launch-readiness` 显式创建 Preview。生产条件满足后才创建 `main`，切换追踪并放行。现有门控要求同时是 `main` 和启用生产变量。 [GitHub 分支保护](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) · [Vercel 构建设置](https://vercel.com/docs/project-configuration/project-settings#ignored-build-step)

## 线上 Preview 实测

- Edge 登录 Vercel 后可进入 Preview。另一个无 Vercel 会话的浏览器被重定向到登录页。
- 线上完成游客选宠、六次掷钱和观卦阁展示。该次实际本卦为同人，二、三、上爻动，变卦为兑，界面标记「演示模式 · Mock」。
- 线上四个角色各观察到五套自动动作，共 20 套。进入了卦算屋、云栖台、木叶居和星演阁，操作了绒球、坐垫、月灯及「圆乎乎」身形预览。成长持久化需登录后复验。
- 桌面和 390 像素手机模拟视口均检查了首页和小屋，手机视口无横向溢出。受保护 Preview 的本轮浏览器检查未捕获控制台错误。
- 用户保存 Secret 后，[重新部署](https://vercel.com/joey766s-projects/wenshan/EEe16TQZNQnnjUonmf8T3qxUoPeA) 标记 Ready / Preview。线上 `/api/health` 返回 `provider: gemini`、`persistence: unavailable` 和 `ready: false`。重新六掷后游客仍看到内置释意、Google 数据告知和「登录后使用 Gemini」。首次实际请求、中文流式模型输出及真实配额验收均待核验。
- 2026-11-20 最新 Preview `/api/health` 实测返回 `ready: true`、`provider: gemini` 和 `persistence: ready`。外部未登录请求返回 302。用于自动测试的临时授权已撤销，Vercel Authentication 保持开启。
- 真实 Supabase A/B 测试覆盖登录、各自灵宠、XP、记录和昵称。B 无法读取、修改或删除 A 的记录。再次登录的新会话恢复 A 的成长和记录。删除合成账号 A 后，B 仍可读自己的灵宠。Vercel API 实测了双账号、跨独立会话同步与拒绝指定其他所有者。合成账号已清理。
- Gemini 固定卦例为离之艮，初、四爻动，偏慎。两次实测分别在约 0.32 秒、0.15 秒收到确定性首段，约 2.12 秒、2.41 秒收到模型段，约 2.15 秒、4.45 秒完成。均返回三段、`mode: cloud`。拒绝云端处理及达到账号每分钟限制后回退为站内释意。账号每日与全站每日限额在实际数据库内用回滚事务验证。未人为耗尽 Google 免费额度。
- Preview Auth 回调地址已核验。Supabase 明确拒绝 Free 默认发送服务修改验证码模板，公开注册与密码找回的邮件投递暂未通过验收。A/B 为通过管理 API 预先确认的测试账号，与邮件验证验收分开。

## 首次推送范围

- 运行源码、运行时美术、测试、迁移、发布脚本与文档、依赖锁文件进入私库。原始素材包、参考图目录、旧录屏、真实用户数据、环境文件和数据库备份留在本机。
- 候选清单运行 `node scripts/audit-release.mjs`，输出文件数和发现数，检查凭据模式及禁止路径。功能测试使用构造数据。发布前由用户确认可在线展示 `public/` 内的运行素材。古文和整理来源见 [经文说明](ZHOUYI_SOURCES.md)。

## 正式 Supabase 变更影响

2026-11-20 核验正式库没有用户、问山业务表或存储对象，导出并通过 DPAPI 解密、归档目录和 Auth/Storage 解包检查的加密备份。正式库已应用原四项初始迁移，受限角色和 A/B 合成账号隔离通过。正式 Supabase 密钥在诊断输出事件后已撤销并更换，Vercel Production 已写入替代 Secret，Preview 独立密钥照常使用。未发布正式网站。

Preview 和 Production 已分别应用资料列与登录挑战表的两项迁移。生产 Vercel 已具有 Gemini Secret，首次生产 Gemini 调用与实际配额表现仍须验收。

最初的 4 个文件已经在隔离 Preview 及空白 Production 库完成核验：

1. 基线建立私有 `companion` schema、角色、账号映射数据、灵宠、事件、投掷和历史，开启所有者隔离。现有兼容表使用幂等式建立。
2. 新增已验证身份映射、资料和背包，安装解锁触发器并为现有宠物补算背包。安装 Auth 用户删除触发器；今后明确删除一个登录身份时，其对应业务数据会级联删除。执行迁移本身不会删除用户。
3. 新增站点 Gemini 配额表和并发安全的原子预约函数。
4. 新增已验证账号的 Gemini 配额表和预约函数，和站点额度在同一事务检查。账号配额记录随账号删除。默认每站点每分钟 5 次、每日 40 次，每账号每分钟 2 次、每日 5 次。访客可读站内释意。

## 上线前验收

- [x] 首次开发分支推送，GitHub Actions 源码审计、构建、类型和测试通过。
- [x] Vercel 部署详情核对正确提交。保护、桌面与手机视口、三幕、四间小屋、玩具、20 套动作和身形预览实测通过。
- [x] 云端数据库隔离、Preview 健康、真实合成账号 A/B 权限及独立会话成长同步。
- [x] 实际 Gemini API 流式 NDJSON 问卦、固定卦例和账号限流回退。日报限额在云端数据库回滚验证。
- [ ] 邮件服务、真实邮箱注册与密码找回、实体设备复测和剩余正式验收。
- [ ] 验证生产备份与恢复、列明待迁移的 SQL 版本和影响。只有用户另行批准才执行正式数据库迁移。
- [ ] 用户已条件性授权首次公开。全部上线条件、邮件及隐私验收和独立的正式数据库迁移授权齐备后，才创建 `main`、放行 Production 并验证正式地址。后续每次发布仍需用户批准。

日常更新按 [发布与恢复手册](RELEASE_RUNBOOK.md) 执行，持久库和正式网址持续复用。
