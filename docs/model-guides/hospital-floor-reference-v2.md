# 医院楼层模型 V2

2026-10-09。对保留的 V1 楼层模型进行病区场景精修，仅交付纯模型图，无界面叠加。所有图像来自保存的 Blender 源文件，背景合成不改变模型渲染像素。

## 本轮变化

- 改为斜向剖切鸟瞰，屋顶与部分墙体剖切以展示空间。
- 中央走廊边界间距扩为 6.28 米，为中央护士站两侧留下通行空间。
- 加入分段防撞带、扶手、实体房号牌、呼叫指示灯、手消毒器和床间帘。
- 前排4间病房采用滑门示意，后排采用内开门；保持8房16床。
- 增加治疗车、急救车、轮椅停放位、治疗准备区、处置床、分类容器及卫生间隔间。
- 补齐配套区导视及有实际门洞的出口示意。
- 两种主题共享相同几何和相机，改变环境光与背景。

## 文件

- 原生源文件：`output/hospital-floor-reference-v2/hospital-floor-reference-v2.blend`
- 纯模型图：`light-model.png`、`dark-model.png`、`detail-model.png`
- 原始透明渲染：`light.png`、`dark.png`、`detail.png`
- 源文件验证：`validation.json`；图像验证：各 `*-render-settings.json` 及 `presentation.json`
- 建模：`scripts/refine_hospital_floor_reference_v2.py`
- 验证：`scripts/verify_hospital_floor_reference_v2.py`
- 背景合成：`scripts/present_hospital_floor_reference_v2.py`

## 验证

源文件重开通过。8个房间、16张床、8个门口屏、16个床头屏、8个呼叫指示灯、2辆临床推车、4个滑门；两主题的相机及几何一致。128个床轮轮胎落地检查通过。网格对象 5,018，求值三角面 2,482,188。三张正式图均为2000×1333、48采样，源文件和PNG哈希一致。V1源文件哈希未变化。

这是医院病区的视觉设计示意，未以实测建筑平面图建模；不代表医疗建筑、消防、无障碍等工程规范验收。检查未覆盖门扇全行程及设备扫掠体。未修改网页场景或接入实时数据。
