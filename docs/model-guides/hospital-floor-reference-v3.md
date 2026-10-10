# 医院楼层模型 V3

2026-10-09。在 V2 原生模型上精修，保留旧版。四张图均由 Blender 源文件实际渲染，再合成纯色背景，无外围界面。

## 本轮精修

- 护士站保留两组坐席，中央设文档与打印区；增加三组背柜、资料架及物资托盘。
- 治疗准备区和处置区增加封闭柜、台面、挡水墙面、检查灯和隐私屏风。
- 每间病房增加一张带脚轮的可移动床旁桌，共八张；完善墙裙和床头屏示意内容。
- 急救车、治疗车、轮椅设三个独立停放位；调整等候座椅。
- 卫生间增加镜面、卫生用品盒、隔间五金；细调医用地胶、木纹、墙面和金属材质。

## 交付文件

- 原生模型：`output/hospital-floor-reference-v3/hospital-floor-reference-v3.blend`
- 浅色鸟瞰：`light-model.png`；深色鸟瞰：`dark-model.png`
- 病房近景：`detail-model.png`；护士站近景：`station-model.png`
- 原始透明图：`light.png`、`dark.png`、`detail.png`、`station.png`
- 建模脚本：`scripts/refine_hospital_floor_reference_v3.py`、`scripts/hospital_floor_furnishings_v3.py`
- 验证及背景合成：`scripts/verify_hospital_floor_reference_v3.py`、`scripts/present_hospital_floor_reference_v3.py`
- `validation.json`、`*-render-settings.json`、`presentation.json` 记录结构、渲染来源及哈希。

Blender 中使用 `Floor_Light` / `Floor_Dark` 场景，两主题共享几何与鸟瞰相机。局部相机为 `Floor_Detail_Camera` 和 `Nursing_Detail_Camera`。

## 实际验证

源文件重新打开检查通过：8房16床，8个门口屏、16个床头屏；128个床轮轮胎及32个桌轮落地；三台移动设备均位于各自停放框内。新增9组储物柜、8张床旁桌。两主题几何与鸟瞰相机一致，字体和图片依赖已打包。

网格对象 5,246，求值三角面 2,544,336。鸟瞰图2000×1333，近景1600×1067，均64采样；四张图的源文件与PNG哈希验证通过。V2源文件哈希未变化。

这是通用医院病区的视觉设计模型，未依据实测平面图建模；未进行建筑规范或全场景碰撞验收。本轮未导出网页GLB或接入项目页面。
