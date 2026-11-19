# 二轮运行素材与灵宠动作

增量包原名为「问山_二轮精修_核心素材增量包.zip」，磁盘文件名采用 URL 编码。完整导入 21 项，清单覆盖的 20 项大小及 SHA-256 全部匹配。原包、原图、GIF 与首版备份均保留。

| 提供的素材 | 二轮用途 |
|---|---|
| `public/assets/backgrounds/01_entrance_shanhai.png` | 山海入口全幅底图。由原图生成桌面 WebP、保留山道的竖屏构图和独立近景花枝 |
| `public/assets/backgrounds/02_divination_platform.png` | 问心台全幅底图。沿用画面的刻纹石台，云雾与卦阵拥有各自图层 |
| `public/assets/backgrounds/03_interpretation_pavilion.png` | 观卦阁全幅底图。保留阁内一侧与画外云海，主要文字在同场景的纵向长卷中呈现 |
| `public/assets/interaction/fog/foreground_mist_overlay.png` | 远近雾层、云海推进与幕间遮罩分别采样 |
| `public/assets/interaction/lantern/lantern_hanging.png` | 独立灯笼，摆动与明暗各有不同周期 |
| `public/assets/interaction/effects/golden_divination_ring.png` | 石台附近的薄光，在抛币阶段变化 |
| `public/assets/interaction/scroll/blank_ancient_scroll.png` | 长卷的抬头纹理，内容由 HTML 绘制并可独立滚动 |
| `public/assets/interaction/coins/coin_yang_face.png` 与 `coin_yin_face.png` | Three.js 双面贴图，程序从当轮铜钱结果决定可见面及面值 |
| `public/assets/props/coins/*` | 币体厚度、边缘和金属质感参考，保留静态角度原稿 |
| 同目录的 SVG 备选 | 保留透明矢量备选。运行时选用同包柔和光影的 PNG，并转为 WebP |

以上运行场景、道具衍生物位于 `public/art/world/`，可运行 `python scripts/prepare-world-art.py` 重新生成。

## 灵宠分拣

| 角色 | 正式外观 | 动作参考和多姿态合集 | 可用独立层 |
|---|---|---|---|
| 小卦 | 四灵宠定稿中带竹笠、芽叶及铜钱的小卦 | `concept_animated/xiaogua.gif`，以及 4 个实际是九帧 GIF 的 `motion_experiments/xiaogua/*.png`。`assets/growth/concept/01_小卦_四状态与成长.png` 用于表情参考 | 衍生身体、眼、合眼、芽叶、手及连接段。参考先停顿、再抬手和双次挠动 |
| 云爻 | 正式白云、金纹与光环 | `concept_animated/yunyao.gif`、`motion_previews/yunyao/yunyao_hover_preview.gif` 与对应分镜，部分探索稿为改款 | 衍生眼、光环和云团动作部件。呼吸节奏较慢，小幅回弹 |
| 青朴 | 正式浅绿叶帽与露滴 | `concept_animated/qingpu.gif`、跳跃参考与透明预览，`assets/growth/concept/03_青朴_四状态与成长.png` 提供状态比较 | 原包有独立透明图和 16 帧透明 GIF。应用采用与其他三只一致的定稿衍生遮罩，独立控制叶帽下的露滴和肢体 |
| 玄机 | 正式深色星团、金色星轨与阴阳吊饰 | `concept_animated/xuanji.gif`、`xuanji_jump_sheet_v01.png` 实为 GIF，`xuanji_jump_preview.gif` 为带背景预演 | 衍生身体、眼、合眼、星轨左端与手层。动作较谨慎，偶尔短弹和张望 |

定稿原始参考为 `assets/reference/characters_4_approved.png`。四角色同屏 GIF、成长总览和观卦阁姿态分镜用于对照剪影、眼神、蓄力和收势。场景不播放这些整图。运行时每只灵宠有独立调度，在呼吸之上组合随机眨眼、张望、歪头、停顿及少量跳跃。手部的根节点固定在身体，手和连接段一起旋转；芽叶、光环、露滴和星轨分层稍晚收势。投掷、落地、等待解读和解读完成均有独立事件。

`scripts/prepare-pet-rigs.py` 从批准造型的已有透明立绘制作身体、眼与局部配饰。在二维层上运行变形时间线，铜钱才由真正的三维模型、物理形状和摄像机承担。
