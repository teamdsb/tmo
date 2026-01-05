# Admin/Customer 五页面小程序原型（Taro React TS）

这是一个持续维护的执行计划。Progress、Surprises & Discoveries、Decision Log、Outcomes & Retrospective 必须随着实施过程持续更新。

本计划受 doc/execplans/PLANS.md 约束，必须符合其中的编写与维护要求。

## Purpose / Big Picture

完成后，微信小程序中会有五个可预览页面：Admin Salesperson List、Admin Salesperson Details、Admin Customer List、Admin Customer Details、Customer Profile。管理员能浏览业务员列表与客户列表，并查看详情页面；客户侧可查看个人资料与绑定业务员信息。验证方式是运行 Taro 开发编译，在微信开发者工具中逐页打开这些页面，观察布局与 `stitch_customer_scan_qr_code 2/` 中的 `screen.png` 视觉参考一致，结构与 `code.html` 保持匹配。

## Progress

- [x] (2026-01-05 17:55Z) 盘点 `stitch_customer_scan_qr_code 2/` 下 5 个页面的 HTML/PNG 资产并整理清单。
- [x] (2026-01-05 17:55Z) 记录每个页面的核心布局模块与复用元素（顶栏、搜索、列表卡片、状态标签、头像）。
- [x] (2026-01-05 18:45Z) 初始化 `miniapp/` 目录并生成 Taro React TS 工程骨架。
- [x] (2026-01-05 18:45Z) 搭建页面路由与基础主题变量（颜色、圆角、阴影、字体）。
- [x] (2026-01-05 18:45Z) 实现 Admin Salesperson List 页面（搜索栏、列表项、底部 CTA）。
- [x] (2026-01-05 18:45Z) 实现 Admin Salesperson Details 页面（档案卡、统计卡、绑定码卡、关联客户列表）。
- [x] (2026-01-05 18:45Z) 实现 Admin Customer List 页面（搜索栏、筛选 Chips、列表项、浮动按钮）。
- [x] (2026-01-05 18:45Z) 实现 Admin Customer Details 页面（联系信息、绑定关系、转移按钮）。
- [x] (2026-01-05 18:45Z) 实现 Customer Profile 页面（个人资料、业务员卡片、账户信息、操作区）。
- [ ] 运行 Taro weapp 编译并在开发者工具中完成五页目视验收。

## Surprises & Discoveries

- Observation: 五个页面的 HTML 都依赖 Material Symbols 字体与外链头像/二维码图片。
  Evidence: `code.html` 中包含 Google Fonts 与 `lh3.googleusercontent.com` 的图片链接。
- Observation: `admin_customer_list` 的背景色与其他页面不同（`#ffffff` vs `#f6f7f8`）。
  Evidence: 对应 HTML 中 `background-light` 的色值不一致。
- Observation: Taro 4.1.9 CLI 对 `--css none` / `--css sass` 参数报错。
  Evidence: CLI 报错 “value does not match any variant of enum CSSType”，改为交互选择后通过。
- Observation: Taro CLI 初始化流程包含多步交互（描述、框架、ES5、CSS 预处理器、包管理器、编译工具、模板源），早期因参数不兼容导致多次重试。
  Evidence: 需在交互中选择合法 CSS 预处理器与模板源才能完成初始化。
- Observation: Taro 初始化默认在项目内执行 `git init`。
  Evidence: 初始化日志显示 “初始化 git 成功”，后续移除 `miniapp/.git` 以避免嵌套仓库。

## Decision Log

- Decision: 以 `stitch_customer_scan_qr_code 2/<page>/code.html` 为结构基准，`ex.html` 仅作为 `admin_salesperson_details` 的重复参考。
  Rationale: 新增目录包含完整五页来源与截图，优先作为统一输入。
  Date/Author: 2026-01-05 / codex
- Decision: 页面路径采用 `miniapp/src/pages/admin/...` 与 `miniapp/src/pages/customer/...` 的层级划分。
  Rationale: 区分管理员与客户侧页面，便于后续权限与路由组织。
  Date/Author: 2026-01-05 / codex
- Decision: 使用 CSS Modules + 全局主题变量（`miniapp/src/app.scss`）控制颜色与圆角，不引入 Tailwind。
  Rationale: 与已有技术选型一致，避免引入额外构建依赖。
  Date/Author: 2026-01-05 / codex
- Decision: 选择 Sass 作为 CLI 的 CSS 预处理器以获得可用的模块化样式扩展名（`.module.scss`）。
  Rationale: CLI 在 4.1.9 版本要求交互选择合法 CSS 类型，Sass 可与模块化命名结合。
  Date/Author: 2026-01-05 / codex
