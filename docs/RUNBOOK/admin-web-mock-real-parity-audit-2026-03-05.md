# Admin-Web Mock/Real 联调一致性调研报告（2026-03-05）

## 1. 调研目标与范围

本报告聚焦 `apps/admin-web`，目标是回答三件事：

1. 当前 mock 与 real 两种运行模式的实现是否一致。
2. 不同角色登录账号是否已创建，登录后可查看范围是否有清晰边界。
3. 哪些页面/函数在 mock 可用但 real 可能缺失，下一步如何拉齐开发体验。

本次调研覆盖：

- 前端双栈：`apps/admin-web/src` 下 React + legacy JS 全量源码。
- 接口层：`apps/admin-web/src/lib/api.js` 全部导出方法。
- real 后端链路：`services/gateway-bff`、`services/identity`、`services/commerce` 路由注册。
- 账号与权限：`packages/shared/src/mock-data/auth.js`、`services/identity/README.md`、`apps/admin-web/src/lib/permissions.js`。

## 2. 当前实现现状（结论）

### 2.1 前端架构现状：双栈并行

`admin-web` 当前是 React 页面壳 + legacy JS 业务实现并存。

- 各页面 HTML 默认加载 React entry（`/src/react/entries/*.tsx`）。
- 多数 entry 在 mount 后会动态 `import('../../*.js')` 执行 legacy 逻辑。

这意味着联调时存在两层实现口径：

1. React 组件层（视觉 + 状态）
2. legacy JS 层（大量真实业务流程）

### 2.2 模式切换机制

- 模式开关：`VITE_ADMIN_WEB_MODE`（`mock` / `dev`）
- 关键文件：`apps/admin-web/src/lib/env.js`
- API baseUrl 逻辑：`apps/admin-web/src/lib/api.js`

当前逻辑是：

- `dev`：默认通过 `/api` 走 gateway real 链路。
- `mock`：保留本地 mock 会话与页面分支逻辑。

### 2.3 关键风险摘要

1. `TransferPage` 与 `InquiriesPage` 存在大量 `isMockMode` 分支，mock/real 行为漂移风险高。
2. 若页面入口未加载 legacy JS（如 `import`、`support`），会出现 UI 可见但 real 功能未接线的假象。
3. 页面权限分界虽然存在（`canAccessPath`），但页面内部动作级权限仍需补齐（不是所有按钮都做了后端权限失败兜底）。

## 3. 登录账号与角色边界核查

### 3.1 mock 账号（已创建）

来源：`packages/shared/src/mock-data/auth.js`

- `admin / admin123` -> `ADMIN`
- `boss / boss123` -> `BOSS`
- `manager / manager123` -> `MANAGER`
- `cs / cs123` -> `CS`

### 3.2 real 账号（seed 文档已定义）

来源：`services/identity/README.md`

- `admin / admin123`
- `boss / boss123`
- `manager / manager123`
- `cs / cs123`

并明确：admin-web password login 角色白名单是 `BOSS/MANAGER/ADMIN/CS`。

### 3.3 登录后页面分界（当前实现）

来源：`apps/admin-web/src/lib/permissions.js` + `apps/admin-web/src/lib/guard.js`

- `/dashboard.html`：默认可访问
- `/products.html`：`catalog:read` 或 `product:manage`
- `/orders.html`：`order:read`
- `/import.html`：`import:product/import:shipment/product_request:export/config:feature_flags`
- `/inquiries.html`、`/quote-workflow.html`、`/suppliers.html`：`inquiry:*` 或 `product_request:read`
- `/transfer.html`：`customer:read` 或 `customer:transfer`
- `/support.html`：`customer:read`
- `/settings.html`：`config:feature_flags` 或 `staff:read` 或 `rbac:manage`
- `/rbac.html`：`rbac:manage`

结论：账号与页面边界已经具备统一实现基础，但动作级能力与接口兜底仍不完全一致。

## 4. 前端页面与 real 后端映射现状

### 4.1 入口层接线情况（React entry）

- `dashboard/orders/products/payments/quote-workflow/rbac/settings/suppliers/exports/transfer`：会动态加载对应 legacy JS（多为 `ensureProtectedPage` 或完整业务逻辑）。
- `inquiries`：React 页面自己做 real 请求，bootstrap 只执行 `ensureProtectedPage`。
- `import`：当前仅 React 页面壳，未加载 legacy `import.js`。
- `support`：当前仅 React 页面壳，bootstrap 返回 `undefined`。

结论：`import/support` 是最明显的“UI 与 real 功能断层”候选点。

### 4.2 API 层与 real 路由覆盖

`lib/api.js` 当前导出 35 个接口方法，核心路径可分为 4 类：

1. identity（登录、客户、管理端客户域）
2. commerce（商品、订单、询价、导入导出）
3. gateway-bff（`/bff/bootstrap`、`/bff/admin/summary`）
4. admin 扩展（`/admin/*`）

real 路由核查结果：

