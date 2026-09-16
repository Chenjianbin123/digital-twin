# 门口屏未配置画面排查与修复

## 2026-09-14 本轮证据

绿色“未配置 / 暂无入住信息”由无病房绑定的槽位绘制，不是模板图片失败提示。
当前默认 remote 数据源的转换函数允许 sickroomCode 为空，但布局曾将它当作唯一标识。
完整浏览器复现经过 normalizeDoorDevice、mapDoorListToTwinArea、AreaScene 和真实 GLB：
传入两个具有 sickroomId、deviceCode、templateId 但没有 sickroomCode 的房间，修复前 receivedRooms=2、boundRooms=0。

## 修复

- 示意模式使用病房 ID、设备编号、病房编号依次作为稳定标识；保持业务字段原值。
- 真实布局仍只接受显式房号映射，缺少标识、重复房号或重复有效标识不猜测绑定。
- 绑定签名包含病房 ID 与设备编号，避免身份变化时轻量更新继续沿用旧绑定。
- 诊断接口新增 receivedRooms、missingRoomCodes、configuredTemplates、boundScreens、readyScreens、unassignedSlots；不输出患者信息或认证信息。
- 之前已经修复的动态材质身份保留、图片失败退出缓存、有限重试继续保留。

## 验证

- 新增缺房号、设备编号替代、重排、后补房号、重复标识与真实布局边界测试。
- scripts/verify-corridor-template-flow.pw.js 使用隔离测试数据与模板响应；加载实际 GLB，覆盖先空后有、刷新、重排、隐藏返回。
- 修复后 rooms=2、ready=2、originalScreens=true；已查看原门口屏上的“模板已加载”真实渲染截图。
- 截图 output/playwright/corridor-template-full.jpg 是测试模板在真实模型上的渲染，不是医院接口验收或 AI 概念图。
- 构建通过；完整测试 478/479，剩余为已有护士站背景色静态断言。

## 现场边界

未读取用户正在使用的浏览器登录会话，不把上述测试数据认作现场接口返回值。
当前 5173 为 remote 模式；另测 /db-adapter/api/areas 返回502，但该数据库代理不是当前默认数据路径，不能据此判定远程门口机接口故障。
现场核验先比较诊断计数：收到病房为0查病区接口；收到但绑定为0查标识与分组；绑定成功但模板就绪为0查模板ID、模板响应与图片。
模型多出的未分配门位仍显示占位画面，不应给它们复制其他病房模板。
