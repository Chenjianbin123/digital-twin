# 参考图走廊模型 v1

## 交付范围

依据 `output/imagegen/hospital-concepts-20260929/ward-corridor-concept-v1.png`，
使用 Blender 4.5.3 LTS 建立可编辑走廊并导出 glTF 2.0 GLB。
这不是将效果图投影到平面的假三维场景，也不是实测医院平面图。

- 10 组双扇病房门：浅木纹、独立门框、观察窗、把手与踢脚板。
- 护墙板、青灰扶手、线性顶灯、通风口、烟感、悬吊导向牌。
- 尽头圆弧护士台、窗框、百叶和植物。
- 10 块独立竖向门口屏、10 块动态房号牌、2 块走廊信息屏。
- 单张参考图不提供真实尺寸和遮挡区信息：设计尺寸约宽 4.6 m、长 26.1 m（含入口）、高 3.12 m。
- 材质、比例、光照和尽头空间仍与概念图存在差异，不能称为百分百复原。

## 文件

| 内容 | 路径 |
| --- | --- |
| 可重建脚本 | `scripts/build_corridor_reference_v1.py` |
| Blender 源文件 | `output/corridor-reference-v1/corridor-reference-v1.blend` |
| 实际 Blender 渲染 | `output/corridor-reference-v1/corridor-reference-v1.png` |
| 模型统计 | `output/corridor-reference-v1/manifest.json` |
| 网页模型 | `public/models/hospital-corridor/corridor-reference-v1.glb` |
| 本地独立预览 | `scripts/fixtures/corridor-reference-preview.html` |
| 模型契约测试 | `scripts/corridor-reference-model.test.mjs` |
| 浏览器验收 | `scripts/verify-corridor-reference.pw.js` |

`.blend` 保留独立部件，贴图及字体已打包。`PREVIEW_ONLY` 集合里的示例房号、
示例屏幕文字不会导出到 GLB。源文件在被 Git 忽略的 `output/` 中，清理该目录前请备份。
脚本依赖 Blender 自带 Python/NumPy 和 Windows 微软雅黑；没有新增 npm 依赖。

## 节点与模板契约

| 节点 / 材质 | 用途 |
| --- | --- |
| `门1`～`门10` | 稳定门位组，左右各 5 门；不是实际病房 ID |
| `门口机1`～`门口机10` | 对应设备组；无房间绑定时整组隐藏 |
| `DoorScreen_1`～`DoorScreen_10` / `门口机内` | 原生模板面，0.225 × 0.40 m，9:16 |
| `DoorLabel_1`～`DoorLabel_10` | 可选的原生房号牌；沿用绑定房间名称，不烘焙房号 |
| `走廊屏1`、`走廊屏2` | 现有病区信息 / 时钟渲染面，16:9 |
| `地板`、`天花板`、`墙壁`、`墙壁2` | 相机边界 |

GLB 内预先居中并补偿现有 `AreaScene` 的 90° 旋转，加载后纵轴为 Z。
门口屏沿用 `renderCorridorScreen` → 模板解析 → CanvasTexture 的完整路径。
UV 上边对应 Canvas v=0，`flipY=false`；两侧均不镜像。
横屏模板采用 contain 等比留边，不改变物理竖屏形状。

### 此次运行时适配

- `src/core/area-scene.ts`：原生不透明屏幕启用深度写入。
  原先后绘制的机壳可能覆盖已成功加载的纹理；该修复同时保持墙体遮挡，
  不使用关闭深度测试的方式掩盖问题。生成式兜底屏仍保持原来的深度策略。
- `src/core/ward-corridor-model.ts`：可选房号牌识别与 UV 定向。
  新模型使用墙装房号牌，避免再生成重复的悬挂牌；旧模型不存在该节点时保持原行为。
  新牌保留离线、呼叫文字和聚焦提示，内容不变时复用纹理；重绑后重新创建已释放的纹理。

## 预览与重建

启动现有 Vite 开发服务后访问：

