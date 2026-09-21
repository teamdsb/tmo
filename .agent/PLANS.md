# 商品三级规格与可回导 Excel

本 ExecPlan 遵循 docs/execplans/plans.md，随实现维护。

## Purpose / Big Picture

管理员可以逐行维护一至三级实际 SKU 组合并修改层级名称；客户按名称逐级选择后购买。商品目录导出与导入使用相同 Excel 模板，重复回导保持商品、SKU 身份、状态、图片与价格。

## Progress

- [x] 2026-09-20：完成代码勘察与用户确认，建立隔离 worktree，复制并保留原有导入说明及测试改动。
- [x] 实现共享规则、后端校验与商品/SKU 原子保存。
- [x] 实现 admin 三级编辑与小程序详情/购物车逐级选择。
- [x] 实现 Excel 导入、异步商品导出及 mock 往返。
- [x] 更新契约、生成代码、规范和操作说明。
- [x] 执行验证并安全回填原工作区：68 个实现/测试/文档文件复制后逐字节核对；保留用户已有修改。

## Surprises & Discoveries

现有商品已有 filter_dimensions 与 SKU attributes 字段；admin 丢弃这些信息并将型号名写入 spec。现有保存逐条写入 SKU，没有事务。商品导出尚未实现，只有采购需求导出。原工作区 ImportPage.tsx 及测试有未提交改动。已启动独立 PostgreSQL 16 测试容器 tmo-spec-test-db（127.0.0.1:55439），分别用 commerce 与 exceltest 隔离测试。现有迁移 00024 每次 ApplyMigrations 重放时重复添加约束；改为先删除同名约束且仅回填 NULL 支付方式。旧线下付款测试错误使用线上订单 fixture，已显式标记 OFFLINE，不改变业务支付规则。

## Decision Log

2026-09-20：用户确认逐级选择、逐行维护实际组合、显式六列规格名称和值，并新增可回导商品导出。复用现有字段避免双份规格来源；修改层级时原子保存整个 SKU 集合，移除 SKU 仅停用以保留历史引用。spec 由有序规格值以“ / ”拼接，单级值不变。共享 TypeScript 与 Go 包分别封装各自运行时的规则。隔离分支为 codex/product-spec-levels；不覆盖用户原有工作。

## Outcomes & Retrospective

全部实现、代码审查、浏览器回归与原工作区集成已完成。当前工作区再次通过 Commerce/共享包/网关的真实数据库测试、小程序 315 项测试、admin 类型检查与生产构建。Admin 共 20 个相关 mock 场景和 14 个 hybrid 场景通过，覆盖导入后编辑重载持久化。Commerce 全包真实 PostgreSQL 测试通过；catalog 三个事务与并发测试的 go test -race 通过；go-shared 与 gateway-bff 全包测试通过。Miniapp 45 suites / 315 tests、类型检查、改动文件 ESLint/Stylelint、微信与支付宝 mock 构建通过。11 个 TypeScript 包通过 tsc（隔离环境根 tsc 命令不可见，使用 admin 的同版本 TypeScript 可执行文件逐包验证）。OpenAPI 与 mock 同步检查通过；相关模块 go vet 通过。Commerce 和 go-shared 的改动通过 golangci-lint（本机 v2.12.2，仓库 v1 配置复制到 /tmp/tmo-product-spec-golangci.yml 转换后检查；未修改仓库配置），均为 0 issues。

代码审查发现并修复无价格 SKU 意外补零价、清空编码未发送 null、层级名称覆盖扩展属性、旧规格重复组合、ID/编码别名重复导入、mock JSON 数组/停用历史记录往返、连续部分导入保留与筛选条件不一致。实际 Commerce router 的商品导出注册由新增路由回归覆盖。

## Context and Orientation

