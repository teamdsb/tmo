# 修复功能审查发现并建立可信回归门禁

本 ExecPlan 遵循 `docs/execplans/PLANS.md`。实施期间持续更新 Progress、Surprises & Discoveries、Decision Log、Outcomes & Retrospective。前一份已完成的 B2B 整合计划归档为 `docs/execplans/2026-09-22-b2b-integration-completed.md`。

## Purpose / Big Picture

客户应能可靠地从 Excel 导入购物车、完成有效商品的下单，并在商品编辑后看到购买当时的规格。经理能只读浏览商品，客服能从通知进入会话，销售能翻阅全部客户和订单，订单支付链接能定位流水。微信 B2B 付款后的状态应由服务端主动查证并重试同步，客户端退出不再阻断收敛。后台样式随构建产物发布，自动化测试按真实契约和角色保护上述行为。

本轮修复已报告的缺陷及其必要关联问题，不新增缺乏业务定义的佣金、系统密码/IP策略或支付宝商户支付产品。尚未接入页面明确标注未开放，移除静态页面中看似可用的空操作。任何提交和推送均在全部必需验证完成以后进行，遵从用户的明确要求；不合并 main、不部署生产、不发起真实付款。

## Progress

- [x] (2026-10-04) 完成只读审查，复现下架下单、历史规格变化、导入任务丢失及角色入口问题。
- [x] (2026-10-04) 复用隔离工作区 `/Users/asimov3059/.codex/worktrees/6d97/tmo`，从 `69b2dc5` 创建 `codex/fix-functional-audit`；确认 origin/main 同一版本且 GitHub 认证可用。
- [x] (2026-10-04) 制定里程碑、数据迁移和提交前验收门禁。
- [x] (2026-10-04) M1：交易校验与订单快照完成；Commerce 176 顶层/331 含子测试通过，仅两项原始母表跳过；生成物二次一致，独立复核无阻断。
- [x] (2026-10-04) M2：独立确认页、空草稿按钮移除、事务/幂等完成；后端全 Commerce 与 6 条专项通过，前端全量 342 条及后续定向 46 条通过，lint 通过；复核提出的生命周期/旧请求覆盖与写入后回滚已补验证。
- [x] (2026-10-04) M3：角色、深链、销售分页及未开放页面完成；miniapp 50 suites/355 tests、Admin 18 条定向（含真实四角色）和类型/构建通过；Commerce/Identity 全量通过，补同时间客户稳定排序。独立复核无剩余重要问题。
- [x] (2026-10-04) M4：补偿、接收端排序及可取消查单完成；Payment 75 顶层/149 含子测试、Commerce 关键 23/48、Payment race 20/22、Commerce race 4/8 全通过；37 个生成文件重复一致，独立复核关闭重要问题。
- [x] (2026-10-04) M5：小程序保留50 suites/351行为与兼容测试；后台17页主题、字体和许可本地化完成。最终CI通过15配置、54 Mock、31 Hybrid、1子路径，资源视觉4项通过，独立复核无剩余重要问题。
- [x] (2026-10-04) M6验证：后端373顶层通过（2母表skip），Commerce/Payment完整race通过；miniapp351测试、lint、微信/支付宝28页构建通过；共享类型/OpenAPI/重复生成一致。后台最终离线86条、真实11条无失败无跳过；客户端API也读到客服回复。复核与diff检查通过，所有临时服务已停止。
- [ ] 发布：将已验证代码提交并推送到 `origin/codex/fix-functional-audit`，核对远端提交。

## Surprises & Discoveries

审查基线小程序 45 suites / 318 tests、Admin mock 去重 47 条、Go 顶层 340 条通过。Go 两项真实 Excel 母表验收因文件未提供跳过。Admin Hybrid 执行 25 条，21 条通过，4 条旧 fixture/断言失败；两个 gated workbench 场景未运行。真实 P0 两条和真实导入/导出两条通过。测试通过不能证明被遗漏的业务边界正常。

