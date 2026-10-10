# 银白科技护士站模型（2026-09-29）

## 交付范围与边界

根据本次会话最后一版“墙挂电视”效果图重建，使用 Blender 4.5.3 LTS 实际建模、Cycles 渲染，并导出 Three.js 可加载的 GLB。参考图副本位于 `output/nurse-station-silver-v1/reference-wall-tv.png`。

这是一份按图重建的可编辑设计模型，不是实测 BIM，也不是百分百像素复原。单张概念图不能确定尺寸、背面结构和镜头参数。柜台进深、工作人员通道、设备摆位属于设计推定；柜体比例、金属反射、走廊透视与原图仍有差异。电视内容为单独制作的演示界面，不含参考图中的人物视频。

2026-09-29 已将正式 `nurse-station-scene.ts` 切换至 `silver-v1`，复用现有医院数据 ViewModel，没有修改接口或患者数据逻辑，也没有创建 Git 提交。旧 GLB 和 `legacyNurseStationSceneConfig` 均保留，可整体回退配置。

## 文件

- 可编辑源文件：`output/nurse-station-silver-v1/nurse-station-silver-v1.blend`
- 网页模型：`public/models/smart-ward-nurse-station/nurse-station-silver-v1.glb`
- 建模脚本：`scripts/build_nurse_station_silver_v1.py`
- 实际渲染：`output/nurse-station-silver-v1/front.png`、`detail.png`、`wall.png`、`staff.png`
- 导出清单：`output/nurse-station-silver-v1/manifest.json`
- 独立验收页面：`http://localhost:5173/scripts/fixtures/nurse-silver-preview.html`（需要 Vite 开发服务）
- 网页截图：`output/playwright/nurse-silver-*.png`

`output/` 被 Git 忽略。`.blend` 内已打包贴图和中文字体；如需清理输出目录，先另行备份源文件和渲染图。不要把 GLB 当作可编辑分件源文件的替代品。

## 建模内容

银色弧形柜台、白色台面、青蓝嵌条与灯带、低位服务台、圆角金属吊楣、立体“护士站”文字、吊顶分缝和嵌灯、后墙柜与抽屉、文件盘与文件夹、插座、四个护士工作位和一个服务终端、显示器支臂与走线、键盘鼠标、五脚办公椅、主信息屏、挂钟、墙挂电视及独立壁挂支架。

材质包含金属、石材、地坪、门板和椅面织物的图像化基础色、粗糙度、法线贴图。`.blend` 保留分件；导出副本按材质合并静态物体，屏幕、电视框与挂架保持独立。源文件中的 `PREVIEW_ONLY` 集合只用于说明屏幕位置，35 个演示对象不导出，防止静态假数据遮挡后续真实数据。

设计尺寸：吊楣 10.4 × 4.25 米，室内顶高 3.44 米，主柜台高 1.202 米，低位台面高 0.795 米。未进行施工或无障碍规范验收。

## 屏幕接口

| 节点 | 用途 | 比例 |
| --- | --- | --- |
| `Screen_Main` | 病区主看板 | 2.25:1 |
| `Screen_Work_01` ～ `04` | 四个护士工作屏 | 16:9 |
| `Clock_Display` | 独立钟面 | 圆形，半径 0.222 米 |
| `Screen_Video` | 墙挂宣教电视 | 16:9 |
| `Screen_Service` | 低位服务终端 | 16:9 |

七个矩形显示面均为独立四边形，具有 0～1 UV；glTF 的顶部 V=0，绑定 CanvasTexture / VideoTexture 时设置 `flipY=false`。面板位于边框前方，启用正常深度测试、深度写入，不允许穿墙显示。

验收页直接复用 `bindReferenceStationDisplays` 绑定主屏、四个工作屏和时钟；视频和服务终端另外绑定。视频使用真正的 HTMLVideoElement + VideoTexture，不是定时切换静态贴图。本地视频不会上传。没有接入医院宣教地址，浏览器验证使用合成视频流，建议实际素材提供 16:9、浏览器可解码的 MP4 / WebM；非 16:9 素材的留黑适配不在本次范围内。

## 正式运行配置

模型以米为单位，Blender Z 向上，glTF Y 向上、正面朝 +Z。不要直接套用旧 `legacy` 包围盒归一化，也不要调用 v2 的 `adaptReferenceWallDisplay`：该函数会额外缩放主屏并移动时钟，破坏本版构图。

正式页面已完成新布局、相机/边界、银白/蓝灰双主题、实时 PBR 灯光及视频生命周期接入。`silver-nurse-station.ts` 保留作者贴图，不调用旧模型缩放和 v2 屏幕扩宽。主屏、四个工作屏、服务屏共六个业务屏共享现有数据，另有实时挂钟；工作屏和服务屏使用原生 16:9 画布。服务屏展示病房状态。

`educationVideoUrl` 默认空串，电视显示“暂无视频”，不下载或自动播放仓库旧演示视频。设置经过确认、浏览器可解码的 16:9 同源/允许跨域地址后，电视静音循环播放；切换走廊、页面隐藏或场景停用时暂停，卸载时移除视频源并释放纹理。加载失败和自动播放受限有明确文字提示。医院视频源及真实登录数据未验收。

