# 问山二轮验收

## 视觉与动作

| 样张 | 入口 | 问心台 | 观卦阁 |
|---|---|---|---|
| 桌面 1920 × 1080 | [入口](round2-validation/desktop-1920/entrance.jpg) | [问心台](round2-validation/desktop-1920/divination.jpg) | [经文](round2-validation/desktop-1920/classics.jpg) |
| 桌面 1440 × 900 | [入口](round2-validation/desktop-1440/entrance.jpg) | [问心台](round2-validation/desktop-1440/divination.jpg) | [经文](round2-validation/desktop-1440/classics.jpg) |
| 手机 390 × 844 | [入口](round2-validation/mobile-390/entrance.jpg) | [问心台](round2-validation/mobile-390/divination.jpg) | [经文](round2-validation/mobile-390/classics.jpg) |
| 手机 375 × 667 | [入口](round2-validation/mobile-375/entrance.jpg) | [问心台](round2-validation/mobile-375/divination.jpg) | [经文](round2-validation/mobile-375/classics.jpg) |

[整改前后](round2-validation/entrance-before-after.jpg) · [四只灵宠动作样张](round2-validation/companion-action-sheet.jpg) · [四只灵宠挠头逐帧检查](round2-validation/companion-scratch-sequence.jpg)

- [桌面无人操作 30 秒](round2-validation/desktop-idle-30s.mp4)与[手机视口无人操作 30 秒](round2-validation/mobile-idle-30s.mp4)由本机 Edge 连续采集。两段 RAF 采样平均约 90 FPS，95% 帧间隔 11.3 ms，分别捕获到 2605 和 2710 个屏幕更新帧。两段均无超过 50 ms 的 RAF 间隔。视频统一编码为 30 FPS，本机采样不代表别的设备。 [帧时间及动作顺序原始数据](round2-validation/motion-metrics.json)
- 测试期间雾层改变了位置。四只灵宠各自出现了多种非同步的待机动作，另在浏览器逐只采样点击、看铜钱及落地回弹。三幕场景均保持全画幅，卷轴正文在单一区域内滚动。
- [完整交互录屏](round2-validation/journey-demo.mp4)包含选择、穿云、六次三钱、六爻升起、展卷和一次追问。该录屏运行在隔离的演示模式端口，用于比较视觉和交互；真实模型另做验证。
- 首次实拍后把遮挡画面的虚拟圆盘移除，保留前景三维铜钱和原画刻纹石台。缩小移动端雾粒子数量和 WebGL 像素比，并调整灵宠与输入框的相对位置。问心台模型提前装载，后续底图在入口缓加载和解码。最终完整录屏的采集帧间隔 P95 为 11.33 ms，仍有两次超过 50 ms 的采集间隔，最长 111.08 ms。
- 另关闭录屏，走完桌面与模拟手机上的完整流程。两者 P95 均为 11.4 ms。桌面有 4 次超过 50 ms，峰值 122.3 ms。手机视口有 1 次，峰值 155.6 ms。后续可在实体手机继续定位偶发长帧。 [交互绘制采样](round2-validation/transition-render-timing.json)

## 功能

- `npm.cmd run build`、`npm.cmd run typecheck` 和 `npm.cmd test` 通过。13 项单元测试包含 64 卦、384 爻和 4096 种六爻排列。
- `npm.cmd run test:e2e` 在四种指定视口通过 20 项。测试涉及三幕、六掷、结果配对、旧存档、资料修改清除、未授权时省略个人资料、AI 断开回退、取消和重试。375 × 667 项同时启用减少动画。
- 预加载改动后重新运行四种尺寸的三幕流程与角色回应，共通过 8 项，并刷新三幕样张。
- 预览服务已在本机 `http://127.0.0.1:3100` 完成 HTTP 200 验证。重新开机后在原目录运行 `npm.cmd start -- --port 3100`。
- 古文资料采用可定位的维基文库修订。CText 全库逐字交叉校勘仍待完成。 [周易资料说明](ZHOUYI_SOURCES.md)

## 本地 Ollama

- `qwen3:4b` 实测了无背景考试问题、有及格线和模拟分数的数学考试问题，以及两次连续追问。无数据的回答先说明仍需要通过标准和限时模拟成绩。有数据的回答以用户提供的 68 分与 60 分为依据，并给出同等难度与同样限时下的验证方法。
- 实际 Edge 完成六掷，再以同一卦继续追问。后续复核测试在同一生产接口验证最终比较规则。逐句原文和确定性卦象由知识库呈现，模型的叙述受动爻数与数字校验约束。 [四次答复和耗时](round2-validation/ollama-exam-results.json)
- 可用 `npm.cmd run test:ollama` 重跑，设置 `WENSHAN_AI_BROWSER=1` 时以 Edge 完成数学考试案例。两张截图通过浏览器回放已保存的真实模型回复采集。 [经文与白话样张](round2-validation/ollama-classics.jpg) · [追问结果样张](round2-validation/ollama-followup.jpg)