- `identity`：`/auth/password/login`、`/customers`、`/admin/config/feature-flags`、`/admin/sales-users`、`/admin/customers*`、`/admin/customer-tags*` 均在 `services/identity/internal/http/server.go` 注册。
- `commerce`：`/catalog/*`、`/orders*`、`/inquiries/price*`、`/product-requests`、`/admin/products/import-jobs`、`/admin/shipments/import-jobs`、`/admin/product-requests/export-jobs`、`/admin/import-jobs/{jobId}`、`/admin/miniapp/display-categories` 在 `services/commerce/internal/http/server.go` 注册。
- `gateway-bff`：对应转发规则在 `services/gateway-bff/internal/http/server.go` 已配置。

结论：后端 real 接口主干已具备，当前风险更多在前端页面层“是否真正接线并在 real 模式走通”。

## 5. mock/real 漂移高风险点

### 5.1 高风险模块

1. `TransferPage.tsx`
- `isMockMode` 条件分支密集（销售、客户、标签、账期、批量转移等动作）。
- 若 real 返回结构变化，mock 分支不会暴露问题。

2. `InquiriesPage.tsx`
- 列表/详情/消息发送均有 mock 条件路径。
- 容易出现 mock 可聊天但 real 状态迁移不一致。

3. `import.html` 对应 React `ImportPage`
- 目前页面主流程偏静态演示，real API 调用主要在 legacy `import.js`。
- 若联调只走新页面，会误判功能已实现。

4. `support.html` 对应 React `SupportWorkspacePage`
- 目前偏静态工作台，未看到与 real 客户/会话接口的明确接线。

### 5.2 双栈维护风险

- 同名页面的 React 与 legacy 行为可能出现职责重叠或断层。
- 当 one-side 更新接口字段时，另一侧可能不知情。

## 6. 下一步优化点（执行优先级）

### P0（必须先做）

1. 建立“页面动作 -> API -> real 路由 -> 权限码”单一对照表并纳入 CI 检查。
2. 对 `Transfer/Inquiries` 抽离统一 data adapter，减少页面内 `isMockMode` 业务分叉。
3. `import/support` 明确状态：
   - 要么接入 real API 完整流程；
   - 要么页面显式标记 `real not wired`，避免误导联调。

### P1（紧随其后）

1. 为每个页面补“real 失败兜底”规范：401/403/404/409/5xx 的统一展示与重试策略。
2. 增加角色回归集：`admin/boss/manager/cs` 在 mock/dev 下页面可见性与关键动作一致。

### P2（体验拉齐）

1. 在 `lib/api` 之上增加统一 response normalizer，保证 mock/real 数据 shape 一致。
2. 增加联调 smoke 脚本：启动 mock 与 dev 两套，跑同一用户剧本并输出差异。

## 7. 执行建议（面向下一轮“加注释 + 对齐改造”）

建议按以下顺序推进：

1. 先改 `lib/api` 与 `Transfer/Inquiries`，把 mock 分叉收敛到数据层。
2. 再处理 `import/support` 的 real 接线或显式降级说明。
3. 最后做全量函数注释落地（优先高风险文件：`products.js`、`orders.js`、`TransferPage.tsx`、`InquiriesPage.tsx`）。

---
# 附录A：Admin-Web 逐函数与组件清单

> 自动扫描范围：`apps/admin-web/src/**/*.{js,ts,tsx}`。说明为简要职责推断，供联调盘点使用。

## apps/admin-web/src/dashboard.js

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| buildRows | 14 | arrow | 业务转换/格式化工具 |
| mountDevLayout | 47 | arrow | 页面初始化/挂载入口 |
| renderSummaryCards | 88 | arrow | 渲染 UI 片段 |
| renderWarnings | 120 | arrow | 渲染 UI 片段 |
| renderActivityRows | 141 | arrow | 渲染 UI 片段 |
| renderExtraPanels | 165 | arrow | 渲染 UI 片段 |
| initDashboard | 176 | arrow | 页面初始化/挂载入口 |

## apps/admin-web/src/exports.js

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| initExportsPage | 3 | arrow | 页面初始化/挂载入口 |

## apps/admin-web/src/import.js

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| pickFile | 19 | arrow | 本地业务流程/工具函数 |
| renderResult | 31 | arrow | 渲染 UI 片段 |
| renderFeatureFlags | 38 | arrow | 渲染 UI 片段 |
| mountDevLayout | 46 | arrow | 页面初始化/挂载入口 |
| initImportTools | 87 | arrow | 页面初始化/挂载入口 |

## apps/admin-web/src/inquiries.js

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| countOpenInquiries | 12 | arrow | 业务转换/格式化工具 |
| normalizeInquiryStatus | 21 | arrow | 业务转换/格式化工具 |
| setMockFilterButtonState | 25 | arrow | 设置本地状态 |
| ensureMockFilterEmptyState | 33 | arrow | 本地业务流程/工具函数 |
| initMockStatusFilter | 50 | arrow | 页面初始化/挂载入口 |
| applyStatusFilter | 61 | arrow | 本地业务流程/工具函数 |
| mountDevLayout | 94 | arrow | 页面初始化/挂载入口 |
| renderMetrics | 128 | arrow | 渲染 UI 片段 |
| renderInquiryRows | 144 | arrow | 渲染 UI 片段 |
| initInquiries | 172 | arrow | 页面初始化/挂载入口 |

