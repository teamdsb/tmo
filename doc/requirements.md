# 需求分析与设计说明（内部研发稿）

## 1. 背景与目标
- 构建一个面向工业原材料客户的小程序 + 后台管理系统，覆盖商品浏览、下单、客户归属、售后与价格策略等核心能力。
- 当前阶段为快速实现与验证阶段（快速测试踩坑用分支），以需求拆解与接口/数据设计为主。

## 2. 技术选型（已定）
- 后端：Go + Gin（小范围 Gin）
- 数据库：PostgreSQL
- 前端：React + TypeScript
- 小程序：Taro（编译至微信/支付宝）

## 3. 角色与权限
- 客户：浏览商品、搜索、收藏、下单、提交找不到的产品、发起售后。
- 业务员：拥有独立二维码、查看归属客户订单与议价留言。
- 管理员：商品/分类管理、需求收集管理、客户归属转移、售后管理、Excel导入导出、支付开关配置。

## 4. 功能模块拆解

### 4.1 商品与下单
1) 商品菜单与搜索  
- 分类展示工业原材料；支持关键词搜索。  
- 商品详情展示规格、价格（含阶梯价）。

2) 购物车与下单链路  
- 加入购物车、填写收货地址、提交意向订单。  
- 订单为“意向订单”，支付默认关闭（后续可切换开启）。

3) 收藏/常用清单  
- 常买品种收藏；下次快速下单。

### 4.2 需求收集与 Excel
4) 找不到商品的需求收集  
- 表单字段：名称、规格、数量、备注、联系人/手机号（如需）。  
- 统一落库，后台可按时间筛选查看。

5) Excel 导入商品  
- 固定模板导入；支持新增与更新。  
- 导入规则：按商品唯一标识（如 SKU/商品编码）更新。

6) Excel 导出需求清单  
- 按时间等条件导出“找不到的产品”列表。

### 4.3 业务员绑定与客户归属
7) 业务员二维码绑定  
- 客户扫码后自动归属业务员；后续订单与议价留言归属该业务员。

8) 客户归属转移  
- 管理员可将客户从 A 业务员转给 B（员工离职/区域调整）。

### 4.4 售后模块与 AI 预留
9) 售后入口  
- 小程序内提交售后问题/反馈。

10) 售后记录管理  
- 后台查看、标记与跟进。

11) 预留 AI 接口  
- 设计对接点，后续可接入“AI + 人工客服”混合回复。

### 4.5 价格体系与挽留客户
12) 阶梯价格  
- 支持数量区间价格（例如 1-5、6-100、100+）。

13) 议价入口  
- 价格附近提供“觉得贵可以聊聊”的入口，留言/联系业务员。

### 4.6 支付功能（已接入但默认关闭）
14) 微信支付接入（后端完成，前端展示）  
- 生成支付订单、支付回调更新订单状态、订单详情显示支付状态/记录。

15) 支付开关  
- 配置层控制是否启用；默认关闭。

16) 支付宝预留  
- 支付通道抽象可扩展。

### 4.7 设计与上线
17) 视觉与体验一致性  
- 页面风格统一、适合对外展示。

18) 上线与使用说明  
- 协助小程序上线配置与后续小问题调整。

## 5. 数据模型（建议草案）
> 以 PostgreSQL 为基准，字段可按实际实现调整。

- users  
  - id, role (customer/sales/admin), name, phone, created_at
- sales_profiles  
  - id, user_id, qr_code_url, region, created_at
- customers  
  - id, user_id, sales_id, source, created_at
- categories  
  - id, name, sort, parent_id
- products  
  - id, sku, name, spec, category_id, status, description
- product_prices  
  - id, product_id, min_qty, max_qty, unit_price
- carts / cart_items  
  - id, customer_id; item: product_id, qty
- orders  
  - id, customer_id, sales_id, status, total_amount, address_id, created_at
- order_items  
  - id, order_id, product_id, qty, unit_price, price_tier_id
- favorites  
  - id, customer_id, product_id
- missing_product_requests  
  - id, customer_id, name, spec, qty, remark, created_at
- after_sales  
  - id, customer_id, order_id, type, content, status, created_at
- negotiation_messages  
  - id, customer_id, sales_id, product_id, message, created_at
- payments  
  - id, order_id, channel, status, trade_no, created_at, paid_at
- system_config  
  - key, value (e.g., payment_enabled)

## 6. 关键流程
1) 客户扫码绑定业务员  
- 扫码参数中包含 sales_id，首次进入即绑定，后续订单归属该 sales_id。

2) 搜索找不到商品  
- 在搜索结果为空时引导“找不到的产品”表单提交。

3) 下单流程  
- 选品 -> 购物车 -> 地址 -> 意向订单 -> （支付开关：关闭默认不触发支付）

4) 议价入口  
- 价格区域按钮 -> 留言 -> 归属业务员查看。

5) 售后流程  
- 提交售后 -> 后台标记跟进 -> 状态更新。

## 7. API 大纲（示例）
> 具体路由按后端实际框架调整。

- Auth / User  
  - POST /api/login  
  - GET /api/me
- Catalog  
  - GET /api/categories  
  - GET /api/products?keyword=&category_id=  
  - GET /api/products/:id
- Cart & Order  
  - POST /api/cart/items  
  - GET /api/cart  
  - POST /api/orders  
  - GET /api/orders/:id
- Favorites  
  - POST /api/favorites  
  - GET /api/favorites
- Missing Product  
  - POST /api/missing-products  
  - GET /api/admin/missing-products (admin)
- Excel  
  - POST /api/admin/products/import  
  - GET /api/admin/missing-products/export
- Sales Binding  
  - POST /api/sales/bind (qr param)  
  - POST /api/admin/customers/transfer
- After Sales  
  - POST /api/after-sales  
  - GET /api/admin/after-sales
- Negotiation  
  - POST /api/negotiations  
  - GET /api/admin/negotiations
- Payment  
  - POST /api/payments/wechat/prepay  
  - POST /api/payments/wechat/notify  
  - GET /api/admin/config/payment

## 8. 后台管理功能清单
- 商品分类/商品/价格阶梯管理
- Excel 导入商品、导出需求清单
- 客户归属转移
- 售后记录管理
- 议价留言查看
- 支付开关配置与支付记录查看

## 9. 非功能性要求
- 数据一致性：订单、支付、售后与客户归属关系准确。
- 可扩展性：支付通道、AI 客服接口可插拔。
- 易用性：小程序端操作路径短、反馈清晰。

## 10. 验收标准（初稿）
- 商品浏览、搜索、详情与阶梯价展示正常。
- 购物车与下单链路可完成意向订单。
- 收藏、缺货需求、售后提交可用；后台可查看。
- 业务员二维码绑定与客户归属转移可用。
- Excel 导入与导出可执行。
- 支付流程代码接入完成，配置关闭后不触发支付。
- 议价入口可留言，后台可查看。

## 11. 里程碑建议（内部节奏）
1) 需求与数据/接口设计（当前）  
2) 商品/下单/收藏基础链路  
3) 需求收集 + Excel 导入导出  
4) 业务员绑定 + 客户转移  
5) 售后与议价入口  
6) 支付接入与开关  
7) 联调与验收

## 12. 风险与待确认
- Excel 模板字段与唯一标识规则需确定。  
- 订单是否需要更多状态（如“已确认”“已发货”）。  
- 售后表单字段范围与分类标准。  
- 议价留言是否需要附件/图片。  
