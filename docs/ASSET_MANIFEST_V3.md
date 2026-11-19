# 问山｜v3 增量素材清单（自 v2 后）

> 此 ZIP 为 **v3 增量包**。请先解压 v1、再解压 v2，然后将本包解压到同一项目根目录。四灵宠四状态设定 ZIP 另解压到 `assets/growth/concept/`。

## 已确认的权威素材与优先级
1. **角色身份与造型唯一真源**：`assets/reference/characters_4_approved.png`（来自 v1）。小卦=斗笠/铜钱/芽，云爻=白云团/金卷云/光环，青朴=绿叶帽/露滴，玄机=黑色星团/金环/阴阳饰。
2. **首页画面参考**：`assets/scenes/01_entrance/homepage_3d_concept.png`（v1）；画面里的宠物、建筑、雾是烘焙在同一张图中的，不能直接视作分层模型。
3. **问心台候选**：`assets/scenes/02_wenxintai/`（v2，四张候选，选择与现有设计最一致者，UI动态内容另行绘制）。
4. **观卦阁候选**：`assets/scenes/03_guanguage/guanguage_v01_reading_scene.png`（v2；卦名与卦辞是占位，不能作为计算结果）。
5. **宠物养成视觉**：本项目 `assets/pet_homes/` 和单独四状态 ZIP 均为概念参考，不能直接当作可点击场景/3D模型。

## 本包 v3 新增文件
- `assets/transitions/01_entrance_to_divination/cloud_pushthrough_concept.gif`：原文件 `问山_第一幕穿云进入问心台_镜头转场预览.gif`，9.9 MB。
- `assets/transitions/01_entrance_to_divination/cloud_pushthrough_storyboard.jpg`：原文件 `问山_穿云转场_关键帧预览.jpg`，0.2 MB。
- `assets/transitions/02_coin_toss/coin_camera_up_overhead_landing.gif`：原文件 `问山_三枚铜钱升空俯视落地_镜头预演.gif`，7.7 MB。
- `assets/transitions/02_coin_toss/coin_camera_six_step_storyboard.jpg`：原文件 `问山_铜钱镜头_六步分镜预览.jpg`，0.7 MB。
- `assets/transitions/03_divination_to_reading/hexagram_to_scroll_transition.gif`：原文件 `问山_问心台进入观卦阁_六爻升空镜头转场预览.gif`，0.7 MB。
- `assets/transitions/03_divination_to_reading/hexagram_to_scroll_storyboard.png`：原文件 `问山_问心台至观卦阁_六幕转场分镜.png`，1.2 MB。
- `assets/characters/reading_states/ai_reading_state_demo.gif`：原文件 `问山_观卦阁_AI解读宠物交互_状态动画预览.gif`，3.1 MB。
- `assets/characters/reading_states/ai_reading_state_storyboard.jpg`：原文件 `问山_观卦阁_AI解读宠物交互_四状态分镜.jpg`，0.5 MB。
- `assets/pet_homes/pet_home_ui_concept.png`：原文件 `问山_灵宠居所_UI概念预览.png`，0.5 MB。
- `assets/pet_homes/four_homes_enlarged_reference.png`：原文件 `问山_四灵宠专属居所_视觉放大预览_v1.png`，1.2 MB。
- `assets/pet_homes/four_homes_overview_concept.png`：原文件 `a_highly_detailed_polished_game_ui_concept_board.png`，2.6 MB。
- `assets/pet_homes/full_product_flow_concept.png`：原文件 `a_detailed_highly_polished_game_ui_concept_collag.png`，2.6 MB。
- `assets/pet_homes/four_homes_candidate_crop.png`：原文件 `问山_四灵宠专属居所_放大预览.png`，1.4 MB。

## 资源使用须知
- GIF/PNG/JPG 多为概念图与动态分镜，未提供可自由控制的 3D 模型及分层动画。
- 由程序渲染动态卦象、爻辞和 AI 内容；严禁将概念图中的卦象和文本当成真实用户结果。
- 不得将小卦的帽子/吊饰套到云爻、青朴、玄机身上。
- 图片若带背景，不要直接在同一张画面重复叠放同一只宠物；必要时先制作遮罩/透明图作为阶段性占位。
- 临时资产/占位应在代码中显式标记；后续可使用独立 Three.js 铜钱模型、CSS/Framer Motion 场景过渡。
- 接口调用与成长数据不应把用户的敏感提问信息发送给未经授权的第三方。

## 分类
- **01_entrance_to_divination**：镜头推进、近景缩放、穿雾与进入下一场景的2.5D概念，非真正可自由漫游3D。
- **02_coin_toss**：三铜钱起落、从下仰跟拍到俯拍的概念分镜；真正结果应由程序生成并与画面一致。
- **03_divination_to_reading**：六爻升空到观卦阁的示例卦象；最终必须显示用户真实卦象。
- **reading_states**：观卦阁宠物等待、思考、讲解、完成四种UI状态演示，不是角色骨骼动画。
- **pet_homes**：宠物居所与产品流程概念图；可能包含错误/占位文字，不能直接烘焙为实时UI。
