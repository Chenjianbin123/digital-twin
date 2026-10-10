# 护士站银白精修版 silver-v2

2026-09-29。在 silver-v1 上做可见区域优先的精修，保持建筑尺度、屏幕布局和既有业务接口。不代表医院实测施工模型。

## 交付文件

- 可编辑源文件：`output/nurse-station-silver-v2/nurse-station-silver-v2.blend`。保留分件、倒角修改器和打包材质。
- 烘焙/合并后的运行时源文件：`output/nurse-station-silver-v2/nurse-station-silver-v2-runtime.blend`。
- 前端资产：`public/models/smart-ward-nurse-station/nurse-station-silver-v2.glb`。
- 生成记录：`output/nurse-station-silver-v2/manifest.json`。
- 可重复构建：`scripts/refine_nurse_station_silver_v2.py`、`scripts/silver_station_export.py`，Blender 4.5.3 LTS。

旧版 `.blend` 和 GLB 未覆盖。`output/` 是本地生成目录；交接源文件时应一并保留其中的 `.blend`，不能只交接 Git 中的脚本。

## 精修范围

- 柜台：五块独立金属面板、真实接缝、连续圆角、凹入踢脚、台面压边、嵌入式青色细灯带、立体护理服务标识。
- 吊楣：分层收边、凹入底板、平滑曲面法线、制造接缝、招牌底板与立体字。
- 后墙：大屏/墙挂电视的衬板与金属边条，柜门暗缝，公共侧可见的显示器背部细节与手卫生设备。
- 材质：银色表面使用 2048px 色彩/法线/粗糙度图，白色与地面使用 1024px 图。降低原先大面积过亮的反射，区分金属、台面、背板。
- 阴影：静态主体 2048px AO、地面 1024px AO，独立 UV1。恢复吊楣参与投影，保留静态阴影缓存。
- 隐藏处：移除 16 个键帽/活页夹环对象，简化椅脚等次要部件倒角；微小字号不使用高细分倒角。

## 运行时约束与资源预算

| 项目 | silver-v1 | silver-v2 |
| --- | ---: | ---: |
| 三角面 | 167,142 | 212,326 |
| GLB 字节 | 12,426,560 | 14,112,432 |
| 材质绘制单元 | 36 | 40 |
| 内嵌图像 | 15 | 17 |
| AO | 无 | 主体 2K + 地面 1K |

资源大小约 13.46 MiB。使用项目已有 Draco 解码器，不引入依赖：位置 18 位、法线 14 位、UV 16 位。增加面数用于可见圆角、面板和收边；文件体积增长约 13.6%，不是加载提速承诺。

新 GLB 的布局仍为 `silver-v1`，根节点仍为 `NurseStationSilverV1`，版本通过 `extras.assetRevision = silver-v2` 标记。不要为了文件版本修改这些接口名，也不要套用旧模型的包围盒缩放。

`Screen_Main`、四个工作屏、`Screen_Service`、`Screen_Video`、时钟和屏框的位置保留。业务屏 Canvas/视频 UV0 不参与 AO 展开。静态材质 `_AO` 后缀由主题模块归一化处理，切换主题不丢弃贴图，浅色可恢复原始颜色。

浅色使用银白/医疗青蓝；深色使用低饱和蓝灰墙面、石墨柜体、雾银操作面与青色细灯带，保持护理空间可读性。没有新增全屏后处理、实时反射或多盏实时投影灯。

## 重建

```powershell
& 'E:\projects\digital-twin\output\tools\blender\blender-4.5.3-windows-x64\blender.exe' --background --threads 6 --python scripts/refine_nurse_station_silver_v2.py -- --skip-render
```

输入固定为 v1 源文件；重新生成只写 v2 目录和 v2 GLB。源文件先保存，再在导出副本中合并网格、展开 AO、烘焙并压缩，保证源文件仍可编辑。

## 验证