新订单数组参数的生成客户端即使 explode=false 仍生成重复参数；通过真实编码回归发现400后，契约统一为重复参数并兼容CSV。API客户端沿用Payment已有生成空白归一化脚本。

Admin 在线 Tailwind 单次下载曾用时 38 秒，导致诊断超时；恢复原 timeout 后导航用例通过。系统 pnpm 11 的自动版本切换在受限网络中失败，已缓存 pnpm 10.30.3 可正常使用。PostgreSQL 和浏览器本地监听需要沙盒外执行权限。

导入确认还存在关联的数据风险：逐行 UpsertCartItem 会叠加数量，重试和中途失败未在同一事务保护。销售状态标签包含多种后端状态，分页时必须由后端接受状态集合，而不能只筛选当前页。独立复核发现 Identity 客户查询仅按 created_at 排序，51 个同时间客户的真实回归已复现不稳定顺序；同时补 ID 次序，避免翻页重复/遗漏。

## Decision Log

- Decision: 复用现有干净 worktree，在所有必需测试通过前不 commit、不 push。
  Rationale: 用户明确要求按计划修复且测试好以后才能提交 GitHub。
  Date/Author: 2026-10-04 / Codex。
- Decision: 导入使用独立非 Tab 确认页，移除空的“保存草稿”，不新增本地持久化选择草稿。
  Rationale: 原生 switchTab 不承载查询参数；独立路由可以可靠保留 jobId，避免引入跨账号草稿与生命周期复杂性。
  Date/Author: 2026-10-04 / Codex。
- Decision: 订单新记录保存 SKU JSON 快照，已有记录在迁移时用当时可用的目录数据回填。
  Rationale: 保留现有 OrderItem.sku 响应形状；旧订单曾被改写的信息无法凭空恢复，文档必须说明回填只代表迁移时可获取内容。
  Date/Author: 2026-10-04 / Codex。
- Decision: 支付补偿使用 PostgreSQL 持久化调度和有期限的任务占用，不增加消息队列。
  Rationale: 重启、多实例和短暂网络故障不能丢失查单/同步任务；已支付状态不倒退。
  Date/Author: 2026-10-04 / Codex。
- Decision: 保留各 Admin HTML 的 Tailwind 3 主题差异，逐页本地构建；不以删掉 CDN 而缺失样式作为修复。
  Rationale: 17 个页面的颜色、字体及 darkMode 配置不同，需要保持用户可见效果并测试资源离线可用。
  Date/Author: 2026-10-04 / Codex。

## Outcomes & Retrospective

M1–M6代码与验收已完成。新增回归实际捕获并防护下架/并发下架、快照漂移、导入重试与半写、迟到请求、数组参数编码、客户分页不稳定及支付乱序。最终后端373个顶层通过，Commerce/Payment完整race通过；两项原始母表测试因未提供外部文件保留显式skip。小程序351条、lint、双平台28页构建通过。后台15配置检查、54 Mock、31 Hybrid、1子路径与11真实用例通过，真实客服消息由API模拟客户准备且客户也读到回信，不将此称为微信原生实机验收。字体/主题保留，四页迁移前后截图差异最高0.138%，CI只保护实际字体加载和布局可用性，不使用跨系统美术golden。

源规范和生成物重复生成一致，后端验证后的346个源文件哈希未变化。独立复核发现的问题均已关闭。真实商户扣款、微信/支付宝原生授权和生产部署未执行；旧订单只能回填迁移时可取得的数据。代码发布步骤正在执行，完成后补记远端核对结果。

## Context and Orientation

小程序位于 `apps/miniapp`，React 页面通过 packages 服务和 API 客户端访问 Go 后端。Admin 是 `apps/admin-web` 下的 Vite 多页面 React 应用，真实和模拟模式分别走 API 和本地模拟数据。Commerce 的 SQL 源在 `services/commerce/queries`、增量迁移在 migrations，生成物在 internal/db；Payment 同样使用 sqlc。OpenAPI 的服务源和聚合文件位于 `contracts/openapi`。商品规格规则复用 `packages/go-shared/catalogspec`，保持无维度历史商品的兼容性。

