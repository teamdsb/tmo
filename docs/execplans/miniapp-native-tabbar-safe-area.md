# 统一小程序原生 TabBar 与底部安全区

本 ExecPlan 是持续维护的文档，遵循 `docs/execplans/plans.md`。实施过程中必须持续更新 `Progress`、`Surprises & Discoveries`、`Decision Log` 和 `Outcomes & Retrospective`。

## Purpose / Big Picture

完成后，商城首页、分类、购物车和“我的”继续使用微信、支付宝等平台提供的原生 TabBar，不再由业务样式猜测原生 TabBar 高度。商品详情、订单确认、订单详情和业务员工作台等独立页面的底部操作区通过同一个共享组件读取设备安全区域，在带 Home Indicator、手势导航或传统按键导航的设备上都不会与系统操作区域重叠。开发者可以通过测试证明业务样式中不再散落 `safe-area-inset-bottom` 或 `--tabbar-safe-offset`。

## Progress

- [x] (2026-09-14 11:20+08:00) 核对仓库文档、原生 TabBar 配置、Taroify FixedView 实现和全部底部安全区样式。
- [x] (2026-09-14 11:35+08:00) 确定保留原生 TabBar，并把设备安全区、固定栏占位和业务间距拆分为互不重复的职责。
- [x] (2026-09-14 11:42+08:00) 为底部安全区运行时数据和共享组件添加失败测试，并实现 `getRuntimeDeviceInfo` 的底部 inset 归一化。
- [x] (2026-09-14 11:50+08:00) 实现 `AppFixedBottom` 与 `AppSafeAreaBottom`，覆盖运行时像素值和 CSS fallback。
- [x] (2026-09-14 12:02+08:00) 迁移购物车、商品详情、订单确认/详情、业务员工作台、客服、地址弹层和浮动操作区。
- [x] (2026-09-14 12:08+08:00) 删除遗留自定义 TabBar、固定 60px 安全区 token 和页面级底部安全区表达式；新增架构契约测试。
- [x] (2026-09-14 12:24+08:00) 更新 README、产品需求、变更记录和历史路由计划，完成定向 Jest、全量 Jest、Lint、微信/支付宝构建及产物校验。

## Surprises & Discoveries

- Observation: 2026-01 的路由 ExecPlan 要求页内 Taroify Tabbar，但当前 `apps/miniapp/src/app.config.ts` 已配置四项平台原生 TabBar，且共享 `AppTabbar` 没有任何页面引用。
  Evidence: `rg "<AppTabbar|AppTabbar\\(" apps/miniapp/src` 只返回组件自身定义。
- Observation: Taroify 0.9.0 的 `FixedView` 只有传入 `safeArea='bottom'` 才会添加 SafeArea，而 SafeArea 本身仅输出 CSS `env/constant`；当前四个 FixedView 中只有业务员工作台启用了该属性。
  Evidence: `apps/miniapp/node_modules/@taroify/core/fixed-view/fixed-view.js` 和项目内 FixedView 调用清单。
- Observation: 购物车、商品详情和订单确认已经使用 FixedView 的等高 placeholder，同时内容区还手工预留固定高度与安全区，形成重复责任。
  Evidence: `apps/miniapp/src/pages/cart/components.tsx`、`apps/miniapp/src/pages/goods/detail/index.tsx`、`apps/miniapp/src/pages/order/confirm/index.tsx` 及对应 SCSS。
- Observation: 本机默认 Node 无法加载 Homebrew `libsimdutf.34.dylib`，直接执行 pnpm 会在启动阶段退出；工作区 bundled Node 可运行 Jest、Taro、ESLint 和 Stylelint，但需要把 miniapp node_modules 放入 `NODE_PATH`。
  Evidence: 系统 Node/pnpm 退出码 134；bundled Node 下定向测试 115/115 通过，微信和支付宝 Taro 构建均完成。