## apps/admin-web/src/lib/api.js

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| toHeaderRecord | 24 | arrow | 本地业务流程/工具函数 |
| parseBody | 35 | arrow | 业务转换/格式化工具 |
| requester | 47 | arrow | 本地业务流程/工具函数 |
| joinPath | 81 | arrow | 本地业务流程/工具函数 |
| requestRaw | 90 | exported-arrow | 本地业务流程/工具函数 |
| passwordLogin | 130 | exported-arrow | 登录会话处理 |
| bootstrap | 139 | exported-arrow | 登录会话处理 |
| fetchProducts | 143 | exported-arrow | 读取后端数据 |
| createCatalogProduct | 147 | exported-arrow | 创建/提交后端数据 |
| fetchCatalogCategories | 151 | exported-arrow | 读取后端数据 |
| createCatalogCategory | 155 | exported-arrow | 创建/提交后端数据 |
| updateCatalogCategory | 159 | exported-arrow | 更新后端数据 |
| deleteCatalogCategory | 163 | exported-arrow | 删除后端数据 |
| fetchOrders | 167 | exported-arrow | 读取后端数据 |
| fetchInquiries | 171 | exported-arrow | 读取后端数据 |
| fetchInquiryById | 175 | exported-arrow | 读取后端数据 |
| fetchInquiryMessages | 179 | exported-arrow | 读取后端数据 |
| postInquiryMessage | 183 | exported-arrow | 创建/提交后端数据 |
| patchInquiry | 187 | exported-arrow | 更新后端数据 |
| fetchProductRequests | 191 | exported-arrow | 读取后端数据 |
| createShipmentImportJob | 195 | exported-arrow | 创建/提交后端数据 |
| createAdminProductImportJob | 199 | exported-arrow | 创建/提交后端数据 |
| createAdminProductRequestExportJob | 211 | exported-arrow | 创建/提交后端数据 |
| getAdminImportJob | 218 | exported-arrow | 读取状态/数据 |
| getFeatureFlags | 222 | exported-arrow | 读取状态/数据 |
| patchFeatureFlags | 226 | exported-arrow | 更新后端数据 |
| fetchAdminSummary | 233 | exported-arrow | 读取后端数据 |
| fetchCustomers | 237 | exported-arrow | 读取后端数据 |
| fetchMiniappDisplayCategories | 241 | exported-arrow | 读取后端数据 |
| replaceMiniappDisplayCategories | 245 | exported-arrow | 本地业务流程/工具函数 |
| buildQueryString | 252 | arrow | 业务转换/格式化工具 |
| fetchAdminSalesUsers | 272 | exported-arrow | 读取后端数据 |
| fetchAdminCustomers | 276 | exported-arrow | 读取后端数据 |
| batchTransferCustomers | 280 | exported-arrow | 本地业务流程/工具函数 |
| fetchAdminCustomerTags | 287 | exported-arrow | 读取后端数据 |
| createAdminCustomerTag | 291 | exported-arrow | 创建/提交后端数据 |
| patchAdminCustomerTag | 298 | exported-arrow | 更新后端数据 |
| batchUpdateCustomerTags | 305 | exported-arrow | 本地业务流程/工具函数 |
| getAdminCustomerFinanceProfile | 312 | exported-arrow | 读取状态/数据 |
| patchAdminCustomerFinanceProfile | 316 | exported-arrow | 更新后端数据 |

## apps/admin-web/src/lib/auth.js

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| toDisplayName | 23 | arrow | 本地业务流程/工具函数 |
| getRoleLabel | 33 | exported-arrow | 读取状态/数据 |
| goToLogin | 38 | exported-arrow | 登录会话处理 |
| goToDashboard | 42 | exported-arrow | 本地业务流程/工具函数 |
| logout | 46 | exported-arrow | 登录会话处理 |
| buildLegacyMockSession | 51 | arrow | 登录会话处理 |
| buildMockSessionFromAccount | 70 | arrow | 登录会话处理 |
| loginMock | 101 | exported-arrow | 登录会话处理 |
| inferCurrentRole | 115 | arrow | 本地业务流程/工具函数 |
| loginDev | 132 | exported-arrow | 登录会话处理 |
| refreshBootstrap | 156 | exported-arrow | 登录会话处理 |
| getCurrentSession | 189 | exported-arrow | 读取状态/数据 |
| isLoggedIn | 199 | exported-arrow | 本地业务流程/工具函数 |
| getDisplayProfile | 206 | exported-arrow | 读取状态/数据 |

## apps/admin-web/src/lib/guard.js

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| bindLogoutActions | 14 | arrow | 登录会话处理 |
| applyProfile | 37 | arrow | 本地业务流程/工具函数 |
| hasPermissionItems | 53 | arrow | 权限校验/访问控制 |
| notifyLegacyMockSession | 57 | arrow | 登录会话处理 |
| ensureProtectedPage | 69 | exported-arrow | React 组件 |