- `npm run build`：通过类型检查与生产构建。
- 模型、屏幕、视频及主题相关测试：22 项通过。二进制检测覆盖 Draco 解码、UV 朝向/比例、独立 AO UV、体积/面数预算和实际绑定。
- `scripts/verify-nurse-silver-runtime.pw.js`：27 项通过，覆盖数据变化、纹理复用、AO/阴影、双主题往返、320/768/1024/1440/1920px、相机边界、场景切换、视频播放/暂停/释放、错误及恢复。
- 全量测试：595 项，582 通过、13 失败，与修改前已知失败项一致。本次没有修复这些范围外失败，不应将该结果视为全量绿灯。
- 浏览器使用正式 `DigitalTwinWorkspace`/`AreaScene` 与合成数据，不是生产医院、真实呼叫设备或低配置实机验收。
- 截图：`output/playwright/nurse-silver-v2-hero-light.png`、`nurse-silver-v2-hero-dark.png`、`nurse-silver-v2-detail.png`，以及含侧栏和窄屏的 `nurse-silver-v2-runtime-*`。

本次未更改默认视频地址、业务数据源、患者绑定、侧栏样式或导航行为；未创建 Git 提交。

## 后续补充：医院宣传片循环播放（2026-09-29）

以下为历史记录，外网宣传片已被下一节的本地短循环替换，不再是当前默认片源。

应用户要求，默认视频从空串改为北京清华长庚医院官网公开的《2020 宣传片中文版》：

- 来源页：https://www.btch.edu.cn/xxdt/jcsp/62277.htm
- 播放地址：https://www.btch.edu.cn/docs/20201103093305473740.mp4
- 配置：`src/config/nurse-station-scene.ts` 的 `educationVideoUrl`。
- 实测视频为 1920×1080、486.16 秒。沿用 `station-education-video.ts` 的静音、循环、内联播放及停用暂停逻辑，没有新增播放器或计时重播器。
- 片源支持 HTTPS、CORS 和 Range。原片约 626 MB，由浏览器按需请求，不下载进仓库或打包进应用；依赖外网和对方服务器，不能作为离线可用或低带宽流畅的承诺。
- 仅作当前演示。未确认商业复用授权；正式项目交付前应替换为本院授权且经过压缩的同源视频，保留品牌来源，不将其他医院影片当成本院宣传片。

验证：8 项相关单元测试、生产构建及 `verify-hospital-video-loop.pw.js` 的 10 项浏览器检查通过。浏览器实际播放、跳到片尾后自动回到片头、暂停续播、纹理复用和双主题画面均已验证；并非仅检查 `loop=true`。首次附加的远端 35 秒随机跳播取图等待超时，取消与循环无关的额外随机跳播后重新跑完整验证通过。截图位于 `output/playwright/hospital-video-light.png` 和 `hospital-video-dark.png`。

原无片源回归仍保留：验收页使用 `?video=` 显式关闭视频，避免默认外网片源改变空状态测试含义。未创建 Git 提交。

## 当前默认：轻量护理主题循环（2026-09-29）

用户反馈视频卡顿，希望更简单且动态更明显。保留护士站模型和视频绑定生命周期，仅替换 `educationVideoUrl` 与素材。

- 当前片源：`public/videos/nurse-station-care-loop.mp4`，140,884 字节（约 141 KB），H.264、640×360、12 fps、6 秒、无音轨。配置追加 `v=20260929-visible`，避免浏览器继续使用旧画面缓存。
- 原创几何/文字动画：每 3 秒轮换“用心护理 / 温暖守护”，标题字号从 55 增至 64；医疗十字最大宽度约 160px（原约 104px），增加呼吸缩放幅度；移动光带宽度从 30 增至 144px，横跨屏幕往返。保持深色稳定背景，不使用全屏闪烁。不含第三方医院影片、标志、患者数据或医疗效果宣称。
- 同源静音自动循环；沿用停用暂停、恢复播放、纹理复用、加载失败提示和卸载释放。无需外网视频服务器，无新依赖，不增加运行时 Canvas 动画循环。
- 生成脚本：`scripts/build_station_video_loop.py`。需要 Blender 4.5 和 Windows 微软雅黑粗体字体；只在生成素材时使用，运行和打包不需要 Blender。

```powershell
& 'E:\projects\digital-twin\output\tools\blender\blender-4.5.3-windows-x64\blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/build_station_video_loop.py
```

