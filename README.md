# ward-digital-twin

智慧病房 **3D 数字孪生** Web 原型，业务模型对齐 `medical-device-v2`。

## 快速开始

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## 数据来源

项目支持 `remote`、`mock`、`database` 三种数据源。开发和生产环境默认使用真实 SWP 接口：

```env
VITE_DATA_SOURCE=remote
VITE_DEVICE_HOST=192.168.96.104
```

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