- Observation: “我的”页面内部的聊天、需求弹层和订单子视图都位于原生 TabBar 页的可用窗口内，不应再次消费设备 bottom inset；只有独立客服页和地址页的底部 UI 需要共享 spacer。
  Evidence: 这些视图由 `pages/mine/index.tsx` 直接渲染，原生 TabBar 仍由 `app.config.ts` 接管。

## Decision Log

- Decision: 保留 `apps/miniapp/src/app.config.ts` 的平台原生 TabBar，不启用 `custom: true`。
  Rationale: 原生组件负责各平台 TabBar 与系统底部区域的适配；Taro 自定义 TabBar 的跨端支持弱于原生配置，且会增加状态同步和闪烁风险。
  Date/Author: 2026-09-14 / Codex
- Decision: 原生 TabBar 页面不计算 TabBar 高度，也不再次添加设备底部 inset；独立页面和全屏底部弹层才消费设备底部 inset。
  Rationale: 安全区必须只有一个所有者。原生 TabBar 页面的可用窗口以原生 TabBar 顶部为底边，再叠加 `60px + safe-area` 会把系统责任带回业务层。
  Date/Author: 2026-09-14 / Codex
- Decision: 新增项目自有的安全区基础组件，不继续直接使用 Taroify `safeArea='bottom'`。
  Rationale: 项目需要把平台运行时 `safeArea` 与 CSS env fallback 收敛到一个实现，并让 FixedView placeholder 测得包含安全区的完整高度。
  Date/Author: 2026-09-14 / Codex
- Decision: 不给“我的”页内部子视图和需求弹层添加 `AppSafeAreaBottom`；它们遵循原生 TabBar 的窗口边界，避免在原生 TabBar 之上重复留白。
  Rationale: 这些内容不是独立的 screen-bottom fixed UI，原生 TabBar 已经是唯一系统底部所有者。
  Date/Author: 2026-09-14 / Codex

## Outcomes & Retrospective

实现已完成。新增安全区计算和共享底部组件，原生 TabBar 页删除重复的 TabBar 高度与 inset，独立页面固定栏和底部弹层统一由共享组件处理。定向 Jest 115/115 通过，新增架构契约和安全区测试通过，ESLint/Stylelint 通过，微信和支付宝开发构建及路由/产物校验通过。全量 Jest 仍有一个与本任务无关的既有支付 mock 失败（`isolated-mock-mode.test.ts` 未提供当前必填的 `paymentMethod`），全量 TypeScript 也保留同一既有请求类型错误；这些未被本次改造掩盖，需由订单支付计划单独处理。真机不同机型视觉验收尚未在本环境执行。

## Context and Orientation

小程序位于 `apps/miniapp`，使用 Taro 4.1.9、React、TypeScript、Sass 和 Taroify 0.9.0。`apps/miniapp/src/app.config.ts` 的 `tabBar` 定义首页、分类、购物车和我的四个原生标签页。这里的“设备底部 inset”是屏幕物理底边与安全区域底边之间的逻辑像素距离；微信返回 `safeArea.bottom` 坐标时，可用 `screenHeight - safeArea.bottom` 得到该值。值为零是合法结果，例如没有底部遮挡的设备。

`apps/miniapp/src/utils/device-info.ts` 当前只归一化顶部安全区。`apps/miniapp/src/app.scss` 声明 `--tabbar-height: 60px` 和 `--tabbar-safe-offset`，并被首页通用内容、分类、购物车、订单列表和“我的”子视图使用。`apps/miniapp/src/components/app-tabbar/index.tsx` 是旧的页内 Tabbar，现已没有调用方。商品详情、购物车、订单确认和业务员工作台使用 Taroify FixedView；订单详情使用原生 CSS fixed；客服输入区和底部弹层则直接在页面样式中使用 CSS safe-area 表达式。