### 排查与验证边界

优先检查外网缓冲，其次是 1080p 解码/纹理上传负担，最后才是整个 3D 场景的帧预算。原外网片源在本次 10 秒采样内播放时间推进 0 秒、新增视频帧 0、`stalled` 2 次。该结果证明发生过媒体停滞，但不能证明所有卡顿都只来自网络。

先制作 24 fps 本地循环，13 秒采样仍记录到总视频帧 308、丢帧 148，因此将慢速标牌动画降至 12 fps。辨识度加强版 13 秒采样：自然循环 2 次、视频帧回调 123 次、总帧 155、丢帧 31、最大回调间隔约 267 ms、`stalled=0`、`error=0`，另有 2 次 `waiting`。只请求了同源 MP4。该环境仍有丢帧，不应描述成全程零卡顿、稳定满帧或所有低配置电脑已验收通过。

- 9 项模型/视频相关单元测试通过，覆盖本地片源、素材体积预算、静音/循环、空源、异常/自动播放受限、暂停、竞态及释放。先将片源断言改为本地地址，观察旧配置失败，再修改配置后通过。
- `scripts/verify-hospital-video-loop.pw.js`：15 项浏览器检查通过，实际等待至少两次自然循环，不依赖强制跳播；包含暂停续播、纹理复用、浅色/深色实际画面和同源视频请求检查。额外采样第 1、4 秒的大标题区域，约 22.85% 像素明显变化，验证文字内容确实轮换，而不是只靠小光点运动。
- `npm run build` 通过；`dist/videos/nurse-station-care-loop.mp4` 与源文件大小一致，已随生产包输出。
- 可复用 10 秒采样脚本：`scripts/measure-station-video.pw.js`，结果位于 `window.stationVideoMeasurement`。循环验收结果位于 `window.hospitalVideoReport`。
- 最终截图：`output/playwright/hospital-video-light.png`、`hospital-video-dark.png`。

本次未重跑全量测试，未更改 3D 模型/灯光、侧栏、接口或呼叫行为，未提交 Git。原有本地洗手视频保留。

## 深色主题分层调整（2026-09-29）

- 范围仅为 `src/core/silver-nurse-station.ts` 的深色材质与现有灯光。移除材质和所有灯源同时偏蓝的叠加染色；白色工作面、中性墙面、石墨金属和暖木门分别处理，青色集中在细灯带及屏幕周围。
- 主光保持中性偏暖、侧补光略冷；降低大面积金属反射和窗面自发光，保留 AO、法线、粗糙度贴图及模型细节。不重新生成 GLB，不改变模型、屏幕、相机、视频或侧栏。
- 浅色参数按材质/灯对象保存，完整恢复底色、粗糙度、金属度、环境反射强度、自发光、灯色、灯强度以及半球光地面色。共享材质和模型尚未加载时的主题切换均有测试。
- `node --test src/core/silver-nurse-station.test.ts src/core/station-education-video.test.ts scripts/nurse-silver-model.test.mjs`：13 项通过；`npm run build`：类型检查与生产构建通过。
- 新增 `scripts/verify-nurse-silver-theme.pw.js`，在正式组件合成数据页面运行，结果为 `window.silverThemeReport`：12 项通过，覆盖深浅往返、连续切换、业务屏纹理复用、呼叫数量变化、电视播放、320/768/1024/1440px 无横向溢出及无页面异常。1920px 同机位实测两种主题均为 41 次绘制、212,390 个三角面、33 张 GPU 纹理；并非帧率或低配置实机保证。
- 截图：`output/playwright/nurse-silver-theme-after-dark.png`、`nurse-silver-theme-after-light.png`、`nurse-silver-theme-after-workspace.png`。`before` 文件为代码修改前的同机位留档；验证页 `?phase=before` 只控制留档文件名，不会恢复旧版主题。
- 窄屏检查只证明无横向溢出与相机有效；320px 原有侧栏标题裁切、浮动导航占用信息区域仍可见，不在本次 3D 调色范围内。未验证医院真实数据、未重跑全量测试、未提交 Git。
