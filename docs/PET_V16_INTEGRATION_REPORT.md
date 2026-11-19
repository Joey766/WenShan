# 问山 v1.6 集成验收

## 素材核验

在现有工程导入 URL 编码文件名对应的「问山_v1.6_完整升级包_四灵宠五动作_含v1.5 (1).zip」。原包为 132,980,199 字节，SHA-256 为 `be14fb2f6cc9d0b3d3d5278535199e196e8936681c1fe3bae5d6dc699f4edfae`。通过 CRC、路径、大小写重复项与文件类型检查后，将 469 个文件解压到 `assets/imports/wenshan-v16/`。v1.5 清单的 79 项和 v1.6 清单的 124 项哈希均吻合。

已查验 20 张真透明 2160 × 1640 PNG、320 个 540 × 410 WebP 关键帧、20 份 48 帧预览、四份 240 帧动作合集和 12 张身形。用本机 Edge 打开 20 份官方动态预览。原规格图、归档参考和 ZIP 保存在原位置。概念草图留在隔离目录。

## 四灵宠动作

| 灵宠 | 五套动作 |
| --- | --- |
| 小卦 | 呼吸轻晃、呆呆歪头、撅嘴眨眼、小圆爪扶竹笠、铜钱轻晃点头 |
| 云爻 | 软云舒展、轻飘发呆、困困眨眼、抬头看光环、开心小幅摇摆 |
| 青朴 | 叶帽下呼吸、追着露珠歪头、害羞撅嘴、轻扶叶帽、舒展点头 |
| 玄机 | 星团轻呼吸、仰望星星、半眯眼发呆、星环轻晃、开心轻颤 |

日常用同一套分层 WebGL 变形运行在山海入口、问心台、观卦阁和小屋。各动作控制不同的视线、呼吸、帽檐刚性姿态、嘴型、回弹或配饰。当前版本让五种动作从出场自动依次轮换，四只节奏与顺序各异。投掷与读卦只叠加少量视线变化。三幕沿用同一角色之前的轮换进度。

每套素材压成独立的 864 × 656 WebP 精灵表。绘图回退也按每只灵宠的动作顺序自动播放，单套从第 0 帧到第 15 帧。当前与下一套按需加载。减少动态模式使用静态定稿，隐藏页面暂停绘制。圆润身形用包内正式形态预览，运行时只在腹部插值 +4% 或 +6.5%，保持足底及头饰稳定。

## 小屋与成长

| 灵宠 | 小屋 | 专属玩具 | 代表装饰 |
| --- | --- | --- | --- |
| 小卦 | 卦算屋 | 铜钱摇铃 | 竹风铃 |
| 云爻 | 云栖台 | 软云球 | 云团吊饰 |
| 青朴 | 木叶居 | 露珠球 | 飞花枝 |
| 玄机 | 星演阁 | 星轨球 | 星光挂饰 |

四间小屋都使用包内高清原画和独立 SVG。可以摸头、滚绒球、靠坐垫休息、玩对应玩具、播放动作和在固定位置换装饰。游客可预览各屋，登录后以服务端绑定为准。进入小屋和问卦共享同一只主灵宠。

成长按 UTC 日界线计算。每日首个有效相伴日 +5 XP，前两次服务端完整六掷各 +10 XP，前 3 次有效互动各 +2 XP。互动有 8 秒冷却，日上限 31 XP，事务里校验账号、资格和幂等键。60 和 180 XP 解锁玩具、装饰与可选身形。所有解锁可从已保存的 XP 推导，选用的身形和装饰也独立保存。

## 真实账号与范围

本机使用 PGlite 的 PostgreSQL 和原生行级安全策略。密码通过随机盐及 scrypt 存储，账号身份由 HttpOnly 会话判定。角色 `wenshan_member` 无登录权限、无 RLS 绕过权限，每个事务按服务端认证身份设置行策略上下文。长期绑定只有首条写入权限，后续允许更新的列仅为 XP、身形、装饰。数据库保存账号、会话、绑定、奖励、六轮原始投掷和收藏的问卦。

注册、登录、退出、历史清除、账号删除、游客记录经确认导入均能运行。账号模式下，生日和性别只在当前页面会话中使用。游客继续使用浏览器存储，账号模式不会静默合并本机资料。原有 Ollama 易经接口保持本机运行。

