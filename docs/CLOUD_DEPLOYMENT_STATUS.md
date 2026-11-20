# 问山云端部署状态与发布验收

## 实际状态

2026-11-20 已将 `20261120000100_personal_profile.sql` 和 `20261120000200_login_challenges.sql` 应用至正式库。SQL 文件逐一核对发布候选 SHA `3636c5b`，CLI 迁移预演只列出这两项，执行后预演无待运行迁移。复查资料表强制 RLS、登录挑战表 RLS、运行角色无 `BYPASSRLS`，普通业务角色无法读取登录挑战。实际运行前无正式账号。

正式库迁移前备份位于当前 Windows 用户权限下的 `.work/backups/wenshan-production-pre-v1-20261120-062038.pgdump.dpapi`，SHA-256 为 `60C3E93EF58D21340CA31DB8EB9DED3E4FDA799C131EBA6E62017C878B109766`。已解密核对归档目录，并实际解包 Auth 及 companion 的 SQL 数据流。没有把备份写入版本库。

2026-11-20 v1.0 已发布到 [正式网址](https://project-0h873.vercel.app)，普通访客可直接访问。正式分支为 `main`，部署 `dpl_3fZpAdY5GU2SdUyvEJwsuWLfbfmF` 来自验证通过的 `d9f26b9cb7a4d5095fa383073cd4010709d37eda`。[正式 GitHub Actions](https://github.com/Joey766/WenShan/actions/runs/44690424438) 通过。

## 正式发布实测

- 正式 Brevo SMTP 真实送达注册、登录与密码找回邮件。实测三封从操作到轮询检出分别约 10、5、5 秒。确认邮件前密码登录被拒绝，找回密码后旧密码失效，验证码登录只允许已注册邮箱。
- 无 Vercel 会话的 Edge 桌面和手机视口访问正式主页与健康接口成功。公开账号实际注册，个人资料保存后刷新仍可读取。完成结契与六次投掷，按界面同意后真实 Gemini 返回三个流式段；本次首个模型段约 3.34 秒出现。未授权时本次浏览器请求未发送个人资料。
- 受保护的正式候选用同一套正式数据库测试 A/B 私有资料隔离、游客写入拒绝、灵宠与成长跨会话同步、Gemini 账号使用上限。正式网址绑定的是同一部署。问山合成测试账号已清理。
- 本机验证截图存于 `output/playwright/wenshan-v1-production/`。临时收件验证使用 [Mail.tm](https://mail.tm/) 的合成数据。

| 服务 | 已核验事实 |
| --- | --- |
| GitHub | [WenShan 私有仓库](https://github.com/Joey766/WenShan) 默认分支为 `main`，正式候选通过构建、TypeScript、单项和浏览器检查。当前私库方案的分支保护规则集不强制执行 |
| Vercel | Hobby 项目 `wenshan` 追踪 `main` 并自动更新正式域名。其他开发分支的 Preview 保留 Vercel Authentication |
| Supabase | `WenShan` 组织套餐确认 Free。`wenshan-preview`（`zribhqvanbrfipchjgkg`）和 `wenshan-production`（`qbcbtarlmgzmfbhkitig`）均位于 `us-east-1`，两者均显示健康并各自完成六项迁移。管理员与受限运行角色的凭据分别存放在当前 Windows 用户的凭据管理器 |
| Gemini | Preview 和 Production 均使用用户既有的 Secret 与 `gemini-3.1-flash-lite`。正式已完成真实中文流式解卦、未授权回退、账号限额触发回退。本次未更改计费设置 |
| Ollama | 保留为本地 Provider |

Vercel 在连接 Git 时把唯一的开发分支选作 Production，构建门控成功取消了该次尝试。Vercel 校验目标分支必须已存在，因此在同一已审计 SHA 上临时建立 `release/production-hold`，将 Production 追踪改为该分支，关闭生产域名自动分配后，从 `dev/launch-readiness` 显式创建 Preview。v1.0 首发时创建 `main`，先生成受保护的 Production 暂存部署，实测通过后再绑定正式域名。现有门控要求同时是 `main` 和启用生产变量。 [GitHub 分支保护](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) · [Vercel 构建设置](https://vercel.com/docs/project-configuration/project-settings#ignored-build-step)

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

2026-11-20 核验正式库没有用户、问山业务表或存储对象，导出并通过 DPAPI 解密、归档目录和 Auth/Storage 解包检查的加密备份。正式库已应用原四项初始迁移，受限角色和 A/B 合成账号隔离通过。正式 Supabase 密钥在诊断输出事件后已撤销并更换，Vercel Production 已写入替代 Secret，Preview 独立密钥照常使用。

Preview 和 Production 已分别应用资料列与登录挑战表的两项迁移。生产 Vercel 的 Gemini Secret 已通过正式网址实测，账号配额降级也已通过。

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
- [x] 正式邮箱注册、密码登录、验证码登录、密码找回、桌面和手机浏览器视口通过实测。
- [x] 验证正式加密备份可解密和解包，两项经用户批准的正式迁移已执行并复核。
- [x] 首次公开发布通过，未登录访客从正式地址访问。后续每次正式发布仍需用户明确授权。

日常更新按 [发布与恢复手册](RELEASE_RUNBOOK.md) 执行，持久库和正式网址持续复用。
