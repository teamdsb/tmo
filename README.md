# 采购小程序（需求驱动）项目说明

基于 `docs/需求文档.md` 的工业采购小程序方案，定位为“目录 + 意向下单 + 人工撮合”的 B2B 系统，核心链路围绕意向订单、业务员绑定与售后协作。

## 技术栈概览（按层次）

### 客户端
- 双端小程序：Taro + React
  - 产物：微信小程序、支付宝小程序
  - `packages/platform-adapter/` 统一封装 `wx` / `my` 差异（登录、支付、文件、订阅消息等）

### 管理端
- 后台管理台：React + TypeScript
  - 用于：商品管理、Excel 导入导出、客户归属转移、售后处理、订单追踪/运单回填、配置开关等

### 服务端（微服务，克制拆分）
- 语言/框架：Go + Gin
- 服务边界（阶段 0）：
  - `gateway-bff`：统一入口、鉴权、限流、聚合接口
  - `identity`：登录、RBAC、审计
  - `commerce`：商品/价格/购物车/订单/售后（含 CRM/履约/作业的初期承载）
  - `payment`：微信/支付宝、回调验签、幂等、支付开关
- 计划拆分：`crm`（客户归属）、`fulfillment`（运单/追踪）、`job`（Excel/批处理）

### 数据与基础设施
- 主数据库：PostgreSQL
- 缓存/队列/锁：Redis
- 反向代理/网关层：Nginx
- 文件/图片存储：对象存储（S3/OSS/COS/MinIO）+ 可选 CDN

## 需求要点（摘要）
- 核心成交链路为“意向订单”，支付模块完整接入但默认关闭。
- 业务员二维码绑定客户，议价入口强调人工跟进。
- Excel 是高频效率工具（商品导入、需求导出、运单回传、批量加购）。
- 售后为必配能力，支持人工客服，AI 回复接口预留。
- 订单追踪以运单号回传为核心，支持批量回传。

## 仓库结构
```
apps/
  appvx/        # 微信小程序（Taro + React）
  appali/       # 支付宝小程序（Taro + React）
  admin-web/    # 管理端（预留）
services/       # 后端服务（预留）
packages/       # 共享封装（如 platform-adapter）
contracts/      # 服务契约与事件（预留）
infra/          # 基础设施配置（预留）
tools/          # 工具脚本与模板（预留）
docs/
  需求文档.md
  rbac.md
  openapi.yaml
.github/workflows/  # CI（预留）
```

## 重要文档
- 需求与边界：`docs/需求文档.md`
- 权限与角色：`docs/rbac.md`
- 接口契约：`docs/openapi.yaml`

## 说明
当前仓库以需求与契约为先，功能实现按上述服务边界逐步落地。若要开始开发，请先确认需求文档中的“待确认/开放问题”。
