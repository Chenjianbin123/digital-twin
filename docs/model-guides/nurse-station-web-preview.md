# 第二版网页预览

运行 `npm run dev` 后访问 `/nurse-station-preview.html`。这是设计参考入口；正式 `/` 页面的护士站现已改用第二版模型，认证流程不变。正式接入说明见 `nurse-station-v2-integration.md`。

项目内入口：进入护士站后，点击右上角“第二版模型预览”（1100px 及以下显示“V2 预览”）。链接在新标签页打开，保留当前业务页面；其他场景不显示此入口。

预览复用项目的 Vue、Three.js 和 Vite 依赖，作为独立多页面入口构建；没有引入新依赖，也不连接业务接口。模型直接引用 `output/nurse-station-reference-v2/nurse-station-design-v2.glb`，构建会输出带哈希的资源文件。

支持正面、柜台细节、工作侧、信息屏四个机位、拖动旋转、缩放、平移和亮度调整。桌面与窄屏使用同一场景；静止时不持续渲染。退出时释放模型、贴图、阴影和环境资源。

本预览页的五块屏幕仍使用明确标注的演示内容；圆形挂钟为固定 10:24。正式护士站则使用项目现有看板数据和浏览器当前时间，两者用途不同。

这是实时渲染评审入口，不能等同于 Blender 离线渲染。未烘焙间接光，且面数、绘制调用和纹理尚未完成目标设备性能验收。预览构建会额外包含约 28.7 MB 的设计源模型；正式护士站按需加载 public/models 下的第二版副本，不加载预览入口的演示界面。

验证命令：

```sh
npm run typecheck
npm run build
node --test scripts/nurse-station-design-preview.test.mjs scripts/bundle-size-budget.test.mjs
node scripts/validate_nurse_station_design.mjs output/nurse-station-reference-v2/nurse-station-design-v2.glb --refined
```
