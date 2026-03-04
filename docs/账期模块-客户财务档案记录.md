# 客户账期模块记录（业务+技术双视角）

基线日期：2026-03-04  
文档定位：模块记录 + 决策依据（非 ExecPlan）

## 1. 背景与目标
“客户账期模块”当前落点是 admin-web 的客户管理场景，目标是在客户维度维护财务约定，先支持“账期配置 + 备注”，后续再衔接审批、发票和对账流程。

当前业务诉求有两个层次：
- 第一层是可落地：管理员可查看和维护客户账期信息。
- 第二层是可扩展：账期字段要能被校验、筛选、审计，并支持后续财务流程接入。

本记录基于当前分支真实代码状态，区分“已落地”和“未闭环”。

## 2. 业务链条总览
账期链条（Payment Term Chain）当前设计如下：

1. 客户检索：管理员在 admin-web 转移页检索客户（姓名/手机号/归属销售）。  
2. 读取档案：前端调用 `GET /admin/customers/{customerId}/finance-profile` 拉取客户财务档案（Finance Profile）。  
3. 编辑账期：管理员编辑结构化账期（Payment Term Config）与账期备注（Payment Term Remark）。  
4. 保存档案：前端调用 `PATCH /admin/customers/{customerId}/finance-profile` 提交。  
5. 后端校验：identity 服务按类型矩阵校验参数并写库。  
6. 审计记录：后端记录 `customer.finance_profile.update` 审计日志。  
7. 回读确认：前端刷新后再次读取 profile，确认持久化结果。

角色边界（Role Boundary）：
- admin：可读写。
- 非 admin：应返回 `403`，不可改。

## 3. 当前实现快照（按当前分支）
### 3.1 状态总览
- `已完成`：OpenAPI admin 契约已增加 finance-profile 路径与结构化字段。
- `已完成`：数据库迁移草案包含 `payment_term_remark` 与结构化账期字段约束。
- `已完成`：SQL 查询定义已改为结构化读写。
- `进行中`：identity handler 正在向结构化账期迁移，代码已改但未与 sqlc 生成对齐。
- `进行中`：admin-web 仍是 remark-only 页面与提交方式，未切换结构化表单。
- `阻塞`：identity 当前编译失败，导致后端回归测试不可执行。

### 3.2 关键事实证据
- 契约文件：`contracts/openapi/admin.yaml`、`contracts/openapi/openapi.yaml`
- 迁移文件：`services/identity/migrations/00005_add_customer_payment_term_remark.sql`、`services/identity/migrations/00006_add_customer_payment_term_fields.sql`
- SQL 定义：`services/identity/queries/identity.sql`
- 路由/处理器：`services/identity/internal/http/server.go`、`services/identity/internal/http/handler/admin.go`
- 前端 API/UI：`apps/admin-web/src/lib/api.js`、`apps/admin-web/src/react/pages/admin/TransferPage.tsx`
- 集成测试：`services/identity/internal/http/handler/integration_test.go`

## 4. 数据模型与约束
## 4.1 数据字段（identity.users）
`已完成`（迁移草案存在）：
- `payment_term_remark text null`
- `payment_term_type text null`
- `payment_term_days int null`
- `payment_term_custom_label text null`

## 4.2 约束矩阵（DB Constraint Matrix）
`已完成`（迁移草案存在）：
- `payment_term_type` 仅允许 `CASH` / `MONTHLY` / `CUSTOM` 或 `NULL`
- `CASH`：`days` 与 `custom_label` 必须为 `NULL`
- `MONTHLY`：`days` 必填且范围 `1..120`，`custom_label` 必须为 `NULL`
- `CUSTOM`：`custom_label` 必填且 `trim` 后长度 `1..50`，`days` 必须为 `NULL`
- 全空组合代表“未设置结构化账期”

## 4.3 历史数据语义
- 历史客户若只有 `payment_term_remark`，视为“仅备注、无结构化账期”。
- 结构化字段为 `NULL` 不等于错误，表示未配置账期类型。

## 5. API 契约与字段语义
## 5.1 Admin API
- `GET /admin/customers/{customerId}/finance-profile`
- `PATCH /admin/customers/{customerId}/finance-profile`

## 5.2 响应模型（目标态）
`AdminCustomerFinanceProfile`：
- `customerId: uuid`
- `paymentTerm: PaymentTermConfig | null`
- `paymentTermRemark: string | null`
- `updatedAt: RFC3339 date-time`

## 5.3 `PaymentTermConfig`
- `type: CASH | MONTHLY | CUSTOM`
- `monthlySettlementDays: integer | null`
- `customTermLabel: string | null`

## 5.4 PATCH 兼容策略
- 旧客户端：允许仅提交 `paymentTermRemark`（remark-only）。
- 新客户端：提交 `paymentTerm + paymentTermRemark`。

## 5.5 错误码语义
- `400`：请求体非法、字段组合非法、长度越界。
- `403`：非 admin 访问。
- `404`：客户不存在或非 customer。

## 6. 后端实现说明（identity）
## 6.1 路由层
`已完成`：
- `services/identity/internal/http/server.go` 注册了
  - `GET /admin/customers/:customerId/finance-profile`
  - `PATCH /admin/customers/:customerId/finance-profile`

## 6.2 查询层
`已完成`（定义层）：
- `GetCustomerFinanceProfile`：读取结构化账期 + 备注 + 更新时间
- `UpdateCustomerFinanceProfile`：原子更新结构化账期 + 备注

## 6.3 Handler 校验层
`进行中`：
- `admin.go` 已引入结构化校验逻辑和审计 metadata 扩展。
- 但当前 sqlc 生成代码仍旧是 remark-only 结构，字段与方法未对齐，导致编译失败。

