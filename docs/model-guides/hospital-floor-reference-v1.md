# 医院楼层鸟瞰 Blender V1

2026-10-09。根据已确认的浅深色概念图重建可编辑楼层，所有模型图由 Blender Cycles 实际渲染。界面预览是实际渲染图与静态界面框架的排版合成，不是已接入网页的截图。

## 交付

- 源文件：`output/hospital-floor-reference-v1/hospital-floor-reference-v1.blend`
- 场景：`Floor_Light`、`Floor_Dark`；共享几何和全景相机，分别保存环境光与主题背景。
- 全景相机：`Floor_Overview_Camera`；近景相机：`Floor_Detail_Camera`。
- 模型图：`light-model.png`、`dark-model.png`、`detail-model.png`。
- 项目风格预览：`light-project-preview.png`、`dark-project-preview.png`；总览 `comparison.png`。
- 原始透明渲染：`light.png`、`dark.png`、`detail.png`。
- 对照参考、贴图、字体已经打包在 `.blend` 中。

## 模型与项目约定

8 间双床病房、16 张独立实体病床，中央弧形护士站、3 个工作位、电梯厅、卫生及储物配套。病床包含可编辑护栏、控制键、双轮脚轮、床品褶皱、床头气电接口、呼叫手柄、床头屏、床头柜和输液架。

根节点 `Hospital_Floor_Reference_V1`；房间 `Room_101` 至 `Room_108`。床位有独立 `bedId`、`roomId`、`slot`，8 个门口屏和16个床头屏具有设备角色节点。标识均为示例；生产接入应显式映射真实病区、房间和床位标识，不能以数组顺序直接绑定。`Preview_Graphics` 可隐藏，房间标签、选中框是展示层。

示意层尺寸约25.5×14.66米，来自视觉推定，没有实测建筑底图。参考图局部尺寸、遮挡结构、文字和数量存在AI不一致，已按8房16床落实；不宣称百分百像素一致、BIM或工程合规。当前未导出网页GLB、未修改项目运行场景。

## 实际验证

- 重开源文件通过：房间 8，实体床位 16。
- 网格对象 4,786，求值后三角面 2,382,680。
- 128 个脚轮轮胎落地检查，最大误差 0.00000001 米。
- 床体未越出房间地面范围、双床未重叠；两场景共享相同几何和相机。
- 3 张最终渲染通过源文件 SHA256、PNG SHA256、尺寸和采样数检查。
- 检查范围不包括通道/设备扫掠体、工程规范和网页性能。

## 重建

从项目根目录使用 Blender 4.5.3：

```powershell
& 'output/tools/blender/blender-4.5.3-windows-x64/blender.exe' --background --threads 8 --python-exit-code 1 --python scripts/build_hospital_floor_reference_v1.py -- --skip-render
& 'output/tools/blender/blender-4.5.3-windows-x64/blender.exe' --background --threads 8 --python-exit-code 1 --python scripts/build_hospital_floor_reference_v1.py -- --render-only --width 2400 --samples 64 --views light dark detail
& 'output/tools/blender/blender-4.5.3-windows-x64/blender.exe' --background --threads 8 --python-exit-code 1 --python scripts/build_hospital_floor_reference_v1.py -- --denoise-only --views light dark detail
& 'output/tools/blender/blender-4.5.3-windows-x64/blender.exe' --background --threads 6 --python-exit-code 1 --python scripts/verify_hospital_floor_reference_v1.py
```

最后使用装有 Pillow 的 Python 运行 `scripts/package_hospital_floor_reference_v1.py`，生成界面排版图和ZIP。原始EXR为重渲染中间文件，不装入交付包。