本计划新增两个基础单元。`getBottomSafeAreaMetrics()` 负责把不同平台返回的窗口信息转换成统一像素值，并明确区分“可靠地得到 0”和“API 不可用”。`AppFixedBottom` 负责固定定位、设备安全区和等高 placeholder；`AppSafeAreaBottom` 只用于并非 fixed 的底部内容或弹层。CSS `env(safe-area-inset-bottom)` 只能出现在这两个基础单元拥有的样式文件中，作为运行时 API 不可用时的 fallback。

## Plan of Work

第一个里程碑在 `apps/miniapp/src/utils/device-info.ts` 增加底部安全区归一化，并在新测试 `apps/miniapp/src/utils/device-info.test.ts` 覆盖明确的 `safeAreaInsets.bottom`、通过 `screenHeight - safeArea.bottom` 计算、无底部遮挡返回零、窗口 API 缺失使用 legacy 数据以及数据完全不可用五种情况。接口返回 `bottomSafeArea` 与 `bottomSafeAreaAvailable`，避免把未知和真实零值混为一谈。

第二个里程碑创建 `apps/miniapp/src/components/app-safe-area/index.tsx`、`index.scss` 和 `index.test.tsx`。`AppSafeAreaBottom` 输出唯一的安全区 spacer；若运行时数据可用，组件以内联 CSS 变量提供精确像素，否则使用样式文件中的 `env()` fallback。`AppFixedBottom` 内部使用 Taroify FixedView、`position='bottom'` 和 placeholder，并在内容之后渲染同一 spacer。组件提供 `includeSafeArea` 属性，默认用于独立页面；购物车处于原生 TabBar 页面，必须显式传 `false`，其固定栏以原生页面可用窗口为边界。

第三个里程碑迁移底部固定栏。`apps/miniapp/src/pages/cart/components.tsx` 使用 `AppFixedBottom includeSafeArea={false}`；`apps/miniapp/src/pages/goods/detail/index.tsx`、`apps/miniapp/src/pages/order/confirm/index.tsx`、`apps/miniapp/src/pages/order/detail/index.tsx` 和 `apps/miniapp/src/pages/sales/index.tsx` 使用默认安全区。对应 SCSS 仅保留固定栏业务内边距，不再出现 safe-area 表达式；FixedView placeholder 负责内容占位，商品详情、购物车和订单确认删除重复的手工固定栏高度。

第四个里程碑清理普通内容和弹层。`apps/miniapp/src/pages/support/chat/index.tsx`、`apps/miniapp/src/pages/account/address/index.tsx` 在需要触达物理屏幕底边的内容末尾使用 `AppSafeAreaBottom`；“我的”内部子视图继续以原生 TabBar 可用窗口为边界，不额外添加 spacer。原生 TabBar 页面的首页、分类和“我的”只保留业务间距；非 TabBar 的订单列表也不再假装下方存在 60px TabBar。随后删除 `apps/miniapp/src/components/app-tabbar/index.tsx`，移除 `--tabbar-height`、`--tabbar-safe-offset` 和所有调用。

第五个里程碑新增 `apps/miniapp/src/components/app-safe-area/contract.test.ts`，递归检查 `apps/miniapp/src` 下的 SCSS：除 `components/app-safe-area/index.scss` 外不允许出现 `safe-area-inset-bottom`、`--tabbar-height` 或 `--tabbar-safe-offset`。更新现有依赖旧字符串的购物车、分类、业务员、客服及订单样式测试。最后更新 `docs/context/product-requirements.md`，明确原生 TabBar 和安全区所有权；在旧 `docs/execplans/miniapp-routing.md` 决策旁标记其已被本计划取代。

## Concrete Steps

所有命令均在仓库根目录执行。先运行新增的安全区测试，预期在实现前因为导出或组件不存在而失败：

    pnpm -C apps/miniapp test -- src/utils/device-info.test.ts src/components/app-safe-area/index.test.tsx --runInBand

