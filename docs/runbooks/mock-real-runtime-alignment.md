# Mock/Real 运行时联动：现状与下一步优化

## 1. 背景与目标

本文面向 miniapp、admin-web、identity、commerce、gateway 的联调同学，描述当前分支在“mock 模式与 real 模式运行时联动”上的落地现状，并明确下一步优化优先级。目标是让联调过程减少“模式切换导致的行为漂移”，确保同一角色在 mock 与 real 下得到尽量一致的登录链路、权限边界与页面可见性。

## 2. 当前状态（截至本分支）

### 2.1 已完成能力

1. 已建立共享 mock 角色权限源
- 新增 `packages/shared/src/mock-data/auth.js`，统一维护：
  - admin-web mock 账号
  - miniapp mock 登录 fixture
  - 角色对应权限映射（PermissionList）
- `packages/shared/src/mock-data/index.js` 已导出上述能力，避免两端重复维护角色矩阵。

2. admin-web mock 账号与权限改为共享源
- `apps/admin-web/src/lib/mock-accounts.js` 已改为读取 shared mock-data。
- 账号口径与 identity seed 对齐：`admin/boss/manager/cs`。

3. miniapp isolated mock 登录流已贴近 real
- `apps/miniapp/src/services/mock/identity.ts` 支持：
  - 按登录 code 匹配 fixture（如 `mock_customer_001`、`mock_sales_001`、`mock_multi_001`）
  - 多角色冲突抛出 `RoleSelectionRequiredError`（与 real 的 409 语义一致）
  - 角色选择后写入上下文，`me/permissions/bootstrap` 按“当前角色”返回
- `apps/miniapp/src/services/mock/runtime.ts` 增加 isolated mock auth context 存储与读取，支持角色态持久化。

4. miniapp 页面分界已收紧
- `apps/miniapp/src/pages/mine/index.tsx` 中“业务员工作台”入口改为仅 `SALES` 可见。
- 移除未定义配置引用：`runtimeEnv.commerceMockFallback`，减少运行时漂移风险。

5. commerce 角色兼容已补齐（联调关键路径）
- `services/commerce/internal/http/handler/orders.go`
- `services/commerce/internal/http/handler/inquiries.go`
- `services/commerce/internal/http/handler/after_sales.go`
- `services/commerce/internal/http/handler/tracking.go`

上述 handler 的角色白名单已纳入 `BOSS/MANAGER`（同时保留 `PROCUREMENT` 兼容），避免 admin-web 新角色在联调中被错误拒绝。

### 2.2 本分支已验证结果

以下命令在当前分支已执行并通过：

1. `go test ./...`（工作目录：`services/commerce`）
2. `pnpm -C apps/miniapp run lint:types`
3. `pnpm -C apps/miniapp test -- isolated-mock-mode --runInBand`
4. `pnpm -C apps/admin-web build`

## 3. 已知差距与风险

1. `PROCUREMENT` 仍在 commerce 侧保留兼容
- 当前策略是“先兼容不阻断联调”，但与 RBAC 文档中“PROCUREMENT 并入 CS”的目标仍存在历史包袱。

2. mock 与 real 在账号生命周期上仍有差异
- mock 侧是固定 fixture 驱动；real 侧受 identity 数据状态、绑定关系、手机号证明等真实条件影响。

3. 权限回归矩阵尚未自动化
- 当前验证以模块测试 + 构建 +关键链路测试为主，缺少“角色 × 页面 × 接口”统一端到端回归集。

4. 文档与实现存在持续漂移风险
- 若后续仅改代码不更新文档，联调信息会再次碎片化。

## 4. 下一步优化路线（按优先级）

### P0（本周）：角色矩阵回归集

目标：把“可访问/不可访问”从经验判断变成固定校验。

1. 建立最小回归矩阵
- 角色：`CUSTOMER/SALES/CS/MANAGER/BOSS/ADMIN`
- 维度：
  - 登录路径（mini/password）
  - 核心页面可见性
  - 关键接口可达性（orders/inquiries/after-sales/tracking）

2. 纳入持续检查
- 将矩阵检查脚本接入联调前置步骤（至少可本地一键执行）。

### P1（近期）：mock-real 行为进一步收敛

1. miniapp mock 失败路径补齐
- 在 isolated mock 中补齐并校验：401、403、409 的提示与 real 一致。

2. admin-web mock 会话字段语义对齐
- 确保 mock 会话中的 `permissions/featureFlags/currentRole` 与 real bootstrap 语义一致，降低页面守卫分叉。

### P2（中期）：联调可观测性

1. 建立统一联调检查脚本
- 覆盖：登录、角色切换、关键接口访问、页面菜单可见性。
- 输出机器可读报告，便于对比 mock 与 real 差异。

2. 增加“差异清单”自动产出
- 当 mock/real 行为出现偏差时，输出明确条目（角色、接口、状态码、页面）。

## 5. 联调验收清单

以下验收以“行为一致性”为准，不以“代码改动量”为准：

1. 多角色账号登录一致性
- 同一账号在 mock 与 real 下，均能触发角色选择流程（冲突场景）。

2. 页面可见性一致性
- miniapp 中销售专属入口仅 `SALES` 可见；非销售不可见。

3. admin-web 角色可达性
- `boss/manager/cs/admin` 在 mock 与 dev(real) 下可进入其权限允许的页面。

4. commerce 接口角色兼容
- `BOSS/MANAGER` 访问后台核心域接口不出现误拒（同时不破坏 CUSTOMER/SALES 的 scope 边界）。

5. 回归命令全绿
- 至少满足本文件“2.2 已验证结果”列出的 4 条命令。

## 6. 变更记录

- 2026-03-05
  - 变更摘要：完成 mock-real 联动第一轮收敛（共享 mock 角色权限源、miniapp isolated mock 角色流贴近 real、commerce 角色兼容补齐、页面分界收紧）。
  - 影响范围：miniapp、admin-web、packages/shared、services/commerce。
  - 验证结果：commerce tests、miniapp typecheck、miniapp isolated mock tests、admin-web build 均通过。
  - 负责人：当前分支联调改造。