## 6.4 审计日志
目标 action：`customer.finance_profile.update`  
目标 metadata（安全截断）：
- `customerId`
- `paymentTermType`
- `paymentTermDays`
- `customTermLabel`
- `paymentTermRemark`

当前状态：`进行中`（代码中已有方向性实现，待编译对齐后验证）。

## 7. 前端实现说明（admin-web）
## 7.1 API 封装
`进行中`：
- `getAdminCustomerFinanceProfile(customerId)` 已可调用 finance-profile GET。
- `patchAdminCustomerFinanceProfile(customerId, paymentTermRemark)` 仍是 remark-only 参数签名，未升级为结构化 payload。

## 7.2 TransferPage 页面
`进行中`：
- 已实现客户检索、选中客户、加载/编辑/保存备注、保存反馈。
- 当前 UI 仍是“账期备注 textarea”，尚未升级为“未设置/现款/月结/自定义 + 条件输入”的结构化表单。

## 7.3 运行模式策略
- `dev`：真实后端请求。
- `mock`：本地内存 mock。

当前状态：`进行中`（mock 结构仍偏 remark-only，需同步升级）。

## 8. 测试与验证结果
## 8.1 已执行命令（2026-03-04）
1. `go test ./...`（`services/identity`）
- 结果：`失败`
- 关键失败原因：
  - `GetCustomerFinanceProfileRow` 缺少 `PaymentTermType/PaymentTermDays/PaymentTermCustomLabel`
  - `Queries` 缺少 `UpdateCustomerFinanceProfile`
  - `db.UpdateCustomerFinanceProfileParams` 未生成
- 结论：sqlc 生成与 handler/queries 不一致，属于代码生成未对齐阻塞。

2. `pnpm -C apps/admin-web build`
- 结果：`通过`
- 结论：admin-web 当前代码可打包，但这不等价于结构化账期功能已闭环。

## 8.2 当前测试覆盖状态
- `已完成`：remark-only 的基本读取/更新/清空/403/404/超长校验集成测试已有。
- `未开始`：`CASH` / `MONTHLY` / `CUSTOM` 成功链路测试。
- `未开始`：非法组合矩阵（400）测试。
- `未开始`：旧 payload 与新 payload 兼容并存测试。

## 9. 优化点清单（含优化点1）
## 9.1 P0（必须先做）
1. 生成链路对齐  
- 范围：`identity` sqlc/oapi 生成 + 编译恢复 + 基础回归  
- 收益：解除主阻塞，恢复可验证状态。

2. 前后端 payload 对齐  
- 范围：`api.js` PATCH 参数签名升级、TransferPage 结构化提交  
- 收益：避免“契约是结构化、页面仍 remark-only”的语义错位。

3. 结构化账期集成测试补齐  
- 范围：success + invalid matrix + backward compatibility  
- 收益：防止未来改动破坏账期规则。

## 9.2 P1（应尽快做）
1. UI 交互优化  
- 月结默认建议值 `30`（仅前端预填，不后端隐式写入）  
- 字段级错误提示与提交前本地校验。

2. 审计可读性增强  
- metadata 字段长度和脱敏策略统一  
- 审计查询页面后续可按 customerId 过滤。

3. mock/dev 数据结构一致化  
- mock 返回也使用 `paymentTerm + paymentTermRemark`，降低联调偏差。

## 9.3 P2（后续阶段）
1. 财务流程联动  
- 对账单、发票、账期审批联动（本期不做）。

2. 订单快照联动  
- 下单时固化账期快照，避免后改影响历史订单解释。

3. 权限细分  
- 从 admin-only 演进到岗位级权限（主管、财务等）。

## 10. 已知风险与技术债
1. 代码生成未对齐风险  
- 现状：handler 先行改动，sqlc 代码未重生，导致整体编译失败。

2. 契约-实现漂移风险  
- 现状：OpenAPI 已结构化，但前端提交与测试仍 remark-only 为主。

3. 测试空洞风险  
- 现状：结构化账期关键路径缺少自动化覆盖。

4. DB 与应用双重校验一致性风险  
- 现状：DB 约束草案存在，应用层校验在迁移中，仍需双向验证。

## 11. 下一步执行清单（可直接转实现任务）
1. 执行 `tools/scripts/identity-generate.sh`，更新 `services/identity/internal/db/*`。  
2. 对齐 `admin.go` 与新生成 sqlc 类型，确保 `go test ./...` 可编译。  
3. 将 `api.js` PATCH 升级为结构化 payload 签名。  
4. 把 TransferPage 升级为“未设置/现款/月结/自定义 + 备注”表单。  
5. 升级 mock 数据结构，保持与 dev 语义一致。  
6. 补齐结构化账期集成测试矩阵。  
7. 重新执行并记录：
   - `go test ./...`（identity）
   - `pnpm -C apps/admin-web build`
   - 必要时 `pnpm run test:backend`

## 12. 附录
## 12.1 关键文件清单
- `contracts/openapi/admin.yaml`
- `contracts/openapi/openapi.yaml`
- `services/identity/migrations/00005_add_customer_payment_term_remark.sql`
- `services/identity/migrations/00006_add_customer_payment_term_fields.sql`
- `services/identity/queries/identity.sql`
- `services/identity/internal/http/server.go`
- `services/identity/internal/http/handler/admin.go`
- `services/identity/internal/http/handler/integration_test.go`
- `apps/admin-web/src/lib/api.js`
- `apps/admin-web/src/react/pages/admin/TransferPage.tsx`

## 12.2 状态标签定义
- `已完成`：已在当前分支代码中落地并可证实。
- `进行中`：已有实现但未闭环或未验证通过。
- `未开始`：尚未进入实现阶段。
- `阻塞`：存在前置问题，当前无法完成闭环。