摄像机使用模型本地可活动内边界，避免把已合并的建筑网格误认为单面墙；限制覆盖地板、天花板、侧墙及后墙，不是对每件家具的碰撞检测。首屏镜头兼顾现有侧栏和墙挂电视，窗口缩窄时保留横向视野。

Cycles 使用光线追踪；网页预览使用实时 PBR 灯光，反射与接触阴影不可能天然一致。本版没有把 Cycles 灯光当作已经适配到业务场景的证据。

## 复现

```powershell
& 'output/tools/blender/blender-4.5.3-windows-x64/blender.exe' --background --python-exit-code 1 --python scripts/build_nurse_station_silver_v1.py -- --width 1920 --samples 64 --views front detail wall staff
node --test scripts/nurse-silver-model.test.mjs src/core/reference-nurse-station.test.ts
npm run build
```

全景使用 64 采样，近景最多 32 采样，均启用降噪。源文件先保存，导出时仅基础色采用 JPEG，法线与粗糙度保持无损；之后重新打开源文件，以完整源材质渲染。

浏览器检查脚本为 `scripts/verify-nurse-silver.pw.js`，通过 Playwright CLI 的 `run-code --filename` 执行。验收项目包括实际 GPU 屏幕像素、视频两角方向标记、播放时间推进、重复启停资源释放、无效视频、键盘操作、320/768/1024/1440 窗口和模型加载失败重试。

## 已测数据

最终 GLB：12,426,560 字节（约 11.85 MiB），167,142 三角面，36 个静态/动态网格，15 张内嵌材质贴图；不是低配置设备帧率保证。模型二进制契约检查与已有屏幕绑定测试合计 8 项通过。

2026-09-29 验收结果：

- Blender 源文件重新打开成功：638 个源对象，15/15 图片已打包，Microsoft YaHei 字体已打包；4 张实际渲染均为 1920 × 1081。
- `npm run typecheck`、`npm run build`、两个预览 JavaScript 文件的语法检查通过。
- 6 个矩形业务/服务屏的实际 GPU 像素均为预期背景色 `[12,46,70,255]`，未被边框遮挡。
- 电视左上角橙色与右下角绿色像素通过，视频时间持续推进，反复启停未见纹理数量增长，无效视频显示明确错误。
- 320、768、1024、1440 宽度无横向溢出；主要按钮不低于 44px；键盘平移、模型请求失败及重新加载通过。
- 验收页最终主视角统计为 37 次绘制、167,206 三角面（含绑定器创建的钟面），无 JavaScript 未捕获错误。初次全流程在高清 CPU 渲染同时进行时出现等待超时；渲染结束后使用分阶段等待重新跑完整流程通过，不据此承诺冷启动时间。

预览属于开发验收页面，不进入 Vite 正式页面入口；生产构建通过用于确认没有破坏原项目。没有进行真实病区登录、低配置电脑帧率、非 16:9 视频和医院视频源验收。

## 正式组件接入验收

- 页面：`scripts/fixtures/nurse-silver-runtime.html`，直接挂载正式 `DigitalTwinWorkspace` / `AreaScene3D`，仅使用合成病区与呼叫记录，不绕过正式登录页面的权限。
- 脚本：`scripts/verify-nurse-silver-runtime.pw.js`。已验证首帧加载、七个动态绑定、呼叫 12→7→0 更新、纹理复用、双主题往返还原、走廊往返、相机边界、视频播放/暂停/卸载、无效视频、模型失败及重新加载。验收用视频地址只注入测试页，不写入正式配置。
- 截图：`output/playwright/nurse-silver-runtime-light.png`、`nurse-silver-runtime-dark.png`。属于浏览器实时渲染，不是 Blender 概念图，也不是真实医院数据。
- 320/768/1024/1440/1920px 检查没有横向溢出或无效相机参数；320px 原有信息面板、导航较拥挤并遮挡模型，本次没有扩展重做工作台的移动端布局，不能视为手机端可用性验收。
- 新模型 12,426,560 字节，旧模型 61,386,912 字节，模型文件体积减少约 79.8%；并不等于实际冷启动速度提高相同比例。没有低配置设备帧率保证。
- 最终验证：模型专项 21/21、正式组件浏览器检查 25/25（无未捕获 JavaScript 错误）、`npm run typecheck`、`npm run build` 和 `git diff --check` 通过。构建期间包含类型检查。代码复查补充了错误布局时已解码 GLB 的清理及 GPU 预热后的过期回调检查。
- 当前工作区全量测试为 581/594 通过、13 项失败，不能宣称全量通过。未扩大修改这些已有模块：告警闭环、护士站/顶部历史样式断言、走廊显隐的 CRLF 源码断言、存储读取失败恢复、走廊工具栏/边界、病房内边界和床模型节点契约。相关入口为 `alert-closure-boundary.test.mjs`、`area-scene-visibility-boundary.test.mjs`、`dashboard-header-operator-layout.test.mjs`、`nurse-station-complete-optimization.test.mjs`、`nurse-station-page-presentation-boundary.test.mjs`、`nurse-station-scene-boundary.test.mjs`、`swp-call-safety-ui.test.mjs`、`task-4-concurrency.test.mjs`、`ward-corridor-toolbar-states.test.mjs` 及对应核心测试。