## apps/admin-web/src/lib/i18n-zh.js

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| escapeRegExp | 218 | arrow | 本地业务流程/工具函数 |
| hasEnglish | 227 | arrow | 本地业务流程/工具函数 |
| translateValue | 229 | arrow | 本地业务流程/工具函数 |
| shouldSkipTextNode | 241 | arrow | 本地业务流程/工具函数 |
| translateTextNode | 254 | arrow | 本地业务流程/工具函数 |
| translateAttributes | 268 | arrow | 本地业务流程/工具函数 |
| translateTree | 286 | arrow | 本地业务流程/工具函数 |
| scheduleTranslate | 309 | arrow | 本地业务流程/工具函数 |
| installZhLocalization | 323 | exported-arrow | 本地业务流程/工具函数 |

## apps/admin-web/src/lib/mock-accounts.js

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| cloneMockAccount | 3 | arrow | 本地业务流程/工具函数 |
| listMockAccounts | 12 | exported-arrow | 本地业务流程/工具函数 |
| resolveMockAccount | 16 | exported-arrow | 业务转换/格式化工具 |

## apps/admin-web/src/lib/permissions.js

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| rankScope | 1 | arrow | 本地业务流程/工具函数 |
| normalizePermissionMap | 9 | exported-arrow | 权限校验/访问控制 |
| hasPermission | 24 | exported-arrow | 权限校验/访问控制 |
| resolveAccessTier | 35 | exported-arrow | 权限校验/访问控制 |
| canAccessPath | 48 | exported-arrow | 权限校验/访问控制 |

## apps/admin-web/src/lib/render.js

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| escapeHtml | 1 | arrow | 本地业务流程/工具函数 |
| formatDateTime | 13 | exported-arrow | 业务转换/格式化工具 |
| formatDate | 24 | exported-arrow | 业务转换/格式化工具 |
| formatCurrencyFen | 35 | exported-arrow | 业务转换/格式化工具 |
| safeText | 43 | exported-arrow | 本地业务流程/工具函数 |
| buildEmptyState | 51 | exported-arrow | 业务转换/格式化工具 |
| buildErrorState | 60 | exported-arrow | 业务转换/格式化工具 |
| renderEmptyState | 70 | exported-arrow | 渲染 UI 片段 |
| renderErrorState | 77 | exported-arrow | 渲染 UI 片段 |
| toStatusBadge | 84 | exported-arrow | React 组件 |

## apps/admin-web/src/lib/state.js

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| readJson | 3 | arrow | 本地业务流程/工具函数 |
| writeJson | 19 | arrow | 本地业务流程/工具函数 |
| removeKey | 27 | arrow | 本地业务流程/工具函数 |
| readMockSession | 35 | exported-arrow | 登录会话处理 |
| saveMockSession | 37 | exported-arrow | 登录会话处理 |
| clearMockSession | 41 | exported-arrow | 登录会话处理 |
| readAuthState | 45 | exported-arrow | 登录会话处理 |
| saveAuthState | 47 | exported-arrow | 登录会话处理 |
| clearAuthState | 51 | exported-arrow | 登录会话处理 |
| getAccessToken | 55 | exported-arrow | 读取状态/数据 |
| clearAllSessions | 63 | exported-arrow | 登录会话处理 |

## apps/admin-web/src/main.js

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| normalizeRoles | 24 | arrow | 业务转换/格式化工具 |
| showError | 32 | arrow | 本地业务流程/工具函数 |
| clearError | 41 | arrow | 本地业务流程/工具函数 |
| showRoleModal | 47 | arrow | 弹层/抽屉交互 |
| cleanup | 66 | arrow | 本地业务流程/工具函数 |
| onClickOption | 74 | arrow | 本地业务流程/工具函数 |
| onCancel | 82 | arrow | 本地业务流程/工具函数 |
| setFormPending | 92 | arrow | 设置本地状态 |
| initSessionRedirect | 106 | arrow | 页面初始化/挂载入口 |