完成基础实现后重复运行同一命令，预期新增测试全部通过。每迁移一组页面，运行其定向测试：

    pnpm -C apps/miniapp test -- src/pages/cart/index.test.tsx src/pages/goods/detail/index.test.tsx src/pages/order/confirm/index.test.tsx src/pages/order/detail/index.test.tsx src/pages/sales/index.test.tsx --runInBand

    pnpm -C apps/miniapp test -- src/pages/support/chat/index.test.tsx src/pages/account/address/index.test.tsx src/pages/mine/index.test.tsx src/pages/category/index.test.tsx --runInBand

最终执行（使用 bundled Node 直接调用本地 Jest/Taro 二进制，以绕过本机 Node 动态库问题）：

    pnpm -C apps/miniapp test -- --runInBand
    pnpm -C apps/miniapp lint
    # Taro weapp/alipay builds completed with apps/miniapp/node_modules/.bin/taro
    # and were followed by verify-weapp-routes / verify-alipay-dist.
    git diff --check

若本机 Node 运行时仍报告 Homebrew `libsimdutf` 动态库缺失，应改用工作区依赖工具返回的 bundled Node 执行 pnpm，并在本计划的发现部分记录实际命令；不能把运行时损坏误报为代码失败。

## Validation and Acceptance

自动化验收要求安全区计算测试覆盖 iPhone 类底部 inset、真实零值、缺失字段和 legacy fallback；共享组件测试证明 `includeSafeArea` 开关不会重复消费安全区；架构契约测试证明业务 SCSS 不再直接包含底部 safe-area 或固定 TabBar 高度。新增及受影响的 Jest、ESLint、Stylelint、微信开发构建和支付宝开发构建以零退出；全量 Jest/TypeScript 的既有支付 mock 基线错误另行记录在 Outcomes。

真机验收时，在带 Home Indicator 的 iPhone、无 Home Indicator 的 iPhone、Android 手势导航和 Android 三键导航上分别打开四个原生 Tab 页面、购物车结算栏、商品详情栏、订单确认栏、订单详情栏、客服输入区、业务员工作台和地址弹层。可点击按钮、输入框和底部文案必须完全位于系统手势区域上方；同一页面不得出现额外的 60px 空带。微信与支付宝至少各完成一台真机检查。自动化不能替代这项视觉验收，若当前环境无法连接真机，结果必须明确标记为待人工确认。

## Idempotence and Recovery

测试、Lint 和构建命令可重复运行。修改现有文件时使用小范围补丁，保留订单详情和订单列表中已有的支付后刷新未提交改动。不得 reset、checkout 或删除用户文件。如果共享组件迁移中途失败，保留尚未迁移页面的原实现，逐页恢复测试通过后再继续；不要同时叠加新的临时安全区公式。

## Artifacts and Notes

基线盘点显示四个 FixedView 调用中只有业务员工作台传入底部安全区，业务 SCSS 中有二十余处 `safe-area-inset-bottom` 或 `tabbar-safe-offset`。当前工作区还包含订单详情、订单列表及生成 CSS 的用户修改，本计划不会覆盖或回退这些修改。

## Interfaces and Dependencies

`apps/miniapp/src/utils/device-info.ts` 的 `RuntimeDeviceInfo` 增加 `bottomSafeArea: number` 和 `bottomSafeAreaAvailable: boolean`。底部计算接受 Taro `getWindowInfo()` 结果并在必要时回退 `getSystemInfoSync()`；不引入新依赖。

`apps/miniapp/src/components/app-safe-area/index.tsx` 导出 `AppSafeAreaBottom` 和默认导出的 `AppFixedBottom`。固定栏属性至少包含 `children`、`className`、`contentClassName`、`placeholder` 与 `includeSafeArea`；实现继续复用 `@taroify/core/fixed-view` 的高度测量和 placeholder，不复制该逻辑。

变更记录：2026-09-14，依据用户选择原生 TabBar 的决定创建计划，目标是将设备 inset、原生导航和页面固定栏的责任收敛为单一规则。

变更记录：2026-09-14，实现后补充了 bundled Node 的验证证据、原生 TabBar 页内部视图的边界决策，以及全量支付 mock 基线失败的说明。
