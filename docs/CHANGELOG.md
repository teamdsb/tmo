# Changelog

这个文件只记录会影响后续 agent 判断的近期仓库变化，不承担发布说明、项目周报或任务流水账职责。

## 2026-09-22

- 生产微信支付统一为 B2B 门店助手协议：ECS payment 已运行 `PAYMENT_PROVIDER_MODE=b2b`，miniapp 使用 `bb-plugin` 和 `wx.requestCommonPayment`。旧体验版请求普通 `/payments/wechat/create` 会被 B2B provider 以 503 拒绝；需重新构建、上传并发布合并后的小程序产物。前后端均强制检查独立 `wechatB2bEnabled` 熔断开关，平台默认支付渠道与生产 B2B provider 保持一致。
  影响面：Payment OpenAPI/provider、payment-services、platform-adapter、miniapp 插件与微信发布流程。
  建议阅读：`docs/context/payment-setup.md`、`.agent/PLANS.md`。

## 2026-09-21

- 完成分支与 worktree 瘦身，四个依赖 PR 经全部适用 CI 检查后通过 PR 180 合入 main；工作区最低 Go 版本为 1.26，缓存不再入库，已开启合并后自动删除分支。历史分支和未提交工作有本机备份，生产 B2B 分支保留。
  建议阅读：`docs/runbooks/repository-cleanup-2026-09-21.md`。

- 商品三级规格与商品 Excel 导入导出已合并 main 并部署 ECS，运行代码版本 `f5e3a2b`。发布改用独立目录和本机构建，保留线上未提交运维修改；旧 Podman Compose 的依赖重建错误必须通过实际镜像 revision 和新增接口校验识别。
  建议阅读：`docs/runbooks/deploy-product-specifications-2026-09-21.md`。

## 2026-09-20

- 商品支持独立命名的 1～3 级规格，admin 逐行维护实际组合，小程序详情与购物车逐级选择。完整商品 PATCH 可原子保存 SKU 集合，移除 SKU 仅停用；多级 `spec` 改为属性路径摘要。
  影响面：catalog 契约、共享规格规则、admin 与 miniapp、商品 Excel 导入和新增 PRODUCT_EXPORT 异步导出。导出携带稳定 ID 和商品状态，可重复回导；旧紧凑模板继续读取。
  建议阅读：`docs/context/commerce-conventions.md`、`docs/runbooks/product-specifications-excel.md`。

- B2B 支付重查改为调用微信 `getorder` 服务端查单；仅在微信返回 `ORDER_PAY_SUCC` 且商户、订单关联、金额、币种和环境逐项一致时，才会同步本地支付和 Commerce 订单为 `PAID`。小程序客户端回调仍不是可信资金凭据。
  影响面：Payment B2B provider 与 `/payments/{paymentId}/recheck`。
  建议阅读：`docs/context/payment-setup.md`、`.agent/PLANS.md`

## 2026-09-19

- 恢复微信 B2B 门店助手支付作为当前生产通道：小程序通过 `wx.requestCommonPayment`，payment 服务使用服务器端 AppSecret/AppKey 生成签名参数，显式 provider mode 为 `b2b`。普通 APIv3/JSAPI provider 继续保留但不与 B2B 同时启用；客户端 success 不直接写入 `PAID`。
  影响面：Payment OpenAPI、后端 provider/config、platform adapter、payment-services、小程序插件声明、ECS 预检与支付部署文档。
  建议阅读：`docs/context/payment-setup.md`、`.agent/PLANS.md`

## 2026-09-14

- 订单新增提交后锁定的 `ONLINE` / `OFFLINE` 付款方式；线下订单等待 admin 确认到账，线上未支付订单不得改记为线下收款。
  影响面：commerce 订单契约与数据表、payment 会话校验、miniapp 订单确认/列表/详情、admin 支付列与派单面板。
  建议阅读：`docs/context/product-requirements.md`、`docs/context/payment-setup.md`、`contracts/openapi/commerce.yaml`