所有测试数据库必须使用本次独立 PostgreSQL 端口 55439 与 `tmo_audit_*` 数据库。不能连接或重置默认 5432 的未知库。单个服务多包测试使用 `GOFLAGS=-p=1` 避免共享表重置冲突。真实 Admin 测试另用 `tmo_audit_e2e_*` 库和 58080–58083 端口。

## Plan of Work

### M1：有效交易和历史订单

先在 `services/commerce/internal/http/handler/orders_integration_test.go` 或独立订单回归测试文件增加拒绝 DRAFT/INACTIVE 商品、拒绝不完整规格、失败不消耗购物车，以及编辑 SKU 后订单详情/列表不变的行为测试。先运行观察失败。

在 `services/commerce/queries/catalog.sql` 和 catalog_skus.sql 增加带锁、按稳定 ID 排序的查询。`orders.go` 在订单事务内重新读取并锁定购买商品及 SKU，使用 catalogspec 校验规格，读取价格，再创建订单、商品项和扣减购物车。商品锁顺序与现有商品编辑锁顺序保持一致，避免并发编辑产生校验后被修改的窗口。

新增 `00028_order_item_snapshots.sql`，添加 `order_items.sku_snapshot` JSONB 并回填现有条目；`queries/orders.sql` 的 CreateOrderItem 写入快照，通过 `tools/scripts/commerce-generate.sh` 生成。`mapOrderItems` 优先读取快照，所有订单详情、列表、履约及支付同步返回同样稳定的数据。检查客服订单卡片是否另行读取当前 SKU 并统一处理。保持旧响应字段兼容，在服务和聚合 OpenAPI 文档中解释 OrderItem.sku 的历史语义及旧数据回填限制。

验收为上述反例变为通过，现有幂等、归属、并发下单和履约测试不退化；迁移可在空库和含已有订单的库执行。

### M2：导入确认完整链路

在 `apps/miniapp/src/pages/import/confirm/index.tsx` 增加独立确认路由，在 app.config.ts 和 routes.ts 注册。上传页 navigateTo 携带 jobId；复用或拆出购物车的 ImportResultView，确认成功切换回购物车。进入页面验证 jobId、加载任务、展示失败/待处理状态，移除无处理器的草稿按钮。页面返回和刷新不应重复提交。

`services/commerce/internal/http/handler/cart.go` 的 confirm 接口改为单事务，先锁定 import job 并检查所属客户，再读取导入行。相同已确认选择重试不叠加数量，冲突选择拒绝，非法后续行不能留下前面行的写入；更新行选择、购物车和任务计数一起提交。SQL 锁查询从源生成。

验收覆盖上传调用返回真实 jobId、非 Tab 跳转、确认页面展示、确认成功回购物车，以及数据库中的顺序重试、并发重试、错误回滚。没有业务数据写入本地共享账号状态。

### M3：角色、分页、链接与未开放入口

Admin 的 ProductsPage 根据维护权限选择管理员列表或经理只读 catalog 列表，经理不展示维护、复核、批量修改等写控件。`permissions.js` 统一 support/inquiries 访问条件；通知保持 conversationId。PaymentsPage 从 URL 的 q 初始化查询，OrdersPage 使用 buildAppHref 生成子路径兼容链接。真实 CS 和 MANAGER 都必须从实际入口完成只读操作，管理权限不得扩大。

小程序销售页面增加客户与订单加载更多及总数/无更多状态，搜索或状态切换重置分页，取消/忽略过期响应。为 GET /orders 增加可选 statuses 集合（标准重复参数，并兼容 CSV），保留单 status 兼容，互斥校验；列表和 count 使用同一过滤条件，更新 commerce.yaml、聚合规范和生成客户端。使用真实 UI 状态组对应的多个订单状态，不能对已截断的当前页自行筛选。

独立 QuoteWorkflowPage 改为明确未接入的状态页面，移除静态报价和无效审批/发送按钮；销售财务、系统设置及支付宝预留状态保持准确。验收覆盖跨页选择/搜索、21 个客户和 51 个订单、乱序响应、不同角色，以及带 q 和子路径的支付入口。

