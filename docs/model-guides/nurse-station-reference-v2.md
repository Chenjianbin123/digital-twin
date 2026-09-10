# 护士站第二版精修

本版接续第一版造型评审，聚焦材质、工位结构、光照和走廊纵深。
独立保存在 `output/nurse-station-reference-v2/`，第一版源文件和正式页面保持原状。

## 主要变化

- 木材、人造石、地胶、座椅织物各自配套颜色、法线与粗糙度图片，嵌入导出 GLB。
- 接待台面约 1.097 m 高，新增约 0.79 m 高的坐姿工作台；工作侧开敞，并补齐台面收口、抽屉、腿部空间及侧支撑。
- 工作位增加独立键帽、鼠标垫、显示器支架、过线孔、电源接口及线缆。
- 后墙柜体整体后移 1 m，椅子相应后移，为工位和后方路线留出空间。这是设计尺寸调整，尚未与现场测量校核。
- 增加侧向日光和分层补光，保留灯槽；材质使用各自的反射粗糙度。
- 两侧走廊新增内墙、踢脚、门窗框、门口设备、门槛及远端玻璃窗。扶手在门前断开。
- 补齐工作侧反向视角可见的大厅背景。

## 产物和重建

输出目录包含 `nurse-station-design-v2.blend`、`nurse-station-design-v2.glb`、`textures/`、`model-report.json`。
主视角、柜台近景、主屏和护士工作侧分别为 `front.png`、`detail.png`、`wall.png`、`workstation.png`。

```powershell
& 'output/tools/blender/blender-4.5.3-windows-x64/blender.exe' -b --python-exit-code 1 --python scripts/refine_nurse_station_reference.py -- --samples 48 --width 1920 --views front detail wall workstation
node scripts/validate_nurse_station_design.mjs output/nurse-station-reference-v2/nurse-station-design-v2.glb --refined
```

精修脚本读取第一版 `.blend`，在内存中修改后另存 v2；重建 v2 仍需要保留第一版源文件。
通用导出函数新增可选版本号，第一版默认行为不变。

## 验证范围和后续工作

生成时检查四个工作屏的世界坐标、朝向和有限顶点坐标。
独立 GLB 验证检查文件结构、五个显示面、UV、法线、示例内容排除、15 个抽屉、工作台高度及四类 PBR 贴图。
预览主屏仍为演示数据，工作位屏幕保留空白绑定面；未改变当前项目的数据源和业务代码。

本版仍为三维设计评审，尚未进行正式页面接入、运行时光照烘焙、静态网格合并、纹理压缩或设备帧率验收。
模拟圆形时钟仍需单独适配，不应直接使用现有数字时钟纹理替换。
