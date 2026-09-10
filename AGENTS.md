# 仓库指南

## 项目介绍

TMO 是面向工业原材料采购客户的采购与业务协作系统，同时服务销售人员、采销人员、客服和后台管理人员。客户通过小程序浏览商品与阶梯价、提交采购订单或找货需求、跟踪物流并联系售后；业务团队通过小程序和管理后台跟进客户、管理商品与订单、处理收款和发货。系统支持 Excel 批量导入导出，微信在线支付由配置开关控制，支付宝支付预留扩展。

## 项目简洁导览

- `apps/miniapp/`：客户与销售小程序，使用 Taro + React + TypeScript，支持微信、支付宝构建。
- `apps/admin-web/`：后台管理控制台，管理商品、客户、订单、客服与财务等业务。
- `services/`：Go 后端；`commerce` 承载交易与履约，`identity` 负责身份与权限，`payment` 负责支付，`gateway-bff` 提供网关与聚合接口，`ai` 为 AI 服务。
- `packages/`：共享基础设施、业务服务、API 客户端与跨平台适配包。
- `contracts/`：OpenAPI 接口规范与事件 Schema。
- `infra/`：本地开发及生产部署配置；`tools/`：开发、测试、迁移与代码生成脚本。
- `docs/`：产品背景、联调排障、决策与执行计划，入口为 `docs/README.md`。

## 常用命令

除特别注明外，在仓库根目录执行；工具版本以仓库配置为准。

| 用途 | 命令 |
| --- | --- |
| 安装前端依赖 | `pnpm install` |
| 启动本地数据库 | `make db-up` |
| 启动本地后端栈 | `make dev-stack-up` |
| 启动后端热更新 | `make dev-stack-up-air` |
| 微信 / 支付宝小程序开发 | `pnpm -C apps/miniapp dev:weapp` / `pnpm -C apps/miniapp dev:alipay` |
| 微信 / 支付宝小程序构建 | `pnpm -C apps/miniapp build:weapp` / `pnpm -C apps/miniapp build:alipay` |
| 管理后台开发（模拟 / 真实接口） | `pnpm run dev:admin-web:mock` / `pnpm run dev:admin-web:real` |
| 管理后台构建 | `pnpm run build:admin-web` |
| 后端测试 | `pnpm run test:backend` |
| 单个 Go 模块测试 | 在对应模块目录执行 `go test ./...` |
| 小程序测试 | `pnpm -C apps/miniapp test` |
| 小程序静态检查 | `pnpm run lint` |
| OpenAPI 同步检查 | `pnpm run check:openapi` |

数据库集成测试需启动 PostgreSQL 并设置对应服务的 DB DSN 环境变量；具体要求见各服务测试与文档。

## 解释代码

Use plain language over jargon, and reference technical details only to the degree that it helps illustrate an idea or your work to the user. Communicate complex concepts in a clear and cohesive manner, and calibrate your writing to the level of background knowledge assumed from the user's prompt and context.

## 测试

Do not write tests for reversible, low-impact changes that mirror the implementation. If you do choose to verify your work with tests, make sure that the tests are meaningful and necessary to verify implementation.

Run tests appropriate to the change and complete required checks. Once those pass, broaden or repeat testing only when new changes, failures, or unresolved concerns justify it; otherwise, continue toward completing the task.