### M4：B2B 服务端收敛

Payment 增量迁移和 SQL 增加持久化下一次处理时间、尝试次数、任务租约、支付状态版本及已同步 Commerce 版本。创建支付和状态改变必须原子标记待处理。查询任务使用 FOR UPDATE SKIP LOCKED 与到期租约，使同一任务同一时间只归一个 worker，崩溃后可以重新领取。

从 HTTP handler 抽取接收 context.Context 的查单/应用状态/同步核心，HTTP 和后台 worker 共用。B2B 待处理订单通过已存在且严格核对金额、商户和订单标识的 QueryPayment 得到权威结果；不得信任客户端 success。已 PAID 只补同步，不回退。同步成功仅确认本次发送版本，较新的状态继续待同步。错误使用有上限的退避间隔重复执行，不能因重启或一次失败永久丢弃任务。内部同步必须携带来源版本和支付尝试顺序，Commerce在订单事务持久化高水位并拒绝乱序旧状态，同时保留PAID优先，兼容历史无版本数据；否则只有发送端版本确认仍可能永久失配。provider token并发等待也必须响应取消。启动配置和部署文档说明开关、间隔、超时及日志。

验收使用模拟微信权威接口和真实 PostgreSQL，证明客户端不再请求也能变 PAID、查单失败后成功、Commerce 失败后恢复、进程重启租约过期恢复、多 worker 不重复抢同一任务、旧版本同步不能覆盖新状态，及已支付不倒退。不得调用真实商户创建支付。

### M5：测试维护与构建资源

修复 `orders.hybrid.spec.ts` 的 OFFLINE fixture，以及 `products.hybrid.spec.ts` 的服务端排序、分页/搜索 fixture 和零 UUID 导出断言。权限模拟以真实角色授予为基准，并用角色行为测试约束一致性。将纯 stub Hybrid 与需要真实服务的 import/workbench 测试分开，默认 CI 执行完整离线组，真实组在隔离服务下显式运行。

小程序 CSS 测试保留跨平台安全规则和确切交互要求，移除锁死无业务含义的 padding/font-size 字符串；用现有行为测试、可见性和布局约束替代。不得删除失败断言以获得绿色结果。

Admin 用已有兼容的 Tailwind 3/PostCSS 工具链生成本地 CSS，迁移每个 HTML 的主题、内联 tailwind @layer 和动态 class 支持；字体使用许可明确的本地资产或本地打包依赖，Material Symbols 图标必须保留。所有页面删除运行时 Tailwind/Google 字体请求。验证离线资源加载、代表性页面布局和浏览器交互后再收尾。

### M6：验证、复核和发布分支

依次运行全 Go 模块测试（明确设置三个独立 DB DSN）、miniapp 全量 Jest/lint/WXSS 与微信/支付宝构建、packages 类型检查、OpenAPI 自测/同步、Admin 类型/构建/全 Mock/全 stub Hybrid/真实 P0和导入工作台。对外部原始母表未提供的两项验收明确记录跳过；新功能所需的自动化不可静默跳过。

生成脚本运行后再次运行确认无漂移，`git diff --check` 无输出。独立 reviewer 按当前未提交差异检查高风险数据迁移、事务、支付补偿和 UI 权限；修复所有重要问题后对受影响测试复核。只有上述必需检查通过，才 `git add` 精确文件、commit 并 `git push -u origin codex/fix-functional-audit`。核对远端 SHA 等于本地 HEAD，最终提供分支链接、测试结果及未做真实付款/生产发布的边界。

## Concrete Steps

