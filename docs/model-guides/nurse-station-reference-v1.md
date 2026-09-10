# 护士站参考图建模第一版

## 设计目标和当前阶段

依据用户确认的暖白、浅木色护士站参考图，制作可编辑的三维设计预览。
第一阶段交付实际模型的渲染图、Blender 源文件和评审 GLB；暂不切换正式页面。
当前 `src/config/nurse-station-scene.ts` 中的 `maxSize` 是运行时缩放上限，不是现场测量尺寸。

设计采用 9.23 m 宽、1.08 m 深、1.097 m 高的护士台和 3.39 m 顶部空间。
这些是初步设计尺寸，后续应结合现场资料与当前项目的等比缩放一起校核。

## 实际产物

目录：`output/nurse-station-reference-v1/`。

- `front.png`：正面偏左的主视角。
- `detail.png`：护士台和材质近景。
- `wall.png`：后墙主屏特写。
- `nurse-station-design-v1.blend`：包含材质、照明、相机和示例屏幕内容的源文件。
- `nurse-station-design-v1.glb`：用于结构评审的导出文件。
- `textures/`：随源文件保存的材质图片。
- `model-report.json`：生成时的节点与设计说明。

## 外观设计

柜台白色面板与木饰面之间采用连续曲线过渡；木饰面内退，避免表面重叠。
柜台下方保留金属踢脚，上下灯槽使用独立几何；后墙设置木饰面柜体和一块主信息屏。
屏幕上方与前景设备保持高度差，保留四个工作位、圆形时钟及两侧通道导视。

## 动态屏幕接口

`Screen_Main` 和 `Screen_Work_01` 至 `Screen_Work_04` 是各自独立的平面网格，
每块只有两个三角形、完整 0–1 UV 和 `displayRole` 元数据。
主屏与工作位屏幕正面朝向不同，接入时应使用网格自身的世界变换。
`Screen_Main_Frame`、`Workstation_01` 至 `Workstation_04` 保留为定位入口。

主屏预览显示“演示数据”，其卡片与文字均以 `Preview_` 命名，并排除在 GLB 之外。
正式接入时须由现有护士站数据绘制纹理，不使用这些示例数字。

`Clock_Display` 是独立圆形钟面，仍需增加模拟时钟绘制，或改成当前项目使用的数字时钟面。
本版不是当前页面的直接替换产物：还需验证相机、等比缩放、动态屏幕绑定、离线状态和运行时光照。

## 重建与验证

使用 Blender 4.5.3 LTS。便携环境安装于 `output/tools/blender/`，不属于发布资源。
不直接运行旧的 `render_high_fidelity_nurse_station.py`；新脚本只复用其中的几何和灯光工具函数。

```powershell
& 'output/tools/blender/blender-4.5.3-windows-x64/blender.exe' -b --python scripts/design_nurse_station_reference.py -- --samples 48 --width 1920 --views front detail wall
node scripts/validate_nurse_station_design.mjs
```

验证脚本独立读取导出的 GLB，检查文件长度、关键节点、独立屏幕、UV、法线及示例内容排除。
这不是完整的 Khronos glTF Validator 或浏览器性能验收。

## 下一阶段

依据实际渲染图修订造型和材质后，完善设备细节、隐藏面清理、材质合并、纹理压缩和光照烘焙。
网页接入后再评估画质、加载时间、绘制调用、帧率和屏幕实时更新；离线渲染质量不能直接等同于网页画质。

导出参数参考：[Blender 官方 Python 导出接口](https://docs.blender.org/api/main/bpy.ops.export_scene.html)。
