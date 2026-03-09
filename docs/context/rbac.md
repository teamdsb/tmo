# RBAC / Role Model (v1)

## Goals
- Support customer miniapp (browse, cart, intent order, requests, after-sales)
- Support internal roles (business follow-up, customer service + shipment operations, admin operations)
- Provide *scoped access* (customer sees self; sales sees owned customers; admin roles see all)
- Clarify work surfaces: miniapp vs admin-web

## User Types
- customer: external user authenticated via WeChat/Alipay miniapp
- staff: internal user
- admin: internal admin-web user
- 中文映射：`customer`（客户端用户）/ `staff`（内部员工）/ `admin`（管理后台用户）

## Roles (system roles)
- CUSTOMER: 客户（外部小程序用户）
- SALES: 业务员（仅在 miniapp 与客户交互、跟进）
- CS: 客服（合并原 CS + PROCUREMENT 职责，仅在 admin-web 工作）
- ADMIN: 管理员/超管（技术管理员，admin-web 全权）
- BOSS: 老板（业务全局最高权限）
- MANAGER: 经理（运营管理角色，具备员工与客户管理能力）

> 说明：`PROCUREMENT` 已并入 `CS`，不再作为独立角色分配。

## Work Surface (主要工作端)
- miniapp: `CUSTOMER`, `SALES`
- admin-web: `BOSS`, `MANAGER`, `ADMIN`, `CS`
- 在线客服会话：客户侧由 `CUSTOMER` 发起，后台由 `CS` 负责沟通；`SALES` 仅作为客户归属/上下文，不进入客服工作台。

## Login Role Rules
- `POST /auth/mini/login` only supports role selection: `CUSTOMER`, `SALES`
- `POST /auth/password/login` role whitelist: `BOSS`, `MANAGER`, `ADMIN`, `CS`
- `SALES` does not use password login (miniapp only)

## Scope Rules
- SELF（本人）: only the authenticated user's own resources (e.g., my orders)
- OWNED（我负责/被分配）: resources owned/assigned to the user (e.g., customers bound to a sales)
- ALL（全量）: all resources

## Permission Codes (examples)
Catalog / Shopping:
- catalog:read
- wishlist:manage
- cart:manage
- order:create
- order:read
- tracking:read

Requests / After-sales / Negotiation:
- product_request:create
- product_request:read
- product_request:export
- after_sales:create
- after_sales:read
- after_sales:manage
- inquiry:create
- inquiry:read
- inquiry:manage

Admin / Ops:
- customer:transfer
- customer:tag
- customer:read
- product:manage
- import:product
- import:shipment
- shipment:manage
- import:cart
- config:feature_flags
- payment:manage
- rbac:manage
- staff:read
- staff:status_manage

## Default Role → Permission Mapping (suggested)
### CUSTOMER
- 角色说明：客户自助下单、查询、售后、询价（仅 SELF）
- 工作端：miniapp
- catalog:read (public)
- wishlist:manage (SELF)
- cart:manage (SELF)
- import:cart (SELF)
- order:create (SELF)
- order:read (SELF)
- tracking:read (SELF)
- product_request:create (SELF)
- product_request:read (SELF)
- after_sales:create (SELF)
- after_sales:read (SELF)
- inquiry:create (SELF)
- inquiry:read (SELF)

### SALES
- 角色说明：业务员，负责自己名下客户跟进（OWNED）
- 工作端：miniapp
- catalog:read (ALL)
- order:read (OWNED)
- tracking:read (OWNED)
- inquiry:manage (OWNED)
- product_request:read (OWNED)
- after_sales:manage (OWNED)
- customer:read (OWNED)

### CS
- 角色说明：客服（含原采购职责），处理售后、询单、发运与物流（ALL）
- 工作端：admin-web
- after_sales:manage (ALL)
- inquiry:manage (ALL)
- order:read (ALL, read-only)
- tracking:read (ALL)
- product_request:read (ALL)
- import:shipment (ALL)
- shipment:manage (ALL)

### ADMIN
- 角色说明：管理员/超管（技术管理员）
- 工作端：admin-web
- ALL permissions with ALL scope

### BOSS
- 角色说明：全业务全权限（ALL）
- 工作端：admin-web
- ALL permissions with ALL scope

### MANAGER
- 角色说明：运营管理与人员/客户管理（ALL）
- 工作端：admin-web
- catalog:read (ALL)
- order:read (ALL)
- tracking:read (ALL)
- inquiry:manage (ALL)
- product_request:read (ALL)
- after_sales:manage (ALL)
- customer:read (ALL)
- customer:transfer (ALL)
- customer:tag (ALL)
- staff:read (ALL)
- staff:status_manage (ALL)
