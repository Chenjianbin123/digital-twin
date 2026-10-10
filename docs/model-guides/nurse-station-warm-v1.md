# 浅木护士站参考图复建 warm-v1

2026-10-09。根据用户提供的 480×324 护士站参考图，重建浅灰白柜台、浅木饰面、暖白灯带和病房走廊。模型是单张图片的视觉复建，尺寸与不可见结构为设计假设，不是测绘或施工模型。

此版本独立交付，不替换现有护士站场景，不改业务数据、侧栏、主题或屏幕绑定代码。

## 交付文件

- 可编辑源文件：`output/nurse-station-warm-v1/nurse-station-warm-v1.blend`，保留分件、文字、倒角修改器和打包贴图。
- 运行时源文件：`output/nurse-station-warm-v1/nurse-station-warm-runtime.blend`，静态部件合并，屏幕保持独立。
- 前端资产：`public/models/smart-ward-nurse-station/nurse-station-warm-v1.glb`。
- Blender 实渲：`output/nurse-station-warm-v1/nurse-station-warm-hero.png`，1920×1296，Cycles 64 采样并降噪。
- 参数和统计：`output/nurse-station-warm-v1/manifest.json`。
- 构建入口：`scripts/build_nurse_station_warm_v1.py`；分件脚本为 `nurse_warm_architecture.py`、`nurse_warm_desk.py` 和 `nurse_warm_furnishings.py`。

`output/` 是本地生成目录。交接时应保留其中的 `.blend` 文件，不能只交接脚本。旧模型未覆盖。

## 模型结构

柜台使用圆角薄壳、高低双层工作面、凹入踢脚、连续细灯带、面板接缝和立体字。后方保留护士出入口，台面不封闭成实心块。四组电脑、办公椅、键鼠、文件架、手卫生设备、护理推车及绿植按近景需要建模；远处重复建筑适度简化。

室内保留左侧长走廊、右侧七组病房门、门口屏、扶手、木饰柱、采光窗、吊牌和顶部环形灯带。病房门的观察玻璃有真实开口，不只是贴在门上的图案。木饰面、地板、织物使用内嵌颜色、粗糙度及法线贴图。

Blender 使用米制、Z 向上、走廊延伸方向为 +Y。柜台宽约 5.6 m，公共台面高 1.07 m，内部工作面高 0.75 m，建筑层高 3.15 m。以上尺寸用于参考图复建，不代表无障碍、医疗建筑或消防合规认证。

glTF 为 Y 向上，坐标换算为 `[x, z, -y]`。根节点为 `NurseStationWarmV1`；第一层分组为 `Architecture`、`Desk`、`Equipment`、`Foliage`。主机位与目标点见 `manifest.json`，不要套用旧模型的相机或缩放参数。

## 屏幕接口与接入边界

13 块屏幕均为独立网格，具有完整 UV 和专用材质，不与静态主体合并：

| 名称 | 数量 | 用途 |
| --- | ---: | --- |
| `Screen_Main` | 1 | 病区概览 |
| `Screen_Work_01` 至 `Screen_Work_04` | 4 | 工作电脑 |
| `DoorScreen_301` 至 `DoorScreen_307` | 7 | 门口屏模板 |
| `Clock_Display` | 1 | 时钟 |

屏幕携带 `runtimeSurface`、`screenRole` 和 `contentSource` 元信息。现有画面全部是合成预览，时钟固定为 12:00；它们不是实时业务数据。301 至 307 仅为本模型的示意房号，不得直接作为生产房间或设备映射。

此模型不含旧场景的 `Screen_Service` 和 `Screen_Video`。正式替换前，需要适配场景布局、业务屏与视频屏需求、门口屏设备映射、双主题和相机边界，不能只修改 GLB 地址。

GLB 使用项目已有的 Draco 解码能力，位置 18 位、法线 14 位、UV 16 位；图片全部内嵌。灯光和相机只留在 Blender 文件中，不导出到 GLB。网页灯光、阴影和色彩管理需单独调试，离线渲染不等于网页验收。

## 重建与检查

在项目根目录运行，使用本地 Blender 4.5.3 LTS 和 Windows 微软雅黑字体，无需新增依赖：

```powershell
& 'E:\projects\digital-twin\output\tools\blender\blender-4.5.3-windows-x64\blender.exe' --background --threads 6 --python-exit-code 1 --python scripts/build_nurse_station_warm_v1.py -- --width 1920 --samples 64
node --test scripts/nurse-warm-model.test.mjs
```

`--skip-render` 仅跳过渲染，`--skip-export` 仅跳过 GLB 导出。重新生成会覆盖本版本目录及 GLB，不写入旧模型路径。可编辑源文件在静态合并之前保存。

最终导出为 5,260,876 字节（约 5.26 MB），261,649 个三角面。1920×1296 实渲已完成并检查；六项模型测试全部通过，实际解码 Draco 几何，覆盖内嵌资源、根节点、屏幕隔离、屏幕朝向和 UV、柜台中央与后入口通透性、生产配置隔离。

可编辑 `.blend` 已重新打开验证：13 块屏幕、770 个保留修改器的对象、25 张已打包图片，渲染设置为 1920×1296。代码审查针对 U 形台面三角化、屏幕独立导出和 UV 朝向补充了回归检查。

这些检查不能代替浏览器的材质、交互和低配置机器性能测试。本次不运行医院接口、不替换生产配置、不创建 Git 提交。