本地版无需 Supabase 密钥、付费服务或公网部署。跨浏览器恢复实测使用同一台服务器、三份隔离的浏览器会话。当前 PGlite 文件目录服务于单个 Next.js 进程。若未来需要公网、多实例、账号恢复或微信登录，再单独配置认证、共享 PostgreSQL、TLS 及备份。已预留外部身份关联表，当前没有外部身份接入。

[PGlite 文件系统说明](https://pglite.dev/docs/filesystems) · [PostgreSQL 行级安全说明](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

## 本地访问

在 `D:\塔罗project` 执行

```powershell
npm.cmd run build
npm.cmd start -- --port 3116
```

首页 `http://127.0.0.1:3116/`，小屋 `http://127.0.0.1:3116/pet-home`。默认数据库文件在 `.work/wenshan-account-db/`。单元和浏览器测试使用独立的合成账号和独立测试数据库。

## 浏览器证据

- [桌面四灵宠连续待机](../output/playwright/pet-v16/desktop-idle.mp4)
- [手机视口四灵宠连续待机](../output/playwright/pet-v16/mobile-idle.mp4)
- [小屋实录](../output/playwright/pet-v16/desktop-room-play.mp4)
- [圆润身形与竹风铃](../output/playwright/pet-v16/desktop-xiaogua-round.jpg) · [无 WebGL 的精灵表回退](../output/playwright/pet-v16/desktop-sprite-fallback.jpg)
- [桌面卦算屋](../output/playwright/pet-v16/desktop-xiaogua.jpg) · [桌面云栖台](../output/playwright/pet-v16/desktop-yunyao.jpg) · [桌面木叶居](../output/playwright/pet-v16/desktop-qingpu.jpg) · [桌面星演阁](../output/playwright/pet-v16/desktop-xuanji.jpg)
- [手机卦算屋](../output/playwright/pet-v16/mobile-xiaogua.jpg) · [手机云栖台](../output/playwright/pet-v16/mobile-yunyao.jpg) · [手机木叶居](../output/playwright/pet-v16/mobile-qingpu.jpg) · [手机星演阁](../output/playwright/pet-v16/mobile-xuanji.jpg)

## 工程检查

- `npm.cmd run build`、`npm.cmd run typecheck`、18 项单元及数据库测试通过。PostgreSQL 实测攻击面包括越权读取、修改 XP、删除他人历史、插入他人奖励以及读取凭据。用真实文件目录关闭再打开数据库，账号会话、青朴的绑定仍能读取。
- 25 项桌面与手机视口 Playwright 测试通过，8 项按适用视口跳过。20 套动作均核对对应运行时 ID 与第 16 帧。用两个测试账号和第三个隔离浏览器会话复验绑定、六次投掷、保存、换会话恢复、注销和账号删除。手机落脚位置调整后重新通过四屋测试。无 WebGL 时看到实际像素与最终静态回退。
- 桌面与 390 × 844 模拟手机分别连续录到 31.5 秒，无鼠标输入，四只的动作各自错峰。桌面与手机视口帧间隔 P95 分别为 11.2 和 11.3 毫秒，两段均没有 50 毫秒以上的间隔。小屋互动实录为 10.23 秒。记录及参数见 [录制日志](../output/playwright/pet-v16/capture.json)。
- 真实本机 `qwen3:4b` 两例通过。对同一个足球问题，固定「离之艮」为偏慎，「乾」为偏吉。程序首段分别在 45 和 16 毫秒出现，两例约 24.9 和 7.7 秒完成。两例各有一节使用程序的校验回退。[真实模型测试日志](../output/playwright/pet-v16/local-ollama.log)
- 实体手机和公网访问尚未验证。Windows 中 Next.js 构建生成 PGlite 依赖链接需要可创建工程内目录联接的执行环境。

## 自动轮换复验

在桌面和模拟手机的首页分别连续观察 31.5 秒，四只均显示各自五种动作。浏览器另核对问心台、观卦阁和小屋的完整轮换，以及三幕切换后继续当前进度。关闭 WebGL 后，20 张精灵表均自动显示各自第 0 到第 15 帧。

[桌面四只自动轮换](../output/playwright/pet-cycle/desktop-idle.mp4) · [手机四只自动轮换](../output/playwright/pet-cycle/mobile-idle.mp4) · [三幕与小屋实录](../output/playwright/pet-cycle/desktop-cycle-journey.mp4) · [小卦一轮近景](../output/playwright/pet-cycle/xiaogua-auto-cycle.mp4)
