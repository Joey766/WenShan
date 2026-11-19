# 问山素材盘点

二轮新增素材与实际运行用途见 [二轮素材映射](ROUND2_ASSET_MAP.md)。

原始 ZIP 和 GIF 均保留。未发现含 CODEX_FULL_PROMPT.md、START_HERE.md、docs/ASSET_MANIFEST_ALL.md 的完整整合包。本地素材由四个不重复的包合并。5 个 ZIP 的 CRC、归档路径、文件类型、大小写重复与目标冲突均通过核验。根目录 GIF 与 v1 四灵宠动态预览字节一致。

## 资源映射

| 用途 | 原始路径 | 应用方式 |
|---|---|---|
| 四灵宠定稿 | assets/reference/characters_4_approved.png | 从定稿抠取透明立绘，保留原外观 |
| 山海入口 | assets/scenes/01_entrance/ | 原画、分层与热点交互 |
| 问心台 | assets/scenes/02_wenxintai/ | 取无界面画面区域，使用独立 3D 铜钱 |
| 观卦阁 | assets/scenes/03_guanguage/ | 取环境区域，古卷和文字实时生成 |
| 两次穿云与铜钱跟拍 | assets/transitions/ | 参考 GIF 和分镜的镜头顺序 |
| 解读互动 | assets/characters/reading_states/ | 参考四态与动作节奏 |
| 四灵宠居所 | assets/pet_homes/ | 已归档，随居所系统推迟到未来版本 |
| 状态与成长 | assets/growth/concept/ | 已归档，保留作未来版本参考 |

## 运行素材

- `public/art/entrance.webp` 取自定稿首页，四角色由各自的 `entrance-*.webp` 作为独立视觉层。小卦的脚、云爻抬起的云团以及檐铃另外切分，以同源像素实现翘脚、挥手与摆动。鼠标反馈和转场使用场景层、云雾层和 CSS 透视。
- `public/art/{xiaogua,yunyao,qingpu,xuanji}.webp` 从四灵宠定稿大图抠取，显示于选宠、问心台和观卦阁。
- `public/art/*-blink.webp` 和 `*-paw.webp` 从透明立绘的眼周和身体纹理衍生，用于眨眼和抬手挠头。动作预览由「问山」实际页面录制。
- `public/art/terrace.webp` 与 `public/art/pavilion.webp` 源自 v3 第三幕转场 GIF 的石台和阁楼镜头。石台遮罩移除示例角色、示例动态图案，阁楼仅裁取无示例结果的环境。程序独立绘制铜钱与所有爻象。
- `public/art/home-*.webp` 保留已制作的居所资产。首版没有对应页面。
- `scripts/prepare-art.py` 使用现有素材制作透明 WebP 和运行场景切片。动画 GIF 与分镜均保留为动作和运镜参考。

## 问山_交给Codex的素材包_v1.zip

- 解码名称 `问山_交给Codex的素材包_v1.zip`
- 大小 9,280,258 字节
- SHA-256 `31ec80c1c74fe53e66c3225b8ce1f081d06904b7484d68b210d1180a2e28e171`
- 校验通过，已导入

| 内部路径 | 字节 |
|---|---:|
| `assets/reference/characters_4_approved.png` | 2,685,076 |
| `assets/reference/characters_4_animated_preview.gif` | 895,341 |
| `assets/scenes/01_entrance/homepage_3d_concept.png` | 2,451,339 |
| `assets/characters/concept_static/xiaogua.png` | 627,176 |
| `assets/characters/concept_animated/xiaogua.gif` | 226,809 |
| `assets/characters/concept_static/yunyao.png` | 604,612 |
| `assets/characters/concept_animated/yunyao.gif` | 204,862 |
| `assets/characters/concept_static/qingpu.png` | 631,819 |
| `assets/characters/concept_animated/qingpu.gif` | 240,779 |
| `assets/characters/concept_static/xuanji.png` | 629,165 |
| `assets/characters/concept_animated/xuanji.gif` | 208,334 |
| `docs/ASSET_MANIFEST.md` | 2,738 |
| `docs/PRODUCT_BRIEF.md` | 2,536 |
| `docs/NEXT_SCENES/.gitkeep` | 0 |

## %E9%97%AE%E5%B1%B1_%E4%BA%A4%E7%BB%99Codex%E7%9A%84%E7%B4%A0%E6%9D%90%E5%8C%85_v1.zip

- 解码名称 `问山_交给Codex的素材包_v1.zip`
- 大小 9,280,258 字节
- SHA-256 `31ec80c1c74fe53e66c3225b8ce1f081d06904b7484d68b210d1180a2e28e171`
- 校验通过，与 问山_交给Codex的素材包_v1.zip 完全相同，跳过