- miniapp 底部导航统一为平台原生 TabBar；业务页面不再维护固定 TabBar 高度或直接使用底部 safe-area 表达式。独立页面固定栏、输入区和底部弹层统一通过 `components/app-safe-area` 获取运行时设备 inset，并由 FixedView placeholder 负责固定栏占位。
  影响面：首页、分类、购物车、我的、商品详情、订单确认/详情、业务员工作台、客服和地址弹层的底部布局。
  建议阅读：`docs/context/product-requirements.md`、`docs/execplans/miniapp-native-tabbar-safe-area.md`、`apps/miniapp/README.md`

## 2026-08-17

- miniapp 移除登录后的独立角色选择页；多角色账号默认以 CUSTOMER 进入商城，纯 SALES 账号直接以 SALES 进入，业务员工作台仍从“我的”进入。
  影响面：前端不再持久化 pending role selection，业务员工作台的顶部与底部统一使用设备安全区布局。
  建议阅读：`docs/context/product-requirements.md`

- 在线客服收紧为“显式认领后才能已读或发送”，不再由首次回复隐式认领；只有当前坐席可清除客服侧未读和回复。
  影响面：admin-web 操作状态与 Commerce 权限保持一致，自动化或旧调用方必须先调用 claim 接口。
  建议阅读：`docs/runbooks/online-support-v1.md`、`contracts/openapi/commerce.yaml`

- admin-web 商品卡片改为可搜索、分页的上架商品选择器；Commerce 用真实目录重建商品快照，miniapp 以内部 `route` 打开详情并兼容可安全转换的旧 `linkUrl`。
  影响面：`PRODUCT_CARD` 必须带有效且已上架的 UUID `productId`，伪造、下架或不存在商品不再创建消息。
  建议阅读：`docs/context/product-requirements.md`、`docs/runbooks/online-support-v1.md`

## 2026-07-09

- 用户运营中心新增 BOSS 专属后台密码账号管理，可创建、编辑、重置密码和停启单角色 `ADMIN`、`MANAGER`、`CS` 账号。
  影响面：Identity JWT 新增凭证版本并在每次鉴权时核验；停用或重置密码会立即撤销旧会话，BOSS 账号不在受管列表中。
  建议阅读：`docs/context/rbac.md`、`contracts/openapi/identity.yaml`

## 2026-07-06

- Admin 订单履约新增受控线下收款与派单：`order:manage / ALL` 仅授予 BOSS、MANAGER、ADMIN；Commerce 仍强制检查角色，并向 Identity 复核负责人是 active SALES。
  影响面：订单负责人、付款摘要和审计事件在一个事务中更新；发货及终态订单不可改派。
  建议阅读：`docs/context/rbac.md`、`docs/context/product-requirements.md`、`contracts/openapi/commerce.yaml`

## 2026-03-08

- 重组 `docs/` 为 `context/`、`runbooks/`、`decisions/`、`execplans/` 四层结构，并新增 `docs/README.md` 作为总入口。
  影响面：后续新增文档必须先归类；旧的 `docs/` 根目录散文件路径已失效。
  建议阅读：`docs/README.md`、`docs/decisions/README.md`

- 统一 `docs/` 文档文件名为 ASCII `kebab-case`，并将 `docs/RUNBOOK/` 更名为 `docs/runbooks/`。
  影响面：引用旧文件名或旧目录名的脚本、README、ExecPlan 需要使用新路径。
  建议阅读：`docs/README.md`

## 2026-03-10

- commerce 新增在线客服 v1：小程序独立客服页、`/support/*` 与 `/admin/support/*` REST 接口、图片消息上传、会话认领/转接、上下文聚合与 WebSocket 推送。
  影响面：涉及 `services/commerce` 新迁移与接口契约；前后端需按新的 `SupportConversation` / `SupportMessage` 结构接线。
  建议阅读：`docs/runbooks/online-support-v1.md`、`contracts/openapi/commerce.yaml`

- 在线客服角色边界明确为“客户 <-> CS”，`SALES` 保持 miniapp-only，不进入 admin-web 客服沟通链路。
  影响面：admin-web 登录角色、客服工作台转接目标、客服接口访问控制均不应再放宽到 `SALES`。
  建议阅读：`docs/context/rbac.md`
