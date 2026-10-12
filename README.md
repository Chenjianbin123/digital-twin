# ward-digital-twin

智慧病房 **3D 数字孪生** Web 原型，业务模型对齐 `medical-device-v2`。

## 快速开始

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## 数据来源

项目支持 `remote`、`mock`、`database` 三种数据源，默认使用真实 SWP 接口。本地开发在 `.env.development.local` 配置：

```env
VITE_DATA_SOURCE=remote
VITE_DEVICE_HOST=192.168.96.104
```

开发修改地址后重启服务。业务接口固定 `9700/swp`，文件服务固定同一 IP 的 `9704`。可显式写 `http://` 或 `https://`，协议必须与服务实际支持的一致；地址不得含账号、查询参数或其他路径。

正式发布支持**同一份前端包部署到不同医院**：执行 `npm run build` 后，修改 `dist/config.json`，填写现场后端地址：

```json
{
  "deviceHost": "http://该医院后端IP"
}
```

`public/config.json` 随构建复制到产物，默认地址为空，必须在现场填写。正式 remote 页面启动先读取该文件，再初始化登录和业务；缺失或非法配置会提示启动失败，不回退到构建时的开发地址。后续换 IP 只修改已部署的 `config.json` 并刷新页面，无需重新打包；切换地址会清除旧医院登录会话。配置文件只放公开地址，不放令牌或密码。服务器应对 `config.json` 设置 `Cache-Control: no-store`，且文件不存在时返回 404，不能回退为首页 HTML。

本地病区选择、关注记录和呼叫提醒回执按医院地址分别保存，切换医院不会误用旧记录。正式包直接访问配置地址，需确保 API 与文件服务允许前端跨域访问；HTTPS 页面需连接支持 HTTPS 的后端服务。Vite 开发代理不会随 `dist` 发布。

登录 Token 由登录接口写入 `sessionStorage.TokenKey`，不要固化在环境文件中。只有显式配置 `VITE_DATA_SOURCE=mock` 时才会启用模拟病房、患者、床位、呼叫、状态和环境数据；配置缺失或值无效时默认使用 `remote`。

## 连接 dnk_swp_db

`database` 是可选模式，会通过本项目的后端适配器读取 `dnk_swp_db`，再转换成前端统一的数字孪生数据模型。

1. 启动数据库适配器：

```bash
DB_PASSWORD='你的数据库密码' npm run dev:db-adapter
```

2. 启动前端：

```bash
npm run dev
```

使用数据库适配器时，将 `.env.development` 临时切换为：

```bash
VITE_DATA_SOURCE=database
VITE_DB_ADAPTER_BASE=/db-adapter
VITE_DB_ADAPTER_TARGET=http://127.0.0.1:8788
VITE_DB_AREA_CODE=2001
```

数据库连接变量只给 `server/db-adapter.mjs` 使用，不要使用 `VITE_` 前缀暴露到浏览器。可参考 `.env.db-adapter.example`。

## 上线前自动验收

```bash
npm run verify
```

统一检查资源、测试、类型、构建与隔离浏览器流程，报告写入 `output/playwright/verify-*/`。需提前安装可用的 Playwright CLI，或通过 `VERIFY_PLAYWRIGHT_CLI` 指定现有 JavaScript 入口；缺少检查不会算通过。不会提交或部署，生产配置及真实设备仍需人工验收。

详细准备、退出码、部署和回滚步骤见 [项目详解第 19 节](docs/项目详解.md#19-上线候选版验收与回滚)。

实际生产包还可执行 `npm run verify:deployment`。先完成 remote 构建、填写产物的 `config.json`，并设置现有 `VERIFY_PLAYWRIGHT_CLI`；它从产物读取现场地址，检查资源 HTTP 访问、配置异常、登录目标和合成失败重试，不会向真实后台发送登录请求。真实账号、病区和设备状态仍需现场联调。

并行开发时，为每次验收使用独立产物目录：`npm run build -- --outDir output/release/<本次唯一名称>`，再设置 `VERIFY_DEPLOYMENT_DIST=output/release/<本次唯一名称>` 运行 `npm run verify:deployment`。默认仍检查 `dist`；验收前后入口文件变化会判定失败，避免混用其他任务的构建包。

## 文档

**[docs/项目详解.md](docs/项目详解.md)** — 项目唯一文档，涵盖架构、数据流、联调与修改指南。

## 技术栈

Vue 3 · Pinia · TypeScript · Vite · Three.js · Canvas 2D

## 三种场景

| 场景 | 说明 |
|------|------|
| **护士站** | 工作台 3D + 侧栏指标 |
| **病房** | 走廊全景，点房钻取 |
| **病房内** | 单房 3D 或 2.5D 平面 |