| 内部路径 | 字节 |
|---|---:|
| `assets/reference/characters_4_approved.png` | 2,685,076 |
| `assets/reference/characters_4_animated_preview.gif` | 895,341 |
| `assets/scenes/01_entrance/homepage_3d_concept.png` | 2,451,339 |
| `assets/characters/concept_static/xiaogua.png` | 627,176 |
| `assets/characters/concept_animated/xiaogua.gif` | 226,809 |
| `assets/characters/concept_static/yunyao.png` | 604,612 |
| `assets/characters/concept_animated/yunyao.gif` | 204,862 |
| `assets/characters/concept_static/qingpu.png` | 631,819 |
| `assets/characters/concept_animated/qingpu.gif` | 240,779 |
| `assets/characters/concept_static/xuanji.png` | 629,165 |
| `assets/characters/concept_animated/xuanji.gif` | 208,334 |
| `docs/ASSET_MANIFEST.md` | 2,738 |
| `docs/PRODUCT_BRIEF.md` | 2,536 |
| `docs/NEXT_SCENES/.gitkeep` | 0 |

## 问山_Codex增量素材包_v2_自v1后.zip

- 解码名称 `问山_Codex增量素材包_v2_自v1后.zip`
- 大小 28,715,475 字节
- SHA-256 `7e8674dfadca4c15a7571e855f3663042ec30b791c45c2f1c3aa2f56df82cab8`
- 校验通过，已导入

| 内部路径 | 字节 |
|---|---:|
| `README_如何导入.txt` | 572 |
| `assets/_misc_references/cloud_crop_experiment.png` | 614,731 |
| `assets/_misc_references/cloud_testcut_experiment.png` | 698,052 |
| `assets/characters/motion_experiments/xiaogua/xiaogua_jump_sheet_v01.png` | 869,010 |
| `assets/characters/motion_experiments/xiaogua/xiaogua_jump_sheet_v02.png` | 851,223 |
| `assets/characters/motion_experiments/xiaogua/xiaogua_jump_sheet_v03.png` | 840,171 |
| `assets/characters/motion_experiments/xiaogua/xiaogua_jump_sheet_v04.png` | 845,535 |
| `assets/characters/motion_experiments/xuanji/xuanji_jump_sheet_v01.png` | 812,761 |
| `assets/characters/motion_experiments/yunyao/yunyao_preview_keyframes.png` | 612,442 |
| `assets/characters/motion_experiments/yunyao/yunyao_style_experiment_v01.png` | 851,550 |
| `assets/characters/motion_experiments/yunyao/yunyao_style_experiment_v02.png` | 774,444 |
| `assets/characters/motion_experiments/yunyao/yunyao_style_experiment_v03.png` | 783,649 |
| `assets/characters/motion_previews/qingpu/qingpu_jump_preview.gif` | 1,401,682 |
| `assets/characters/motion_previews/qingpu/qingpu_transparent_character.png` | 330,981 |
| `assets/characters/motion_previews/qingpu/qingpu_transparent_preview.gif` | 764,693 |
| `assets/characters/motion_previews/xuanji/xuanji_jump_preview.gif` | 1,132,040 |
| `assets/characters/motion_previews/yunyao/yunyao_hover_preview.gif` | 5,087,436 |
| `assets/scenes/02_wenxintai/wenxintai_v01_initial.png` | 2,366,788 |
| `assets/scenes/02_wenxintai/wenxintai_v02_ui_variant.png` | 2,306,099 |
| `assets/scenes/02_wenxintai/wenxintai_v03_ui_variant.png` | 2,418,139 |
| `assets/scenes/02_wenxintai/wenxintai_v04_ui_variant.png` | 2,389,270 |
| `assets/scenes/03_guanguage/guanguage_v01_reading_scene.png` | 2,338,883 |
| `docs/ASSET_MANIFEST_V2.json` | 11,499 |
| `docs/ASSET_MANIFEST_V2.md` | 5,120 |
| `docs/DESIGN_DECISIONS_SINCE_V1.md` | 3,614 |

## %E9%97%AE%E5%B1%B1_Codex%E5%A2%9E%E9%87%8F%E7%B4%A0%E6%9D%90%E5%8C%85_v3_%E8%87%AAv2%E5%90%8E.zip

- 解码名称 `问山_Codex增量素材包_v3_自v2后.zip`
- 大小 33,467,246 字节
- SHA-256 `ce7bd138228bc88b281fac7d6066980221d4bdc17ede7ecf323a68c9c96d1159`
- 校验通过，已导入

