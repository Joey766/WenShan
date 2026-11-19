# 问山二轮精修：核心问卦新增素材说明

将本 ZIP 放在 `D:\塔罗project`，安全解压至项目根目录并保留原始 ZIP。**这是增量包，不是完整源码**，绝对不要新建项目或删除旧资源。

- `public/assets/backgrounds/01_entrance_shanhai.png`：山海入口无字/无人干净背景，适合全屏分层开发
- `public/assets/backgrounds/02_divination_platform.png`：问心台干净背景；前景 3D 铜钱需程序独立渲染
- `public/assets/backgrounds/03_interpretation_pavilion.png`：观卦阁背景；可在场景中动态叠加经文卷轴
- `public/assets/props/coins/*`：可用作铜钱高精度美术参考或贴图，不代表真 3D 模型；需一致处理正反面与程序结果
- `public/assets/interaction/scroll/*`：卷轴透明 PNG/SVG；承载动态经文
- `public/assets/interaction/lantern/*`：灯笼透明 PNG/SVG；可进行轻微摆动
- `public/assets/interaction/fog/*`：透明前景云雾图层，用于穿云转场
- `public/assets/interaction/effects/*`：金色卦阵光环
- `public/assets/interaction/coins/*`：铜钱两面 PNG/SVG

不包含已经取消的独立灵宠居所、喂食和成长素材。旧素材仍可在原包内保留备用。

需核对与 `assets/reference/characters_4_approved.png` 一致的四只官方角色，避免把参考拼贴图当成可直接用的角色透明动画图层。

本包包含完整整改指令 `docs/CODEX_MAX_FULL_REBUILD_PROMPT.md`，应以此覆盖此前与全屏/AI 解读/居所范围相冲突的指令。

**重要：** 无人物的背景仍是静态 PNG；需要 Codex 使用分层、视差和 Three.js 创造真实流畅交互，不要谎称静态图天然是 3D。