## apps/admin-web/src/orders.js

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| calcAmountFen | 52 | arrow | 本地业务流程/工具函数 |
| initials | 66 | arrow | 页面初始化/挂载入口 |
| countByStatuses | 78 | arrow | 业务转换/格式化工具 |
| buildStatusBadge | 83 | arrow | 业务转换/格式化工具 |
| sumLineItemQty | 92 | arrow | 本地业务流程/工具函数 |
| buildLineItemEditRow | 107 | arrow | 业务转换/格式化工具 |
| collectLineItemsFromDrawer | 137 | arrow | 弹层/抽屉交互 |
| refreshDrawerProductCount | 155 | arrow | 弹层/抽屉交互 |
| renderDetailLineItemEditor | 164 | arrow | 渲染 UI 片段 |
| ensureOrderDetailDrawer | 174 | arrow | 弹层/抽屉交互 |
| close | 254 | arrow | 本地业务流程/工具函数 |
| getValue | 316 | arrow | 读取状态/数据 |
| openOrderDetailDrawer | 368 | arrow | 弹层/抽屉交互 |
| setInput | 378 | arrow | 设置本地状态 |
| mockOrder | 407 | arrow | 本地业务流程/工具函数 |
| buildMockOrders | 436 | arrow | 业务转换/格式化工具 |
| buildLineItemsFromFixtureItems | 853 | arrow | 业务转换/格式化工具 |
| buildTimelineFromTracking | 867 | arrow | 业务转换/格式化工具 |
| buildCanonicalMockOrders | 882 | arrow | 业务转换/格式化工具 |
| mountDevLayout | 941 | arrow | 页面初始化/挂载入口 |
| renderDevMetrics | 976 | arrow | 渲染 UI 片段 |
| renderDevOrdersTable | 993 | arrow | 渲染 UI 片段 |
| renderDevSummaryText | 1031 | arrow | 渲染 UI 片段 |
| initDevOrders | 1040 | arrow | 页面初始化/挂载入口 |
| setElementText | 1063 | arrow | 设置本地状态 |
| renderMockTimeline | 1071 | arrow | 渲染 UI 片段 |
| renderMockLogisticsPanel | 1115 | arrow | 渲染 UI 片段 |
| initMockOrders | 1140 | arrow | 页面初始化/挂载入口 |
| byTab | 1158 | arrow | 本地业务流程/工具函数 |
| findById | 1159 | arrow | 本地业务流程/工具函数 |
| updateOrderById | 1160 | arrow | 更新后端数据 |
| totalPages | 1169 | arrow | 本地业务流程/工具函数 |
| applyTabStyles | 1171 | arrow | 本地业务流程/工具函数 |
| getPagedOrders | 1203 | arrow | 读取状态/数据 |
| ensureSelectedOrder | 1220 | arrow | 本地业务流程/工具函数 |
| renderSummary | 1227 | arrow | 渲染 UI 片段 |
| renderTable | 1238 | arrow | 渲染 UI 片段 |
| renderPagination | 1275 | arrow | 渲染 UI 片段 |
| render | 1281 | arrow | 渲染 UI 片段 |
| initOrders | 1338 | arrow | 页面初始化/挂载入口 |

## apps/admin-web/src/payments.js

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| initPaymentsPage | 3 | arrow | 页面初始化/挂载入口 |