| 内部路径 | 字节 |
|---|---:|
| `assets/transitions/01_entrance_to_divination/cloud_pushthrough_concept.gif` | 10,369,688 |
| `assets/transitions/01_entrance_to_divination/cloud_pushthrough_storyboard.jpg` | 186,915 |
| `assets/transitions/02_coin_toss/coin_camera_up_overhead_landing.gif` | 8,031,631 |
| `assets/transitions/02_coin_toss/coin_camera_six_step_storyboard.jpg` | 685,183 |
| `assets/transitions/03_divination_to_reading/hexagram_to_scroll_transition.gif` | 690,956 |
| `assets/transitions/03_divination_to_reading/hexagram_to_scroll_storyboard.png` | 1,289,057 |
| `assets/characters/reading_states/ai_reading_state_demo.gif` | 3,250,549 |
| `assets/characters/reading_states/ai_reading_state_storyboard.jpg` | 492,961 |
| `assets/pet_homes/pet_home_ui_concept.png` | 500,796 |
| `assets/pet_homes/four_homes_enlarged_reference.png` | 1,249,462 |
| `assets/pet_homes/four_homes_overview_concept.png` | 2,755,102 |
| `assets/pet_homes/full_product_flow_concept.png` | 2,765,300 |
| `assets/pet_homes/four_homes_candidate_crop.png` | 1,422,572 |
| `docs/ASSET_MANIFEST_V3.md` | 4,386 |
| `docs/PHASE1_REQUIREMENTS_AND_LIMITS.md` | 2,100 |
| `README_v3_导入说明.txt` | 550 |

## 问山_四灵宠四状态设定包.zip

- 解码名称 `问山_四灵宠四状态设定包.zip`
- 大小 6,025,552 字节
- SHA-256 `423ea900e30f2f09bd870b69e4c2351a1a6f4ecba9d38ced2505b1f9675ebae7`
- 校验通过，已导入

| 内部路径 | 字节 |
|---|---:|
| `04_玄机_四状态与成长.png` | 296,032 |
| `01_小卦_四状态与成长.png` | 297,113 |
| `灵宠居所及养成系统总览.png` | 2,563,387 |
| `README_设计规范.md` | 2,337 |
| `03_青朴_四状态与成长.png` | 283,064 |
| `02_云爻_四状态与成长.png` | 272,925 |
| `四灵宠四状态成长总览.png` | 2,440,752 |

## 问山_四灵宠_小短脚轻摇动效_v6.zip

- 原 ZIP 大小 26,636,201 字节，导入前核对路径、CRC 和 50 项 SHA-256，导入到 `assets/companions-v6/`，共 51 个文件。
- `assets/companions-v6/assets/approved/` 存放透明定稿及参考姿态。`previews_webp/` 下每只 120 帧的透明预览用于对照动作幅度和节奏。
- `assets/companions-v6/assets/rig_layers/` 的 16 张 PNG 经 `scripts/prepare-pets-v6.py` 生成 `public/art/companions-v6/` 下的透明 WebP 身体、视线、眨眼和配饰层。
- `scripts/prepare-companion-motion.py` 从这些运行图提取嘴、帽檐和铜钱，合并为 `public/art/companion-motion/` 的四张透明图集。图集是实时网格渲染用的静态纹理，原 v6 分层图仍用于静态显示。
- 小卦和青朴的挠头图层来自各自已有的 `public/art/*-paw.webp`，缩成贴着身体的圆点大小后写入对应图集。
- 图集的第九格存放按各角色口部原色绘制的圆嘴，用于轻撅时与常态嘴型过渡。

## v1.6 统一素材包

- 原 ZIP 132,980,199 字节，SHA-256、CRC、路径和清单均已核对。469 个文件保存在 `assets/imports/wenshan-v16/`。
- `scripts/prepare-pet-v16.py` 生成 `public/art/pet-v16/` 的 20 份逐套动作精灵表、四间房间、12 张身形预览、13 个玩具与装饰 SVG，动作顺序写入 `src/data/pet-v16-motions.json`。
- 各角色原始定稿、320 个关键帧、24 帧预览和旧代码参考留存。概念试验图继续隔离。[集成与核验](PET_V16_INTEGRATION_REPORT.md)

## 面部精修动作表

- 四只各五张新版透明 PNG 存于 `assets/derived/pet-expression-sheets/`。每张 2160 × 1640，16 格从左到右、自上而下。沿用正式角色图，新增独立的眨眼压缩和笑嘴层。原 v1.6 动作表保留在独立目录。
- `public/art/companion-expressions/` 存放实时使用的角色纹理和精选精灵图，均由本机程序生成。[小卦扶帽](../assets/derived/pet-expression-sheets/xiaogua/adjust_hat.png) · [云爻打盹](../assets/derived/pet-expression-sheets/yunyao/sleepy_blink.png) · [青朴点头](../assets/derived/pet-expression-sheets/qingpu/sun_nod.png) · [玄机看星](../assets/derived/pet-expression-sheets/xuanji/stargaze.png)
