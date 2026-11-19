# 问山

中文国风《周易》文化占卜。一问一卦，选一位灵宠，掷三枚铜钱六次，到观卦阁看本次倾向、卦象依据和一句白话。可另行查看经文，想问另一件事时选择「再问一卦」。

## 本地启动

在 Windows PowerShell 打开当前项目。建议使用 Node.js 22.18 或更新版本。

```powershell
Set-Location -LiteralPath 'D:\塔罗project'
npm.cmd ci
npm.cmd run dev -- --port 3100
```

打开 [http://127.0.0.1:3100](http://127.0.0.1:3100)。依赖已安装时可直接运行最后一条命令。已生产构建时，也可运行 `npm.cmd start -- --port 3100`。

默认探测本机 Ollama 的 `qwen3:4b`。可先运行 `ollama list` 查看模型。本机服务未运行时，可打开 Ollama，或在另一个终端运行 `ollama serve`。使用其他已安装的本地模型时，可将 `.env.example` 复制为 `.env.local` 并填写 `OLLAMA_MODEL`。将该值设为空可使用演示模式。模型未安装、超时或返回内容无法通过校验时，观卦阁会显示「演示模式 · Mock」。 [Ollama 下载](https://ollama.com/download) · [Qwen3 模型](https://ollama.com/library/qwen3) · [聊天接口](https://docs.ollama.com/api/chat)

点击「保存本次问卦」后，游客记录保存在本机浏览器。登录时保存到当前账号，在山海入口的「问卦记录」可重新阅读或清除。个人资料可跳过。只有主动授权时，年龄段和性别语境才会传给本机 Ollama。游客的原始生日留在浏览器，账号模式的选填资料仅用于当前页面会话。起卦仍由三枚独立随机铜钱决定。

## 灵宠小屋与账号

从顶栏进入「我的灵宠」。每只灵宠出场就按自己的节奏自动衔接五种动作。游客可以预览四间小屋、玩具和身形。注册后选择一只灵宠，二次确认结契后它会陪伴你问卦与回小屋。本地账号使用独立 PostgreSQL 记录，在同一个服务上重新登录可恢复灵宠、装饰、成长和问卦历史。

默认数据库在 `.work/wenshan-account-db/`，同一个目录由单个 Next.js 进程打开。此前本机的游客数据会保留，只有在账号面板明确选择导入后才会复制所选记录。生产预览可以先执行 `npm.cmd run build`，再执行 `npm.cmd start -- --port 3116`。[v1.6 集成与验收](docs/PET_V16_INTEGRATION_REPORT.md)

## 验证

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run typecheck
npm.cmd run test:e2e
npm.cmd run test:ollama
```

端到端测试使用已安装的 Microsoft Edge，并单独启动生产构建以验证演示回退。Ollama 测试使用本机模型，先跑构建并确认 Ollama 正在运行。

## 预览与发布

上线候选在独立开发分支验收，获用户明确批准后合并到 `main`。GitHub/Vercel、Supabase、Gemini 的首次配置和数据库恢复步骤见 [发布与恢复手册](docs/RELEASE_RUNBOOK.md)，本地证据见 [上线检查报告](docs/LAUNCH_READINESS_REPORT.md)。

经文来源、编者白话和用九、用六的呈现规则见 [周易资料说明](docs/ZHOUYI_SOURCES.md)。二轮素材与逐角色动作清点见 [二轮素材映射](docs/ROUND2_ASSET_MAP.md)。