## apps/admin-web/src/products.js

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| resolveCanonicalTierLabel | 192 | arrow | 业务转换/格式化工具 |
| normalizeProductText | 230 | arrow | 业务转换/格式化工具 |
| toNumber | 260 | arrow | 本地业务流程/工具函数 |
| toMoney | 268 | arrow | 本地业务流程/工具函数 |
| toPositiveInt | 276 | arrow | 本地业务流程/工具函数 |
| formatCurrency | 284 | arrow | 业务转换/格式化工具 |
| formatDiscountFold | 288 | arrow | 业务转换/格式化工具 |
| resolveLegacyTierLabel | 294 | arrow | 业务转换/格式化工具 |
| resolveBasePriceCandidate | 301 | arrow | 业务转换/格式化工具 |
| normalizeModelCode | 315 | arrow | 业务转换/格式化工具 |
| normalizeModelSettings | 324 | arrow | 业务转换/格式化工具 |
| inferTierPricingFromLegacyLabel | 357 | arrow | 本地业务流程/工具函数 |
| normalizeTierPricing | 365 | arrow | 业务转换/格式化工具 |
| resolveTierSummaryLabel | 407 | arrow | 业务转换/格式化工具 |
| normalizeCategoryItem | 415 | arrow | 业务转换/格式化工具 |
| sortCategories | 430 | arrow | 本地业务流程/工具函数 |
| getDisplayIconOption | 440 | arrow | 读取状态/数据 |
| inferDisplayCategoryIconKey | 445 | arrow | 本地业务流程/工具函数 |
| normalizeDisplayCategoryItem | 471 | arrow | 业务转换/格式化工具 |
| sortDisplayCategories | 488 | arrow | 本地业务流程/工具函数 |
| saveDisplayCategoriesToStorage | 498 | arrow | 本地业务流程/工具函数 |
| readDisplayCategoriesFromStorage | 505 | arrow | 本地业务流程/工具函数 |
| setDisplayCategories | 524 | arrow | 设置本地状态 |
| resolveDisplayCategoryIconSymbol | 532 | arrow | 业务转换/格式化工具 |
| buildDisplayCategoryIconOptions | 536 | arrow | 业务转换/格式化工具 |
| getDisplayCategoryById | 543 | arrow | 读取状态/数据 |
| getCategoryById | 551 | arrow | 读取状态/数据 |
| resolveCategoryLabelById | 559 | arrow | 业务转换/格式化工具 |
| rebuildCategoryLookup | 567 | arrow | 本地业务流程/工具函数 |
| saveCategoriesToStorage | 579 | arrow | 本地业务流程/工具函数 |
| readCategoriesFromStorage | 586 | arrow | 本地业务流程/工具函数 |
| setCategories | 605 | arrow | 设置本地状态 |
| buildCategorySelectOptionsHtml | 614 | arrow | 业务转换/格式化工具 |
| buildCategoryFilterOptionsHtml | 623 | arrow | 业务转换/格式化工具 |
| buildStatusFilterOptionsHtml | 634 | arrow | 业务转换/格式化工具 |
| syncCategorySelectOptions | 638 | arrow | 本地业务流程/工具函数 |
| normalizeStatusValue | 674 | arrow | 业务转换/格式化工具 |
| readBackgroundImageUrl | 695 | arrow | 本地业务流程/工具函数 |
| upsertProductInState | 701 | arrow | 本地业务流程/工具函数 |
| getSummaryElement | 711 | arrow | 读取状态/数据 |
| getProductsTable | 715 | arrow | 读取状态/数据 |
| getSelectAllProductsCheckbox | 719 | arrow | 读取状态/数据 |
| getProductRowCheckboxes | 728 | arrow | 读取状态/数据 |
| syncSelectAllProductsState | 738 | arrow | 本地业务流程/工具函数 |
| setCurrentPageRowsSelected | 758 | arrow | 设置本地状态 |
| getPaginationContainer | 766 | arrow | 读取状态/数据 |
| getPrevPageButton | 770 | arrow | 读取状态/数据 |
| getNextPageButton | 774 | arrow | 读取状态/数据 |
| getTotalPages | 778 | arrow | 读取状态/数据 |
| isCategoryMatched | 783 | arrow | 本地业务流程/工具函数 |
| isStatusMatched | 795 | arrow | 本地业务流程/工具函数 |
| getFilteredProducts | 803 | arrow | 读取状态/数据 |
| updateSummary | 815 | arrow | 更新后端数据 |
| resolveCategoryTag | 823 | arrow | 业务转换/格式化工具 |
| resolveTierLabel | 838 | arrow | 业务转换/格式化工具 |
| resolveModelClass | 843 | arrow | 业务转换/格式化工具 |
| resolveInventory | 848 | arrow | 业务转换/格式化工具 |
| normalizeProductItem | 859 | arrow | 业务转换/格式化工具 |
| rebuildProductIndexes | 883 | arrow | 本地业务流程/工具函数 |
| toProductStatusBadge | 890 | arrow | React 组件 |
| toModelClassBadge | 937 | arrow | React 组件 |
| renderProductRow | 945 | arrow | 渲染 UI 片段 |
| buildPageTokens | 981 | arrow | 业务转换/格式化工具 |
| renderPagination | 1002 | arrow | 渲染 UI 片段 |
| renderCurrentPage | 1031 | arrow | 渲染 UI 片段 |
| applyProducts | 1078 | arrow | 本地业务流程/工具函数 |
| renderProducts | 1087 | arrow | 渲染 UI 片段 |
| createMockProducts | 1093 | arrow | 创建/提交后端数据 |
| buildProductsQueryParams | 1132 | arrow | 业务转换/格式化工具 |
| applyProductFilters | 1144 | arrow | 本地业务流程/工具函数 |
| goToPage | 1167 | arrow | React 组件 |
| bindPaginationActions | 1190 | arrow | 本地业务流程/工具函数 |
| bindFilterActions | 1221 | arrow | 本地业务流程/工具函数 |
| showToast | 1247 | arrow | 本地业务流程/工具函数 |
| toMinimalErrorReason | 1273 | arrow | 本地业务流程/工具函数 |
| closeCreateModal | 1289 | arrow | 弹层/抽屉交互 |
| openCreateModal | 1298 | arrow | 弹层/抽屉交互 |
| appendProductRow | 1316 | arrow | React 组件 |
| createLocalProduct | 1325 | arrow | 创建/提交后端数据 |
| collectFormData | 1349 | arrow | 本地业务流程/工具函数 |
| getProductFromRow | 1361 | arrow | 读取状态/数据 |
| updateRowFromProduct | 1397 | arrow | 更新后端数据 |
| replaceProductInCollection | 1448 | arrow | 本地业务流程/工具函数 |
| closeEditDrawer | 1464 | arrow | 弹层/抽屉交互 |
| updateDrawerPreview | 1475 | arrow | 更新后端数据 |
| ensureImagePreviewModal | 1495 | arrow | 弹层/抽屉交互 |
| close | 1514 | arrow | 本地业务流程/工具函数 |
| openImagePreview | 1529 | arrow | 本地业务流程/工具函数 |
| buildModelRowHtml | 1545 | arrow | 业务转换/格式化工具 |
| buildTierRowHtml | 1566 | arrow | 业务转换/格式化工具 |
| getDrawerModelRows | 1583 | arrow | 读取状态/数据 |
| getDrawerTierRows | 1587 | arrow | 读取状态/数据 |
| syncModelRowActions | 1591 | arrow | 本地业务流程/工具函数 |
| getPrimaryModelBasePrice | 1605 | arrow | 读取状态/数据 |
| updateTierPricePreviews | 1617 | arrow | 更新后端数据 |
| renderDrawerModels | 1639 | arrow | 渲染 UI 片段 |
| renderDrawerTiers | 1650 | arrow | 渲染 UI 片段 |
| appendDrawerModelRow | 1663 | arrow | 弹层/抽屉交互 |
| appendDrawerTierRow | 1685 | arrow | 弹层/抽屉交互 |
| collectDrawerModels | 1706 | arrow | 弹层/抽屉交互 |
| collectDrawerTierPricing | 1735 | arrow | 弹层/抽屉交互 |
| ensureEditDrawer | 1775 | arrow | 弹层/抽屉交互 |
| openEditDrawer | 2026 | arrow | 弹层/抽屉交互 |
| setFormValue | 2044 | arrow | 设置本地状态 |
| hydrateStaticRows | 2074 | arrow | 本地业务流程/工具函数 |
| bindSelectionActions | 2110 | arrow | 本地业务流程/工具函数 |
| bindProductRowActions | 2133 | arrow | 本地业务流程/工具函数 |
| ensureCreateModal | 2155 | arrow | 弹层/抽屉交互 |
| bindCreateProductAction | 2316 | arrow | 本地业务流程/工具函数 |
| rebuildProductsAfterCategoryChange | 2327 | arrow | 本地业务流程/工具函数 |
| toCategoryPayload | 2334 | arrow | 本地业务流程/工具函数 |
| shouldUseLocalCategoryStore | 2342 | arrow | 本地业务流程/工具函数 |
| toDisplayCategoryPayload | 2346 | arrow | 本地业务流程/工具函数 |
| persistDisplayCategories | 2358 | arrow | 本地业务流程/工具函数 |
| loadDisplayCategories | 2373 | arrow | 本地业务流程/工具函数 |
| closeDisplayCategoryManagerModal | 2394 | arrow | 弹层/抽屉交互 |
| renderDisplayCategoryPreview | 2403 | arrow | 渲染 UI 片段 |
| renderDisplayCategoryManagerBody | 2431 | arrow | 渲染 UI 片段 |
| ensureDisplayCategoryManagerModal | 2481 | arrow | 弹层/抽屉交互 |
| openDisplayCategoryManagerModal | 2688 | arrow | 弹层/抽屉交互 |
| bindDisplayCategoryManageAction | 2695 | arrow | 本地业务流程/工具函数 |
| closeCategoryManagerModal | 2706 | arrow | 弹层/抽屉交互 |
| buildCategoryParentOptions | 2715 | arrow | 业务转换/格式化工具 |
| renderCategoryManagerBody | 2726 | arrow | 渲染 UI 片段 |
| ensureCategoryManagerModal | 2769 | arrow | 弹层/抽屉交互 |
| openCategoryManagerModal | 2986 | arrow | 弹层/抽屉交互 |
| bindCategoryManageAction | 2993 | arrow | 本地业务流程/工具函数 |
| loadCategories | 3004 | arrow | 本地业务流程/工具函数 |
| initProducts | 3028 | arrow | 页面初始化/挂载入口 |

