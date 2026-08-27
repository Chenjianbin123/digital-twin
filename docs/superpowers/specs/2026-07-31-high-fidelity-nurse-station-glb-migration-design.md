# 高精度护士站 GLB 替换设计

## 目标

将当前前端加载的旧护士站 GLB 替换为已经确认的高精度护士站模型，同时保留现有视频、工作看板、时钟、病房标记和加载失败回退行为。

迁移采用新文件名发布，不覆盖旧 `smart_ward_nurse_station.glb`。验证完成前，旧 GLB 保留为可恢复产物。

## 文件边界

新增独立导出脚本 `scripts/export_high_fidelity_nurse_station_glb.py`，只读取：

`public/models/smart-ward-nurse-station/high_fidelity_nurse_station.blend`

并输出：

`public/models/smart-ward-nurse-station/high_fidelity_nurse_station.glb`

前端只修改 `src/core/area-scene.ts` 中的 `NURSE_STATION_MODEL_URL`。不修改护士站交互、病区数据、动态屏幕纹理生成、病房标记和走廊入口逻辑。

## 导出隔离

导出脚本在 Blender 后台进程中打开高精度 `.blend`，只修改内存中的导出场景，不保存回源文件。

导出前执行以下处理：

- 将 `Floor` 与 `Ceiling` 的纵深从 `30m` 收敛到 `9.7m`，中心调整到 `y=1.3m`。保留前景护士台到后墙的完整空间，避免前端按包围盒缩放时模型主体变得过小。
- 不导出 `Reference_Camera` 和场景灯光，继续使用 Three.js 场景现有相机和灯光。
- 将所有 `FONT` 对象转换为网格，确保护士站、走廊导视和信息墙中文不依赖浏览器本机字体。
- 保留模型材质、UV、倒角效果和对象层级；应用导出所需的变换与可见修改器。
- 不保存经过裁剪、重命名或文字转网格后的临时场景。

## 动态屏幕兼容

前端当前按固定对象名挂载六块动态纹理：

- `Screen_Main`
- `Screen_Work_01`
- `Screen_Work_02`
- `Screen_Work_03`
- `Screen_Work_04`
- `Clock_Display`

高精度模型已经包含 `Screen_Main` 与 `Clock_Display`。导出阶段将：

- `Monitor_Screen_01` 重命名为 `Screen_Work_01`
- `Monitor_Screen_02` 重命名为 `Screen_Work_02`
- `Monitor_Screen_03` 重命名为 `Screen_Work_03`
- `Monitor_Screen_04` 重命名为 `Screen_Work_04`

为避免静态预览内容覆盖动态纹理，导出时隐藏：

- `Monitor_UI_*`
- `Main_Board_Title`
- `Main_Board_Beds`
- `Main_Board_Tasks`
- `Main_Board_Bar_*`
- `Clock_Preview_Text`

护理白板、患者状态看板和走廊双语导视保持为静态模型内容。

## 前端切换与回退

`NURSE_STATION_MODEL_URL` 更新为：

`/models/smart-ward-nurse-station/high_fidelity_nurse_station.glb?v=20260731-wayfinding`

现有 `loadNurseStationModel()` 行为保持不变：

- 新 GLB 成功加载后隐藏程序化护士站和场景外壳。
- 加载失败时继续显示程序化护士站，不出现空白场景。
- 旧 GLB 文件保留，但不再作为默认 URL。
- 若上线后需要回退，只需恢复一个 URL 常量，不需要重新生成旧资产。

## 模型契约

新增 GLB 验证脚本，在空场景中导入输出文件并检查：

- 六个动态屏幕对象全部存在且为网格。
- `Nurse_Counter`、`Screen_Main`、`Clock_Display`、两侧走廊和两块导视牌存在。
- 导出文件不包含灯光和相机。
- 不再包含 `Monitor_UI_*`、主屏静态占位内容或 `Clock_Preview_Text`。
- 包围盒宽度、高度和纵深均大于零，纵深不超过 `10m`。
- 左右导视文字已经转换为网格。

前端边界测试同时锁定新的模型 URL 和缓存版本号。

## 验收

自动验收包括：

- Blender 导出命令退出码为 0。
- GLB 模型契约通过。
- `npm run build` 通过。
- 现有护士站场景边界和屏幕映射测试通过。

浏览器视觉验收包括：

- 护士站页面实际显示新模型，而不是程序化回退或旧 GLB。
- 两侧外移后的门组、双语导视牌和三块后墙信息面可见。
- 中央电视播放现有健康教育视频。
- 四台工作显示器显示现有动态看板，时钟正常刷新。
- 动态屏幕纹理方向正确，没有上下颠倒、镜像或静态几何遮挡。
- 房间状态标记、进入走廊按钮和页面交互保持可用。
- 桌面与移动视口没有明显裁切、黑屏或加载错误。
- 浏览器控制台没有模型对象缺失或 GLB 加载失败警告。

## 失败处理

- 导出失败时不修改前端 URL，也不删除旧 GLB。
- GLB 契约失败时保留失败文件供诊断，但不切换前端。
- 浏览器出现屏幕方向或构图问题时，只调整导出脚本或前端模型适配，不修改已确认的高精度 `.blend`。
- 前端验证失败时恢复旧 URL，程序化回退继续作为最终兜底。

## 明确不做

- 不覆盖或删除旧 `smart_ward_nurse_station.glb`。
- 不重做动态屏幕内容和业务数据映射。
- 不修改病房走廊、病房内部或病区切换逻辑。
- 不把 Cycles 灯光和相机带入 Three.js 运行时。
- 不在本次迁移中压缩纹理、引入 Draco 或更换 Three.js 加载器。
