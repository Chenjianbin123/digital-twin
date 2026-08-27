# 护士站真实数据分屏展示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将护士站模型内的主屏、工作屏和状态屏统一绑定到当前病区的真实床位、患者、呼叫、输液、设备和环境数据。

**Architecture:** 新增一个纯函数数据汇总模块，接收 `TwinAreaEntity` 和 `RoomSummary[]`，输出屏幕使用的统计与重点病房数据。`AreaScene` 只负责把汇总结果绘制到现有 Canvas 贴图，并在病区更新后刷新；不新增接口，不改变 GLB 节点绑定。

**Tech Stack:** TypeScript、Three.js CanvasTexture、Node test runner、Vite/Vue TypeScript build。

## Global Constraints

- 数据只来自当前病区真实接口映射后的 `TwinAreaEntity`，不新增重复接口。
- 缺失字段显示“暂无数据”，不使用虚构电话号码、探视时间或统计数字。
- 保留上一帧有效贴图，避免刷新异常时屏幕闪空。
- 不改变护士站模型、相机和动态屏节点名称。

### Task 1: 抽离护士站实时数据汇总

**Files:**
- Create: `src/core/nurse-station-live-data.ts`
- Test: `src/core/nurse-station-live-data.test.ts`

**Interfaces:**
- Produces `buildNurseStationLiveData(area, summaries)` with room/beds/devices/environment aggregates and priority room list.

- [ ] 写失败测试：覆盖总床位、在床、空床、呼叫、输液、设备去重、环境告警、异常优先级和空数据。
- [ ] 运行 `node --test src/core/nurse-station-live-data.test.ts`，确认新模块尚不存在时失败。
- [ ] 实现纯函数和明确类型，设备总数按病区设备编码与床位设备编码去重；没有编码的设备不计入真实设备总数。
- [ ] 缺少设备编码时返回 `deviceTotal: 0`、`deviceOnline: 0`、`deviceHealthRate: null`，由渲染层显示“暂无数据”。
- [ ] 重跑该测试并确认全部通过。

### Task 2: 将真实汇总接入护士站屏幕

**Files:**
- Modify: `src/core/area-scene.ts: getNurseStationDisplayInfo, getAreaBoardStats, createNurseStationBoardTexture, createNurseWorkScreenTexture`
- Modify: `src/core/hospital-scene-details.ts: NurseStationDisplayInfo`
- Test: `scripts/nurse-station-live-data-boundary.test.mjs`

**Interfaces:**
- Consumes `buildNurseStationLiveData` from Task 1.
- Produces Canvas textures for `dashboard`, `taskQueue`, `wardStatus`, `bedMonitor`, and `deviceHealth` with real values.

- [ ] 先增加边界测试，断言不再出现固定的 `内线 119`、探视时间和“设备链路正常”伪造文案，并断言 `暂无数据` 降级文案存在。
- [ ] 让 `getNurseStationDisplayInfo` 只返回真实区域、科室和值班人员；紧急联系方式和公告缺失时返回 `undefined`。
- [ ] 让统计屏使用 Task 1 的真实设备编码统计，不再以床位数量推算设备总数。
- [ ] 主屏增加空床和占用率；左屏显示呼叫、离线、环境告警房间；病房屏显示真实病房占用和状态；床位屏显示患者/床位重点信息；设备屏显示真实设备在线率或“暂无数据”。
- [ ] 所有 Canvas 文案对空数组和缺失字段使用“暂无数据”。
- [ ] 在 `updateArea` 和 `syncAreaData` 现有刷新点保持重绘，不添加新的轮询接口。
- [ ] 运行边界测试和现有护士站测试。

### Task 3: 构建和运行验证

**Files:**
- Modify: `docs/superpowers/specs/2026-08-19-nurse-station-live-data-design.md` only if implementation behavior needs clarification.

- [ ] 运行 `node --test scripts/nurse-station-*.test.mjs src/core/nurse-station-live-data.test.ts`。
- [ ] 运行 `npm run build`。
- [ ] 启动 `npm run dev -- --host 127.0.0.1`，确认模型请求 `high_fidelity_nurse_station_v3.glb`，切换病区后五块屏内容更新。
- [ ] 检查接口无数据时屏幕显示“暂无数据”，而不是固定假数据。