- Decision: 图标与头像采用本地 assets 占位，避免远程字体与图片域名限制。
  Rationale: 小程序对远程字体与图片域名有限制，本地资源更稳定。
  Date/Author: 2026-01-05 / codex
- Decision: 每个页面使用自定义导航栏（`navigationStyle: "custom"`）。
  Rationale: HTML 顶部栏为自绘样式，避免系统导航栏重复占位。
  Date/Author: 2026-01-05 / codex

## Outcomes & Retrospective

未开始。

## Context and Orientation

仓库当前没有 `miniapp/` 小程序工程，新增页面素材位于 `stitch_customer_scan_qr_code 2/`。该目录下包含五个页面，每个页面都有 `code.html`（结构与样式参考）和 `screen.png`（视觉对照）：

- `stitch_customer_scan_qr_code 2/admin_salesperson_list/code.html`
- `stitch_customer_scan_qr_code 2/admin_salesperson_details/code.html`
- `stitch_customer_scan_qr_code 2/admin_customer_list/code.html`
- `stitch_customer_scan_qr_code 2/admin_customer_details/code.html`
- `stitch_customer_scan_qr_code 2/customer_profile/code.html`

本计划将这些 HTML 结构转换为 Taro 的页面组件（`View`、`Text`、`Image`、`Input`），并使用 CSS Modules 还原视觉。`screen.png` 仅用于人工比对，不参与运行时资源。由于小程序对远程字体与图片域名有约束，需要将头像、二维码、图标替换为本地 assets。

## Plan of Work

先初始化 `miniapp/` Taro React TS 工程，确保包含 weapp 构建脚本。然后在 `miniapp/src/app.scss` 定义全局主题变量（如主色、背景色、边框色、圆角与阴影），并为页面提供一致的字体与背景基底。接着创建 `miniapp/src/assets/`，按 `icons/` 与 `images/` 组织本地图标与头像占位资源，保证页面在无外链的情况下可显示完整 UI。

页面实现采用“每页一目录”的方式：每个页面包含 `index.tsx`、`index.module.css`、`index.config.ts`。页面代码以 mock 数据驱动渲染，遵循 HTML 结构拆分为顶栏、搜索/筛选、列表卡片、信息卡片与操作区。可以在 `miniapp/src/components/ui/` 中提供少量可复用组件（如 `TopBar`、`StatusPill`、`Avatar`），以减少多页重复，同时保持样式隔离。

具体页面拆解如下。Admin Salesperson List 包含顶部栏、搜索框、列表统计头、业务员列表项与底部新增按钮。Admin Salesperson Details 复刻头像卡、统计卡、绑定码卡与关联客户列表。Admin Customer List 包含搜索、筛选 Chips、客户列表项与浮动添加按钮。Admin Customer Details 由头像头部、联系信息列表、绑定关系卡与“Transfer Ownership”按钮组成。Customer Profile 包含资料头像、绑定业务员卡、账户信息字段与操作按钮（扫码、退出）。

完成页面后更新 `miniapp/src/app.config.ts` 注册页面路由，并为每页设置 `navigationStyle: "custom"`。最后运行 weapp 编译，在微信开发者工具中逐页比对 `screen.png` 进行目视验收。

## Concrete Steps

所有命令在仓库根目录执行，除非特别说明。

1) 初始化 Taro 工程骨架（如 `miniapp/` 不存在）。

    npx @tarojs/cli init miniapp

   选择 React + TypeScript 模板，样式选择 CSS Modules。

2) 建立页面目录与通用资源目录。

    mkdir -p miniapp/src/pages/admin/salesperson-list
    mkdir -p miniapp/src/pages/admin/salesperson-details
    mkdir -p miniapp/src/pages/admin/customer-list
    mkdir -p miniapp/src/pages/admin/customer-details
    mkdir -p miniapp/src/pages/customer/profile
    mkdir -p miniapp/src/components/ui
    mkdir -p miniapp/src/assets/icons
    mkdir -p miniapp/src/assets/images

3) 在 `miniapp/src/app.scss` 添加主题变量与基础样式（示例在 Artifacts and Notes）。

4) 在每个页面目录创建文件：

    index.tsx
    index.module.css
    index.config.ts

5) 更新 `miniapp/src/app.config.ts` 的 pages 列表，加入：

    pages: [
      "pages/admin/salesperson-list/index",
      "pages/admin/salesperson-details/index",
      "pages/admin/customer-list/index",
      "pages/admin/customer-details/index",
      "pages/customer/profile/index"
    ]