## apps/admin-web/src/quote-workflow.js

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| initQuoteWorkflowPage | 3 | arrow | 页面初始化/挂载入口 |

## apps/admin-web/src/rbac.js

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| initRbacPage | 3 | arrow | 页面初始化/挂载入口 |

## apps/admin-web/src/react/layout/AdminSidebar.tsx

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| itemClass | 32 | arrow | 本地业务流程/工具函数 |
| AdminSidebar | 44 | exported-arrow | React 组件 |

## apps/admin-web/src/react/layout/AdminTopbar.tsx

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| joinClasses | 14 | arrow | 本地业务流程/工具函数 |
| handlePointerDown | 34 | arrow | 本地业务流程/工具函数 |
| handleEscape | 44 | arrow | 本地业务流程/工具函数 |
| handleMenuToggle | 61 | arrow | 本地业务流程/工具函数 |
| closeMenu | 65 | arrow | 本地业务流程/工具函数 |
| handleLogout | 69 | arrow | 登录会话处理 |

## apps/admin-web/src/react/pages/LoginPage.tsx

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| LoginPage | 1 | exported-arrow | 登录会话处理 |

## apps/admin-web/src/react/pages/admin/DashboardPage.tsx

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| DashboardPage | 3 | exported-arrow | React 组件 |

## apps/admin-web/src/react/pages/admin/ExportsPage.tsx

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| ExportsPage | 3 | exported-arrow | React 组件 |

## apps/admin-web/src/react/pages/admin/ImportPage.tsx

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| renderRowAction | 107 | arrow | 渲染 UI 片段 |
| ImportPage | 153 | exported-arrow | React 组件 |

## apps/admin-web/src/react/pages/admin/InquiriesPage.tsx

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| safeText | 189 | arrow | 本地业务流程/工具函数 |
| formatDateTime | 287 | arrow | 业务转换/格式化工具 |
| formatShortId | 302 | arrow | 业务转换/格式化工具 |
| getStatusLabel | 309 | arrow | 读取状态/数据 |
| getStatusClassName | 314 | arrow | 读取状态/数据 |
| getSenderLabel | 324 | arrow | 读取状态/数据 |
| buildInquiryLink | 334 | arrow | 业务转换/格式化工具 |
| readInitialInquiryId | 343 | arrow | 本地业务流程/工具函数 |
| InquiriesPage | 377 | exported-arrow | React 组件 |
| loadThread | 504 | arrow | 本地业务流程/工具函数 |