所有命令在仓库根目录运行，除特别注明。使用缓存 pnpm 10.30.3；必要时 PATH 临时指向 `/tmp/tmo-audit-miniapp-bin`，不修改系统工具设置。

    git status --short
    COMMERCE_DB_DSN=postgres://tmo@127.0.0.1:55439/tmo_audit_commerce?sslmode=disable GOFLAGS=-p=1 go test ./services/commerce/internal/http/handler/... -count=1
    bash tools/scripts/commerce-generate.sh
    bash tools/scripts/payment-generate.sh
    pnpm run test:backend
    pnpm -C apps/miniapp test
    pnpm -C apps/miniapp lint
    pnpm -C apps/miniapp test:wxss
    pnpm -C apps/miniapp build:weapp
    pnpm -C apps/miniapp build:alipay
    pnpm run typecheck:packages
    pnpm run test:openapi
    pnpm run check:openapi
    pnpm run check:mock-sync
    pnpm -C apps/admin-web typecheck
    pnpm -C apps/admin-web build
    pnpm -C apps/admin-web test:e2e:mock
    pnpm -C apps/admin-web test:e2e:hybrid
    TMO_ADMIN_REAL_ISOLATED=1 ADMIN_WEB_PROXY_TARGET=http://127.0.0.1:58080 ADMIN_WEB_PAYMENT_PROXY_TARGET=http://127.0.0.1:58083 SUPPORT_REAL_E2E_ARTIFACT=/tmp/tmo-final-support-artifact.json SUPPORT_REAL_E2E_REPLY_TEXT='本地回归客服回复 final-config-2' pnpm -C apps/admin-web test:e2e:real
    git diff --check

数据库地址只针对本次隔离实例，Go test 可通过 GOCACHE=/tmp/tmo-go-build-cache 避免缓存写入受限。最终真实测试使用单独 E2E 数据库，不能与重置表的集成测试共享。

## Validation and Acceptance

每个修复至少由用户可见行为或数据不变量证明：不能下单无效商品，历史规格稳定，导入跳转可达且重试只加一次，经理和客服入口可用且不能越权写入，分页能显示后续数据，支付不依赖客户端存活且失败可恢复，所有页面资源本地可用。现有四个陈旧 Hybrid 必须修到通过，不能作为既有失败豁免。测试失败先定位根因，不降低业务约束。

## Idempotence and Recovery

增量迁移保留既有列/响应兼容，旧订单快照回填只运行于新迁移；不伪称恢复丢失历史信息。支付任务用持久化时间/租约恢复，导入 job 锁提供并发幂等。所有测试服务、媒体和证据输出保持独立；完成后停止本轮启动的 PostgreSQL、Go、Vite 和浏览器进程。提交前不执行任何会覆盖既有工作区的 git reset/clean。

## Artifacts and Notes

基线审查日志位于 `/tmp/tmo-audit-*`；M1 失败证据为 `/tmp/tmo-fix-commerce-before.log`。新验证日志使用 `/tmp/tmo-fix-*`，重要结果归入本计划。最终证据包括 `/tmp/tmo-final-backend.jsonl`、`/tmp/tmo-final-commerce-payment-race.log`、`/tmp/tmo-final-miniapp-{jest,lint,weapp,alipay}.log`、`/tmp/tmo-final-openapi-sync.log`；后端346个源文件的哈希保存在 `/tmp/tmo-final-backend-source-sha.json`，防止验证后发生未测试变更。后台最终证据为 `/tmp/tmo-final-admin-ci.log`、`/tmp/tmo-final-admin-real-final.log` 和 `/tmp/tmo-final-support-customer-check.json`。日志不记录真实凭据。远端仓库为 `https://github.com/teamdsb/tmo.git`，本轮仅推送修复分支。

## Interfaces and Dependencies

生成 SQL/Go/TypeScript 文件只从 migrations、queries 和 OpenAPI 源重新生成。商品规格规则复用 catalogspec；订单状态集合沿用现有枚举。数据库事务和 worker 都以 context.Context 传递取消与超时。Admin 保持 React 18/Vite 4/Tailwind 3，与现有锁文件兼容。

变更记录：2026-10-04，建立功能审查修复计划，记录用户的先验证后提交约束和六个依次执行的里程碑。

2026-10-04 收尾记录：所有功能修复、测试维护和本地资源迁移完成；记录最终验证口径、两项外部母表限制、已停止测试服务及待执行的Git发布。
