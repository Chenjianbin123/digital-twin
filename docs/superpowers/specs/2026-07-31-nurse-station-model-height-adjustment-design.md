# Nurse Station Model Height Adjustment Design

## Goal

在保留当前护士站模型左右宽度和纵深的前提下，将模型纵向拉高 10%，减少画面顶部留白。

## Current State

当前前端模型尺寸上限为：

```ts
new THREE.Vector3(8.748, 2.3895, 4.7385)
```

场景边界测试仍锁定上一版 `9.72 × 2.655 × 5.265`，实施时需要同步更新为当前尺寸。

## Design

新增独立纵向缩放常量：

```ts
const NURSE_STATION_MODEL_HEIGHT_SCALE = 1.1;
```

在 `fitNurseStationModel()` 完成统一缩放后，只调整 Three.js 的垂直轴：

```ts
model.scale.multiplyScalar(scale);
model.scale.y *= NURSE_STATION_MODEL_HEIGHT_SCALE;
model.updateMatrixWorld(true);
```

现有 `fittedBox` 会在纵向缩放后重新计算，并继续使用包围盒最低点完成落地，因此模型不会悬空或陷入地面。

## Scope

- 保留当前 `8.748 × 2.3895 × 4.7385` 的统一尺寸上限。
- 只将模型纵向拉高 10%，不改变 X、Z 轴显示尺寸。
- 不修改 GLB、摄像机、OrbitControls、动态屏幕或加载失败回退。
- 同步修正场景边界测试，使其锁定当前尺寸和纵向倍率。

## Verification

- 先增加纵向倍率和应用逻辑的失败边界测试。
- 运行护士站场景边界测试、渲染输出边界测试和生产构建。
- 在桌面 `1440x900` 和移动端 `390x844` 下截图，确认顶部留白减少、左右构图不变、模型仍落地且界面无重叠。
- 检查浏览器控制台没有模型加载或动态屏幕挂载错误。
