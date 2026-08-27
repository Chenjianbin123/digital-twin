# 真实数据库认证与病区权限设计

## 目标

在 `VITE_DATA_SOURCE=database` 时，平台登录、角色确认、病区列表和病区孪生数据统一通过本项目的数据库适配器访问 `dnk_swp_db`。浏览器不接触 MySQL 凭据，并且用户只能读取当前所选角色获授权的病区。

本阶段不新增平台用户，不修改现有用户、角色或病区授权数据，也不改变 `remote` 和 `mock` 数据源的既有行为。

## 已确认的数据库契约

- `sys_user.user_password`：现有启用账号均为 32 位十六进制值，与前端现有 MD5 密码提交方式兼容。
- 用户角色：`sys_user_role.user_id -> sys_role.id`。
- 角色病区：`sys_role_area_data.role_id -> hosp_area_info.id`。
- 账号状态：登录时同时检查 `sys_user.is_enable` 和 `sys_user.is_delete`。
- 当前数据库有 49 个启用用户，其中 47 个绑定角色，24 个具有角色病区授权。

## 架构

```text
SwpLoginGate
  -> auth.ts 根据 data source 选择认证后端
     -> remote: 保持现有 /swp 接口
     -> database: /db-adapter/auth/*

database auth token
  -> Authorization: Bearer <token>
  -> /db-adapter/api/areas
  -> /db-adapter/api/areas/:areaCode/twin
  -> /db-adapter/api/templates/:id
  -> /db-adapter/api/hospital
```

数据库适配器负责认证、授权和数据查询。前端只能保存适配器签发的会话令牌，不能传入用户 ID 或角色 ID 来绕过服务端校验。

## 登录流程

### 登录

`POST /auth/login`

请求沿用现有格式：

```json
{
  "userName": "platform-user",
  "userPassword": "32-character-md5"
}
```

适配器执行以下校验：

1. 使用参数化 SQL 按 `user_name` 查询唯一用户。
2. 拒绝已删除或未启用用户。
3. 使用常量时间比较校验 MD5 值。
4. 查询该用户已启用的角色。
5. 用户没有有效角色时拒绝登录。
6. 返回不含密码、身份证、电话和地址字段的最小用户对象及临时登录令牌。

失败响应统一使用通用提示“用户名或密码错误”，不暴露账号是否存在。账号禁用和无角色可以返回明确的业务错误。

### 角色确认

`POST /auth/role-confirm`

请求携带临时登录令牌和 `roleId`。适配器重新检查该角色是否仍属于当前用户且处于启用状态，然后签发包含 `userId`、`roleId`、签发时间和过期时间的正式会话令牌。

前端用正式令牌替换临时令牌，再写入现有 `sessionStorage` 会话。远端认证如果不返回新令牌，则继续保留原令牌，保证兼容。

## 会话令牌

- 使用 Node `crypto` 的 HMAC-SHA256 签名，不增加第三方认证依赖。
- 生产或长期运行环境通过 `DB_AUTH_SECRET` 提供签名密钥。
- 未配置密钥时，适配器启动时生成仅本次进程有效的随机密钥并输出警告；适配器重启后旧会话失效。
- 正式会话默认有效期 8 小时，可通过 `DB_AUTH_TTL_SECONDS` 配置。
- 临时登录令牌仅用于确认角色，默认有效期 5 分钟。
- 令牌不包含用户名、姓名、密码或患者数据。

## 病区授权

数据库模式下，下列业务接口必须要求正式令牌：

- `GET /api/areas`
- `GET /api/areas/:areaCode/twin`
- `GET /api/templates/:id`
- `GET /api/hospital`

`GET /api/areas` 只返回当前角色在 `sys_role_area_data` 中绑定且处于启用状态的病区。

读取某个病区的 twin 数据前，适配器把 `areaCode` 解析为病区 ID，并再次校验该 ID 是否属于当前角色，防止直接拼接 URL 越权访问。

没有病区授权的角色可以完成登录和角色确认，但病区列表返回空数组；前端沿用现有空病区状态，不回退展示全部病区。

本阶段按数据库显式授权执行，不根据 `role_level` 或角色名称隐式授予全病区权限。

## 前端适配

- `src/api/auth.ts` 根据 `getDataSource()` 路由到 remote 或 database 认证接口。
- 数据库认证响应映射到现有 `AuthUser` / `AuthRole` 类型，登录界面无需重做。
- `confirmSwpRole` 返回可选的新令牌；数据库模式更新 `TokenKey`，remote 模式保持兼容。
- `src/api/database-twin.ts` 的请求自动携带当前正式令牌。
- 收到 HTTP 401/403 时复用现有 `AUTH_EXPIRED_EVENT`，清理会话并回到登录页。
- `.env.development` 切换为 `VITE_DATA_SOURCE=database`，数据库密码仍只通过启动适配器的服务端环境变量提供。

## 日志与隐私

- 登录成功后向 `sys_login_log` 写入用户 ID、用户名、时间和请求 IP。
- 登录失败本阶段不写入密码、密码摘要或完整请求体。
- 适配器日志不得输出 Authorization 令牌、数据库密码、用户密码摘要或患者身份信息。
- `DB_MASK_PATIENT_NAME=true` 继续作为默认配置。

## 错误处理

- 400：请求字段缺失或格式错误。
- 401：登录失败、令牌缺失、签名无效或过期。
- 403：角色不属于用户或病区未授权。
- 404：已授权范围内目标资源不存在。
- 500：数据库或适配器内部异常；返回通用错误，详细错误只记录在服务端。

数据库不可用时登录页和业务页面提供可重试错误，不回退到远端或 mock 数据，避免混用数据源。

## 测试

### 自动化测试

- 密码格式、令牌签名、过期和篡改测试。
- 登录响应不包含敏感字段测试。
- 用户角色校验测试。
- 病区列表按角色过滤测试。
- 直接请求未授权病区返回 403 测试。
- database 与 remote 认证路由测试。
- 401/403 清理前端会话测试。

数据库查询层应以可注入函数测试，自动化测试不向真实数据库写入用户、角色或授权数据。

### 联调验收

使用一个现有、启用且绑定角色的 `sys_user` 平台账号完成：

```text
登录
  -> 选择角色
  -> 仅看到授权病区
  -> 进入护士站
  -> 切换到六门走廊
  -> 进入病房内部
  -> 退出登录
```

还需使用一个无病区授权的角色验证空列表，并验证手工请求未授权病区被拒绝。

## 不在本阶段

- 不创建或修改 `sys_user`、`sys_role`、`sys_user_role`、`sys_role_area_data` 数据。
- 不实现密码修改、找回密码、验证码或账号锁定策略。
- 不写入或修改 `swp_call_info`、`swp_alarm_info` 等临床业务表。
- 不进行 GLB 压缩或场景性能优化。
- 告警处理持久化在认证与只读授权稳定后单独设计。