`http://localhost:5173/scripts/fixtures/corridor-reference-preview.html`

页面使用真实 `AreaScene`、真实 GLB 和模板渲染链路，但房间和模板数据全部为合成验收数据。
页面内拦截模板请求，禁止访问医院接口；不会更改正式模型配置。
支持全景、左右屏幕近景、横竖模板、未配置、请求失败、房间乱序、清空恢复及主题切换。
预览页为开发 fixture，没有加入生产入口。

```powershell
& 'output/tools/blender/blender-4.5.3-windows-x64/blender.exe' -b `
  --python scripts/build_corridor_reference_v1.py -- --samples 48 --width 1664

# 仅重新导出源文件与模型，不渲染图片
& 'output/tools/blender/blender-4.5.3-windows-x64/blender.exe' -b `
  --python scripts/build_corridor_reference_v1.py -- --skip-render

node --test --test-concurrency=1 scripts/corridor-reference-model.test.mjs `
  scripts/ward-corridor-screen-rebind.test.mjs scripts/ward-corridor-screen-uv.test.mjs `
  scripts/ward-corridor-template-orientation.test.mjs

# 使用已安装的 Playwright CLI，会话需先 open 本地页面
playwright-cli -s=corridor-design run-code --filename=scripts/verify-corridor-reference.pw.js
```

重建命令会重写本任务专用的 v1 产物；手工编辑 `.blend` 后须另存再重建。

## 验证记录（2026-09-29）

- GLB：7,382,976 字节（约 7.04 MiB）、94,996 三角面、91 个网格对象、111 个材质绘制单元。
  几何未做 Draco 压缩，避免额外解码；两张 PBR 基色贴图嵌入 GLB，不依赖远程图片。
- 实际二进制解析：十门、十设备、十房号牌、两块走廊屏、相机边界和两侧 UV 检查通过。
- 浏览器：十块屏幕逐块渲染取样均为目标模板背景 `[17,48,75,255]`，证明屏幕实际可见。
- 房间乱序和清空恢复后原生屏幕、房号牌对象与房间绑定保持不变。
- 横屏等比留边、未配置提示、失败重试及恢复通过；深浅主题切换无页面异常。
- 320 / 768 / 1024 / 1440 px 预览页面均无水平溢出。
- 浏览器样本帧约 113 次绘制、95,000 三角面；这是该机该视角的统计，不是目标设备帧率保证。
- 浏览器无 pageerror；保留项目既有 Three.js 阴影弃用 / 驱动着色器警告。
- `npm run build`（含 `vue-tsc --noEmit`）通过。
- 最终直接相关回归 36/36 通过：新模型契约、旧模型 UV、原生屏幕重绑/深度、
  连接设备显隐、标牌位置、屏幕定位、模板方向及走廊模型单元测试。

扩大走廊回归时发现两项既有断言失败（其读取的组件和配置本次未修改）：

1. `ward-corridor-toolbar-states.test.mjs` 仍查找“已接入 N 间病房”，当前工具栏文案为“N 间病房”。
2. `ward-corridor-view-bounds-boundary.test.mjs` 正则限定单引号，当前配置使用双引号。

这两项未在模型任务中顺带修改。未进行全项目测试、真实医院模板接口联调或目标医院电脑性能验收。

## 正式替换前

当前仍使用 `3-v4.glb`，未覆盖原资产、未修改 `ward-corridor-scene.ts`、未提交 Git。
正式启用新模型时不能只更换 URL，还需同时采用新机位：

- URL：`/models/hospital-corridor/corridor-reference-v1.glb`
- 初始 target：`{ x: 0, y: 1.75, z: -2 }`
- distance：`14.8`；azimuth / elevation：`0 / 0`；FOV：`48`

上述参数已在隔离预览验证。真实病区仍需提供稳定房间 ID 到门位的映射；
未配置时只可称为分组示意，不得把示例门序当作现场空间位置。
Blender 离线光照与当前网页实时光照不同，不能把离线渲染当成网页最终效果。
