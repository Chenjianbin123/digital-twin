# 医院病区楼层 V4：护士站导航标志与高清定稿

2026-10-10。基于保留的 V3 原生模型制作。所有图像来自 Blender Cycles 实际渲染，无外围界面；纯色背景合成不替换模型内容。

## 本轮交付

- 中央护士站新增青绿色立体入口牌、医疗符号和“进入护士站”文字。支架位于背柜后缘，避开物资托盘。
- 深色场景采用独立灯光、暖色病房照明、护士站工作光和冷色轮廓光；两主题共享模型几何。
- 新增正俯视相机；检查病床、当前门扇、床旁桌、护士站背柜和通道关系，移除文档工位遗留键帽。
- 浅色鸟瞰 `light-model.png`、深色鸟瞰 `dark-model.png`、正俯视 `top-model.png`：3840×2560。
- 护士站 `station-model.png`、病房 `detail-model.png`：2400×1600。五张图均64采样。
- 原生模型：`output/hospital-floor-reference-v4/hospital-floor-reference-v4.blend`。透明PNG、导航数据、验证及渲染来源记录位于同目录。

## 后续点击护士站

本轮只交付模型入口标志与导航锚点，未安装网页点击事件，静态PNG本身也不能执行场景跳转。

| 用途 | 稳定标识 |
| --- | --- |
| 导航根对象 | `NurseStation_Navigation` |
| 定位锚点 | `NurseStation_ClickAnchor` |
| 可见标志网格 | `NurseStation_SignBody` |
| 护士站台体根对象 | `Central_Nurse_Station` |
| 导航ID | `floor-nurse-station` |
| 目标场景 | `nurse-station` |

`targetScene` 已对照当前 `src/types/twin.ts` 和底部导航的实际场景键。`navigation.json` 记录源文件哈希、对象名、锚点位置和接入状态。后续导出 GLB 时保留自定义属性为 glTF extras，并将文字转换为网格；Three.js 命中可见标志或护士站台体子网格后，沿父节点查找 `targetScene`，调用项目已有场景切换流程。悬停可高亮同一导航根对象，进入后需提供返回楼层的入口。

Blender 使用 Z 向上，Three.js/glTF 使用 Y 向上。应使用导出后锚点的世界变换定位，不要直接照搬 `anchorPositionBlenderZUp`。导出和点击跳转尚待网页接入时验证。

## 验证结果

原生源文件重开通过：8房16床，8个门口屏、16个床头屏；128个床轮轮胎及32个桌轮落地。三台设备位于各自停放框内。病床主体与当前门扇、床旁桌的静态包围盒无重叠；护士站背柜与座椅、标志支架与托盘物资无重叠。从鸟瞰、正俯视、护士站近景相机对锚点发射射线，均命中可见标志并解析到 `nurse-station`；这是离线几何检查，不是网页点击验收。

护士站北侧柜体至走廊墙面间距 1.26 米，南侧台面至走廊墙面间距 1.88 米。此项是模型尺寸测量，不是通行规范认证。

网格对象 5,255，求值三角面 2,550,908。两主题几何及鸟瞰相机一致、灯光对象独立；背景合成前模型像素的平均RGB差值 43.12/255，确认深浅差异来自实际渲染。五张图源文件及PNG哈希通过，V3源文件哈希未变化。

检查未覆盖门扇完整开合扫掠、全场景碰撞及建筑规范。尺寸来自通用展示设计，未依据医院实测平面图。

## 关键脚本

- `scripts/refine_hospital_floor_reference_v4.py`：加载V3、标志、夜间灯光、相机、渲染及导航元数据。
- `scripts/verify_hospital_floor_reference_v4.py`：结构、静态布局、导航和五视图验证。
- `scripts/present_hospital_floor_reference_v4.py`：验证后的纯色背景图、说明和交付ZIP。
- `scripts/verify_hospital_floor_reference_v1.py`：共享结构检查新增可选对象类型筛选，供V4允许主题灯光不同；默认行为保持。