apps/admin-web/src/react/pages/admin/ProductsPage.tsx 是商品编辑入口，products-data.ts 将服务端数据转成编辑模型。apps/miniapp/src/pages/goods/detail 与 pages/cart 负责购买和换规格。services/commerce/internal/http/handler/catalog.go 负责商品 API；数据库查询来自 queries/*.sql，生成代码位于 internal/db。internal/modules/productimport 是按商品组事务处理 Excel 的 worker；productrequestexport 提供可复用的异步导出任务结构。contracts/openapi/commerce.yaml 和 admin.yaml 是服务规范，openapi.yaml 是聚合入口。

## Plan of Work

第一里程碑在 packages/go-shared/catalogspec 与 packages/shared 建立规范化、完整路径、组合唯一性和选项计算。商品 PATCH 扩展可选 skus 完整集合，包含现有 ID 或新 SKU；在事务内锁商品、验证归属和组合、更新商品与 SKU/阶梯价、停用移除项。单 SKU 接口使用相同校验，普通 PATCH 不提供集合时保留数据。

第二里程碑修改 admin 编辑模型与 UI，新增/删除末级、重命名、每行规格值、启用状态及保留价格。小程序共享级联选择器，切换上级清空后续值，只允许有效 SKU 加购，单个有效 SKU 自动选中。旧无维度数据按“规格”读取；不截断超过三级异常数据。

第三里程碑在现有模板增加 Spec 1 Name/Value 至 Spec 3 Name/Value、Product ID、SKU ID、Product Status。显式列与旧字段冲突时报错；优先 ID，再 SKU Code 定位，不能跨商品移入 SKU。导入保留省略 SKU，并验证最终组合，商品组失败整体回滚。导出 PRODUCT_EXPORT 使用商品管理权限，支持 q/categoryId/status 筛选、所有分页/停用 SKU/无 SKU 商品。空 SKU 行不得凭空创建规格；默认新建商品 DRAFT，已有商品未填状态保持原状。

最后同步 OpenAPI、sqlc/oapi-codegen/Orval 生成物、mock、文档，并把验证过的差异回填原工作区。

## Concrete Steps

在仓库根运行 bash tools/scripts/commerce-generate.sh 与 pnpm --filter @tmo/api-client generate（其他客户端按其配置生成）；pnpm check:openapi 验证引用。在 services/commerce 运行 go test ./...，packages/go-shared 运行 go test ./...。在 admin 运行 pnpm typecheck、pnpm build 和相关 Playwright；miniapp 运行 pnpm test、pnpm lint:types、pnpm build:weapp:mock、pnpm build:alipay:mock。所有命令预期退出 0；环境限制与基线失败必须单独记录。

## Validation and Acceptance

维护“材质、长度、直径”三个层级和稀疏 SKU 组合，改名后刷新层级、ID、价格保持；第四级、空名称、重复名称、不完整值和重复有效组合保存失败且数据库不发生部分修改。商品详情与购物车切换上级后必须重新选择下级。导出全部状态商品，再回导两次，商品/SKU 数量和 ID、价格、启用状态不变；无编码与无 SKU 商品也通过。数据库集成必须验证事务失败与权限拒绝，不能用 mock 替代数据库断言。

## Idempotence and Recovery

生成与测试可重复。只添加导出任务迁移；不破坏旧商品数据。先验证独立 worktree，再按文件差异回填，重叠文件先与原始快照比较，保留现有用户修改。不 reset 或清理原工作区。

## Interfaces and Dependencies

PATCH /catalog/products/{spuId} 可选 skus 数组元素含 id、name、skuCode、spec、attributes、unit、isActive、priceTiers，表示完整保留集合。省略集合为普通商品更新；元素省略 priceTiers 时旧 SKU 保留阶梯价。POST /admin/products/export-jobs 接收 q/categoryId/status，返回现有 ImportJob，GET /admin/import-jobs/{jobId} 查询结果。采用现有 pgx、excelize、xlsx、React/Taro 与测试工具，不新增运行时依赖。

## Artifacts and Notes

隔离目录：.worktrees/product-spec-levels。已有用户修改复制到隔离目录作为实施基线。

2026-09-20：按用户批准的方案建立执行记录。

2026-09-20 实施补充：导出使用专用 SQL 的字面子串搜索，使商品名称、ID、分类、SKU 名称/编码与 admin 当前筛选一致。聚合与 admin 契约中的旧 SKU/PriceTier/ProductDetail 重复定义改为指向 Commerce canonical schema，避免旧 unitPrice 定义继续误导调用方。原 .agent/PLANS.md 已归档为 docs/execplans/audit-remediation-previous.md。

2026-09-20 完成记录：独立 worktree 的实现已复制并核验到原工作区，未创建提交。原有 ImportPage、import.mock.spec 和生成 CSS 修改均保留；旧执行记录单独归档。本次独立 Vite 5188/5189 已停止，原开发服务 5174 保持运行；专用测试 PostgreSQL 容器在验证后停止。

## ECS Release — 2026-09-21

用户授权合并 main 并部署。功能提交 7840e72，经解决 main 更新引起的六处冲突后合并为 14ba54e，工作区校验和补齐后发布版本为 f5e3a2b。合并后的真实数据库测试、小程序 315 测试与 admin 生产构建通过。部署检查发现 Nginx 需独立读取导出目录，已补权限回归；Podman Compose 吞掉依赖删除错误，已按依赖顺序修复并核对实际镜像。线上服务、鉴权、空结果导出与文件下载均通过。完整记录见 docs/runbooks/deploy-product-specifications-2026-09-21.md。
