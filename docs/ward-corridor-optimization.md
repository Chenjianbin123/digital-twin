# 病房走廊五阶段优化交付记录
日期：2026-09-12。范围：sceneType = ward。保留已有未提交改动，未提交或推送 Git。

## 已实现
1. 映射与边界：新增病区独立门位配置和会话内稳定分组；不再以刷新数组顺序决定房门身份。处理重复编号、配置冲突、缺失节点、空数据及超过十房的分页。未提供真实对应表时明确显示示意模式。
2. 导航与相机：新增房号导航、键盘操作、恢复总览；进入病房再返回保留选中，跨组定位，尺寸变化不重置相机。按完整命名门组定位并限制相机边界。修复告警横幅遮挡导航。
3. 性能：保留原模型，输出无损 WebP 优化 GLB。纹理签名去重、并发上限 2、合并排队更新、丢弃并释放过期结果；非活动场景暂停更新。无新增运行时依赖。
4. 视觉与信息：门位房号/告警/离线摘要、选中态、浅深主题、窄屏横向导航。保留原始模型几何、材质像素和已校准灯光，未进行破坏性风格重做。
5. 验收与文档：新增映射、屏幕缓存、资产一致性测试和可复用浏览器脚本；更新十门配置文档。

## 实测结果
- npm run build：通过，包含 vue-tsc 类型检查。
- npm test：475 项全部通过，无跳过。
- 本轮文件 diff --check：通过；全工作区检查仍包含原有 .gitignore 的 CRLF 空白提示，未改动无关文件。
- GLB：51,274,520 -> 42,798,412 字节，减少 16.53%。脚本验证转换图像 RGBA 完全相同；资产测试验证节点、网格、材质和非图像 bufferView 字节一致。
- 屏幕缓存：十轮十房不变更新仅渲染十次、跳过九十次；单房变化仅增加一次渲染。另覆盖竞态、失败重试、并发和队列合并。
- 真实 Chromium / 独立 mock 会话：301至310逐房选择、进入返回、Esc/方向键、数组重排、增加第十一房翻页、清空与恢复数据通过。
- 320/768/1024/1440 宽度导航不出界，恢复按钮无遮挡；浅深主题截图已生成并复核代表性截图。
- 注入 GLB 网络失败后出现 fallback 和重试；恢复网络重试成功。连续三次护士站/走廊切换，走廊模型资源记录由 1 保持为 1。
- 实际截图：output/playwright/ward-upgrade-final.jpg、ward-upgrade-final-mobile.jpg、ward-upgrade-dark.jpg。
- 浏览器验收脚本：scripts/verify-ward-corridor.pw.js，仅对独立 mock 会话运行。

## 关键文件
- src/config/ward-corridor-scene.ts：模型 URL、病区物理映射。
- src/core/ward-corridor-layout.ts：稳定分组、映射验证。
- src/core/ward-corridor-screen-cache.ts、ward-corridor-screens.ts：增量纹理调度。
- src/core/ward-corridor-markers.ts：状态标记。
- src/components/WardCorridorToolbar.vue：交互工具栏。
- src/core/area-scene.ts、src/components/AreaScene3D.vue、src/App.vue、src/stores/twin-store.ts：集成。
- docs/model-guides/ward-corridor-model-configuration.md：部署与配置说明。

## 尚需现场验证的边界
- 未获得真实病区房号与门位对应表，areaLayouts 保持空配置。示意分组不等于现场空间位置。
- 本地测试部分 /swp_upload/picture/template 图片返回 502；实际模板内容需在可访问医院资源的网络复验。模型请求失败为主动故障注入，不是正常加载失败。
- 保留显卡着色器精度提示与已有护士站调试警告；修复了走廊 polygonOffset 未定义的重复警告。
- 构建仍提示 RoomEnvironment 分块约 626.65 kB 大于 600 kB，未为消除提示改动共享渲染依赖。
- 无损模型缩小主要降低传输体积，未减少贴图分辨率，不能声称显存或帧率按同比例改善。医院目标设备的 FPS、显存及弱网耗时尚未实测。