6) 为每页的 `index.config.ts` 设置：

    export default { navigationStyle: "custom" }

7) 放置本地图标与头像占位资源（例如 `avatar-1.png`, `qr.png`, `icon-search.png`），并在页面中引用。

8) 启动开发编译并在微信开发者工具中预览：

    cd miniapp
    npm run dev:weapp

## Validation and Acceptance

验收标准为可观察行为：
1) `npm run dev:weapp` 后可在微信开发者工具打开五个页面并正常渲染。
2) Admin Salesperson List 显示搜索栏、列表项、状态标签与底部新增按钮，滚动正常。
3) Admin Salesperson Details 显示头像信息、统计卡、绑定码卡与关联客户列表，布局与 `screen.png` 视觉一致。
4) Admin Customer List 显示筛选 Chips、列表项的“Linked/Unlinked”状态与右下角浮动按钮。
5) Admin Customer Details 显示联系信息卡片、绑定关系卡片与 “Transfer Ownership” 按钮。
6) Customer Profile 显示个人资料、业务员卡片、账户信息字段与扫码/退出按钮。

## Idempotence and Recovery

若 `miniapp/` 已存在，可跳过初始化步骤，直接新增页面目录与资源。若页面实现出现问题，删除新增页面目录与相关 assets 可回到初始状态。构建产物位于 `miniapp/dist`，清理该目录不会影响源码。

## Artifacts and Notes

全局主题变量示例（放在 `miniapp/src/app.scss`）：

    :root {
      --color-primary: #137fec;
      --color-bg-light: #f6f7f8;
      --color-bg-white: #ffffff;
      --color-border: #e2e8f0;
      --radius-lg: 16px;
      --radius-md: 12px;
      --shadow-card: 0 6px 18px rgba(15, 23, 42, 0.06);
    }

页面 mock 数据示例（简化展示，实际可按页面拆分）：

    const salespersonList = [
      { id: "8821", name: "John Doe", status: "active", customerCount: 45, avatar: "avatar-1.png" },
      { id: "9920", name: "Sarah Smith", status: "onLeave", customerCount: 12, avatar: "avatar-2.png" }
    ];

    const customerList = [
      { id: "c1", name: "Alice Smith", email: "alice@example.com", linkStatus: "linked", linkedTo: "Mark Johnson" },
      { id: "c2", name: "Bob Jones", email: "bob.jones@example.com", linkStatus: "unlinked" }
    ];

## Interfaces and Dependencies

依赖与接口在本计划完成时必须存在：
- Taro CLI 3.x（用于初始化与 weapp 编译）。
- React 18 + TypeScript（Taro 默认模板）。
- `@tarojs/components` 中的 `View`、`Text`、`Image`、`Input`、`Button`。

页面数据类型建议定义在各自页面文件或 `miniapp/src/types/admin.ts` 与 `miniapp/src/types/customer.ts`：

    type SalespersonStatus = "active" | "onLeave" | "inactive";
    type CustomerLinkStatus = "linked" | "unlinked" | "vip";
    type CustomerStatus = "active" | "inactive";

    interface SalespersonListItem {
      id: string;
      name: string;
      status: SalespersonStatus;
      customerCount: number;
      avatar?: string;
    }

    interface SalespersonDetailsData {
      name: string;
      title: string;
      verified: boolean;
      stats: { totalCustomers: number; activeThisMonth: number };
      bindCode: string;
      customers: { id: string; name: string; boundAt: string; status: CustomerStatus; initials?: string; avatar?: string }[];
    }

    interface CustomerListItem {
      id: string;
      name: string;
      email: string;
      linkStatus: CustomerLinkStatus;
      linkedTo?: string;
      avatar?: string;
      initials?: string;
    }

    interface CustomerDetailsData {
      id: string;
      name: string;
      status: CustomerStatus;
      phone: string;
      email: string;
      salesRepName: string;
      assignedAt: string;
      avatar?: string;
    }

    interface CustomerProfileData {
      name: string;
      verified: boolean;
      email: string;
      phone: string;
      company: string;
      salesRepName: string;
      salesRepAvatar?: string;
    }

Plan change note: 根据 `stitch_customer_scan_qr_code 2/` 的五页 HTML 与 PNG 资产扩展 ExecPlan 范围，补充多页面拆解、路由与资源策略（2026-01-05 / codex）。
Plan change note: 完成 Taro miniapp 初始化、页面路由与五页基础布局实现，等待编译验证（2026-01-05 / codex）。