## apps/admin-web/src/react/pages/admin/OrdersPage.tsx

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| StatusBadge | 124 | arrow | React 组件 |
| OrderTableRow | 141 | arrow | React 组件 |
| TabLink | 182 | arrow | React 组件 |
| OrdersPage | 237 | exported-arrow | React 组件 |

## apps/admin-web/src/react/pages/admin/PaymentsPage.tsx

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| PaymentsPage | 3 | exported-arrow | React 组件 |

## apps/admin-web/src/react/pages/admin/ProductsPage.tsx

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| ProductStatusBadge | 132 | arrow | React 组件 |
| ProductTableRow | 146 | arrow | React 组件 |
| ProductsPage | 213 | exported-arrow | React 组件 |

## apps/admin-web/src/react/pages/admin/QuoteWorkflowPage.tsx

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| WorkflowStepBadge | 116 | arrow | React 组件 |
| QuoteVersionRow | 149 | arrow | React 组件 |
| NegotiationMessage | 181 | arrow | React 组件 |
| QuoteWorkflowPage | 211 | exported-arrow | React 组件 |

## apps/admin-web/src/react/pages/admin/RbacPage.tsx

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| RoleCard | 85 | arrow | React 组件 |
| PermissionRow | 112 | arrow | 权限校验/访问控制 |
| RbacPage | 130 | exported-arrow | React 组件 |

## apps/admin-web/src/react/pages/admin/SettingsPage.tsx

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| ToggleRow | 34 | arrow | React 组件 |
| SettingsPage | 57 | exported-arrow | 设置本地状态 |

## apps/admin-web/src/react/pages/admin/SuppliersPage.tsx

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| SuppliersPage | 3 | exported-arrow | React 组件 |

## apps/admin-web/src/react/pages/admin/SupportWorkspacePage.tsx

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| Message | 190 | arrow | React 组件 |
| formatCurrentTime | 236 | arrow | 业务转换/格式化工具 |
| SupportWorkspacePage | 240 | exported-arrow | React 组件 |

## apps/admin-web/src/react/pages/admin/TransferPage.tsx

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| safeText | 131 | arrow | 本地业务流程/工具函数 |
| createMockId | 243 | arrow | 创建/提交后端数据 |
| formatDateTime | 250 | arrow | 业务转换/格式化工具 |
| TransferPage | 263 | exported-arrow | React 组件 |
| clearFeedback | 307 | arrow | 本地业务流程/工具函数 |
| refreshSalesUsers | 327 | arrow | 本地业务流程/工具函数 |
| refreshTags | 353 | arrow | 本地业务流程/工具函数 |
| refreshCustomers | 376 | arrow | 本地业务流程/工具函数 |
| refreshFinanceRemark | 447 | arrow | 本地业务流程/工具函数 |
| handleApplySearch | 493 | arrow | 本地业务流程/工具函数 |
| handleToggleSelectCustomer | 499 | arrow | 本地业务流程/工具函数 |
| handleToggleSelectAllCurrentPage | 508 | arrow | React 组件 |
| transferCustomerIds | 522 | arrow | 本地业务流程/工具函数 |
| handleTransferCustomers | 532 | arrow | 本地业务流程/工具函数 |
| handleBatchTagUpdate | 594 | arrow | 本地业务流程/工具函数 |
| handleCreateTag | 659 | arrow | 本地业务流程/工具函数 |
| handleToggleTagStatus | 706 | arrow | 本地业务流程/工具函数 |
| handleSaveRemark | 737 | arrow | 本地业务流程/工具函数 |

## apps/admin-web/src/react/runtime/mountAdminPage.tsx

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| normalizePath | 10 | arrow | 业务转换/格式化工具 |
| applyMainOverflowClass | 36 | arrow | 本地业务流程/工具函数 |
| AdminPage | 60 | arrow | React 组件 |
| mountAdminPage | 71 | exported-arrow | 页面初始化/挂载入口 |

## apps/admin-web/src/react/runtime/mountLoginPage.tsx

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| mountLoginPage | 7 | exported-arrow | 页面初始化/挂载入口 |

## apps/admin-web/src/settings.js

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| initSettingsPage | 3 | arrow | 页面初始化/挂载入口 |

## apps/admin-web/src/sidebar-layout.js

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| normalizePath | 4 | arrow | 业务转换/格式化工具 |
| currentKey | 24 | arrow | 本地业务流程/工具函数 |
| currentSettingKey | 37 | arrow | 本地业务流程/工具函数 |
| itemClass | 43 | arrow | 本地业务流程/工具函数 |
| settingClass | 50 | arrow | 设置本地状态 |

## apps/admin-web/src/suppliers.js

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| initSuppliersPage | 3 | arrow | 页面初始化/挂载入口 |

## apps/admin-web/src/transfer.js

| 名称 | 行号 | 类型 | 简要说明 |
|---|---:|---|---|
| initTransferPage | 3 | arrow | 页面初始化/挂载入口 |

