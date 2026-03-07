# 小程序安全区与页面排布约定总结

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `docs/execplans/plans.md`.

## Purpose / Big Picture

这份文档的目的不是新增一个功能，而是把 `apps/miniapp` 里已经存在、且后续所有页面都必须遵守的“安全区与页面排布规则”讲清楚。完成后，新接手这个仓库的人可以只读这份文档，就知道页面为什么会被状态栏、胶囊按钮、底部手势条或 tabbar 挤压，也知道应该把顶部留白、内容滚动区、底部导航各自放在哪里。

可见结果是：阅读本文后，开发者能够统一实现三类页面。第一类是使用系统 tabbar 的普通主页面，例如首页和“我的”；第二类是使用 `custom` 导航栏的页面，例如业务员页的自定义顶部；第三类是页面内部自己维护底部导航的页面，例如业务员工作台。开发者还可以按本文中的命令重新构建 H5 或 Weapp，并观察安全区是否正确生效。

## Progress

- [x] (2026-03-06 18:55Z) 阅读 `docs/execplans/plans.md`，确认本文必须使用完整 ExecPlan 结构，而不是普通说明文。
- [x] (2026-03-06 18:58Z) 盘点 `apps/miniapp` 当前安全区实现，确认全局 CSS 变量、顶部导航高度计算、tabbar 占位、业务员页自定义底栏等入口位置。
- [x] (2026-03-06 19:03Z) 编写本文，整理当前仓库内安全区与页面排布规则、验证方法、恢复方式和后续维护要求。
- [ ] 后续如新增新的页面壳子或导航模型，必须同步更新本文对应章节与 Decision Log。

## Surprises & Discoveries

- Observation: 仓库里并不存在“一套统一页面壳组件”，当前安全区约定是由全局 CSS 变量、页面级 `Navbar`、以及少量页面自定义容器共同拼出来的。
  Evidence: `apps/miniapp/src/app.scss` 定义了 `--tabbar-safe-offset` 与 `--tabbar-safe-offset-legacy`，而 `apps/miniapp/src/pages/index/index.tsx`、`apps/miniapp/src/pages/sales/index.tsx`、`apps/miniapp/src/pages/mine/index.tsx` 分别按自己的方式接入这些变量。

- Observation: H5 和 Weapp 不能共享同一套顶部安全区实现。H5 可以依赖 `@taroify/core/navbar` 的 `placeholder` 占位，而 Weapp 在 `navigationStyle: 'custom'` 时必须自己插入顶部占位。
  Evidence: `apps/miniapp/src/pages/sales/index.tsx` 里，H5 分支使用 `Navbar bordered fixed placeholder`，Weapp 分支使用 `sales-safe-top-spacer` 和 `getNavbarTotalHeight()`。

- Observation: 页面内部自定义底部导航时，最容易出错的是把导航留在文档流里，导致“内容高度 + 底栏高度”一起把页面撑长。
  Evidence: 业务员页修复后改成 `sales-bottom-nav { position: fixed; bottom: 0; }`，同时内容区只保留 `padding-bottom: calc(16px + var(--tabbar-safe-offset))`，页面滚动高度才恢复正常。

## Decision Log

- Decision: 本文只总结当前 `apps/miniapp` 的真实实现，不额外发明新的抽象层或组件规范。
  Rationale: 用户要求的是“总结页面排布”，不是再设计一套未来架构。先把现状讲清楚，才能作为后续统一改造的依据。
  Date/Author: 2026-03-06 / Codex

- Decision: 以“页面壳模型”而不是“单文件罗列”的方式组织内容。
  Rationale: 安全区问题的本质是页面壳、滚动区、顶部区、底部区的关系。如果只按文件逐个列，会让读者知道代码在哪，却不知道为什么这样排。
  Date/Author: 2026-03-06 / Codex

- Decision: 明确把业务员页列为“自定义底部导航页面”单独说明。
  Rationale: 这个页面既不是普通 tabbar 页，也不是纯子页面；它同时处理 `custom` 顶部和页面内底部导航，是最容易回归的例子。
  Date/Author: 2026-03-06 / Codex

## Outcomes & Retrospective

本文已经把当前仓库中与安全区有关的核心事实整理成一份可独立阅读的执行文档。一个第一次进入仓库的开发者现在可以顺着本文找到高度计算的入口、页面布局的三种模型、以及验证是否正确的方法。

本文仍有边界。它总结的是 `apps/miniapp` 当前实现，而不是所有未来页面都自动正确的保证。后续如果出现新的页面壳模式，比如新的悬浮底部操作条、全屏弹层子页面或不同平台的导航栏策略，必须继续把经验回写到这里，否则文档会迅速过时。

## Context and Orientation

本仓库中与安全区最相关的前端工程是 `apps/miniapp`。这里的“安全区”是指页面内容不应被顶部状态栏、微信胶囊按钮、底部手势条、系统 tabbar 或页面自定义底部导航覆盖的那一段可视区域。“页面壳”是指一页最外层的布局结构，也就是顶部是否自定义、内容区是否滚动、底部是否有固定导航的整体组合方式。

全局安全区变量定义在 `apps/miniapp/src/app.scss`。这里最关键的三个变量是 `--tabbar-height`、`--tabbar-safe-offset` 和 `--tabbar-safe-offset-legacy`。它们用来表达“页面底部内容至少要给 tabbar 和底部安全区留出多少空间”。顶部导航的高度不是写死在 CSS 里，而是通过 `apps/miniapp/src/utils/navbar.ts` 里的 `getNavbarMetrics()`、`getNavbarStyle()` 和 `getNavbarTotalHeight()` 在运行时计算得出。这个计算会读取 `Taro.getMenuButtonBoundingClientRect()`、状态栏高度和安全区顶部高度，因此它能够在不同设备上给出接近真实导航区的数值。

目前仓库里可以分为三种页面壳模型。

第一种是“普通主页面”，例如 `apps/miniapp/src/pages/index/index.tsx` 和 `apps/miniapp/src/pages/mine/index.tsx`。这类页面通常依赖应用级 tabbar，因此主体内容会通过 `padding-bottom: calc(... + var(--tabbar-safe-offset))` 给底部腾位置。它们在 H5 上通常接一个 `Navbar` 的 placeholder，在 Weapp 上如果页面配置不是 `custom`，则交给系统导航栏处理。

第二种是“自定义顶部页面”，例如 `apps/miniapp/src/pages/goods/search/index.tsx`、`apps/miniapp/src/pages/order/list/index.tsx` 以及业务员页的顶部。这里的重点是：只要页面配置使用了 `navigationStyle: 'custom'`，页面代码就必须自己处理顶部安全区。H5 和 Weapp 的处理方式不一样。H5 可以直接依赖 `Navbar` 组件生成占位，Weapp 则通常需要一段显式的顶部 spacer，也就是只负责占高度、不承载业务内容的空白块。

第三种是“页面内自定义底部导航页面”，当前最典型的是 `apps/miniapp/src/pages/sales/index.tsx`。这类页面并不使用系统 tabbar，而是自己在页面底部固定一个导航。这里必须同时做到两件事：底部导航本身使用 `position: fixed` 脱离文档流，避免把页面总高度撑长；主体内容区使用底部安全区 padding 留出空间，避免滚动内容被导航压住。

## Plan of Work

如果有人要基于这份文档继续统一或修复页面排布，应该先从全局变量和页面壳入口读起，而不是直接从单个页面的细节样式开始调。第一步阅读 `apps/miniapp/src/app.scss`，理解仓库里所有主页面都共享的底部安全区变量，以及 `.app-navbar`、`.app-tabbar`、`.page-content` 这些基础类的职责。第二步阅读 `apps/miniapp/src/utils/navbar.ts`，确认顶部高度不是固定值，而是运行时根据设备信息计算出来的。

然后按页面壳类型阅读示例页面。普通主页面以 `apps/miniapp/src/pages/index/index.tsx` 和 `apps/miniapp/src/pages/mine/index.tsx` 为准，自定义底部导航页面以 `apps/miniapp/src/pages/sales/index.tsx` 为准。阅读时要把“最外层页面”、“内容滚动区”、“顶部占位”和“底部导航”四层结构分别找出来。只有这四层关系理顺了，后续再调整卡片、标题、按钮的视觉样式才不会引入新的安全区回归。

如果后续要新增页面，应先判断它属于哪种壳模型，再决定复用哪个现有实现。不要让一个新页面既复制首页的底部安全区写法，又另外加一层绝对定位底栏；也不要在 `navigationStyle: 'custom'` 的页面里只在 H5 上处理顶部安全区，却忘了 Weapp 分支。换句话说，页面应先选“布局模型”，再写视觉细节。

## Concrete Steps

在仓库根目录 `/Users/asimov3059/工作代码/tmall/tmo` 工作。若要理解当前实现，请按下面顺序阅读和验证。

1. 阅读全局安全区与导航变量定义：

    sed -n '1,260p' apps/miniapp/src/app.scss
    sed -n '1,220p' apps/miniapp/src/utils/navbar.ts

   预期：可以看到 `--tabbar-safe-offset`、`--tabbar-safe-offset-legacy`，以及 `getNavbarStyle()`、`getNavbarTotalHeight()` 之类的顶部高度计算函数。

2. 阅读普通主页面与自定义底部导航页面的入口：

    sed -n '1,260p' apps/miniapp/src/pages/index/index.tsx
    sed -n '1,260p' apps/miniapp/src/pages/mine/index.tsx
    sed -n '1,220p' apps/miniapp/src/pages/sales/index.tsx

   预期：首页和“我的”会表现出“主体内容 + tabbar 安全区 padding”的模式，业务员页会表现出“顶部占位 + 主体内容 + fixed 底部导航”的模式。

3. 如需在浏览器观察当前排布，可运行：

    pnpm -C apps/miniapp run dev:h5

   然后访问以下页面：

    http://127.0.0.1:10088/#/pages/index/index
    http://127.0.0.1:10088/#/pages/mine/index
    http://127.0.0.1:10088/#/pages/sales/index

   预期：首页和“我的”顶部应留出 H5 导航占位，底部内容不应被 tabbar 压住；业务员页顶部应有自定义导航安全区，底部导航固定，页面高度不应因为底栏重复参与文档流而变长。

4. 若要验证 Weapp 构建产物仍然包含这些页面，请运行：

    pnpm -C apps/miniapp run build:weapp:dev

   预期：构建通过，并生成 `dist/weapp/pages/index/index.*`、`dist/weapp/pages/mine/index.*`、`dist/weapp/pages/sales/index.*`。

## Validation and Acceptance

本文的验收标准不是“文件存在”，而是开发者能用它解释清楚当前仓库中的页面排布规则，并能据此排查一个页面为什么会出现安全区问题。最小验收方式有三条。

第一，开发者应能指出底部安全区变量定义在哪个文件，以及哪些类使用了这些变量。如果回答不出 `apps/miniapp/src/app.scss` 和 `--tabbar-safe-offset`，说明文档还不够清楚。

第二，开发者应能解释为什么 H5 与 Weapp 的顶部安全区实现不同，并能给出业务员页中对应的代码位置。如果读者无法说出 `Navbar placeholder` 与 Weapp spacer 的区别，说明本文没有达到“新手可执行”的标准。

第三，开发者应能启动 H5 或 Weapp，观察至少三个页面：首页、“我的”、业务员页，并确认这三个页面分别属于哪种页面壳模型。如果这一步做不到，说明文档虽然描述了文件，却没有把布局模型讲清楚。

## Idempotence and Recovery

本文本身是只读总结文档，可以重复阅读，不会改变仓库状态。验证命令中的 `pnpm -C apps/miniapp run dev:h5` 和 `pnpm -C apps/miniapp run build:weapp:dev` 也可以重复执行。若 H5 开发端口冲突，Taro 会自动切换端口；验证时只需查看终端输出里最终给出的地址即可。

如果后续页面改动导致安全区再次出错，恢复路径也应该遵循本文的排查顺序：先看页面是否选错了壳模型，再看顶部是否缺少 placeholder 或 spacer，最后看底部导航是不是错误地留在文档流中。不要一上来只靠加 `padding-top` 或 `margin-bottom` 临时修补，因为那通常只是在掩盖壳结构的问题。

## Artifacts and Notes

以下文件是阅读本文时最重要的实现锚点：

- `apps/miniapp/src/app.scss`：定义全局字体缩放、tabbar 高度、安全区底部偏移，以及多个页面共用的容器类。
- `apps/miniapp/src/utils/navbar.ts`：定义顶部导航高度计算逻辑。
- `apps/miniapp/src/pages/index/index.tsx`：首页，代表普通主页面壳。
- `apps/miniapp/src/pages/mine/index.tsx` 与 `apps/miniapp/src/pages/mine/components.tsx`：我的页面，代表普通主页面壳在用户中心场景下的使用方式。
- `apps/miniapp/src/pages/sales/index.tsx`：业务员页，代表自定义顶部与自定义底部导航并存的壳。
- `apps/miniapp/src/pages/sales/index.config.ts`：声明该页使用 `navigationStyle: 'custom'`，这是其必须自行处理顶部安全区的根本原因。

一个最小可观察的成功标准可以参考下面这段终端输出：

    > miniapp@1.0.0 build:weapp:dev
    > pnpm run clean:weapp && NODE_ENV=development taro build --type weapp --no-check
    ...
    [verify-weapp-routes] ok: 23 page route(s) and tabBar icon paths are valid
    [verify-weapp-api-base] ok (development): api base references "localhost:8080"

这段输出不能证明安全区视觉完全正确，但可以证明页面入口和构建路径是完整的，足以继续在开发者工具里进行视觉验收。

## Interfaces and Dependencies

本文涉及的核心接口和依赖只有三类。第一类是 Taro 提供的运行时设备信息接口，也就是 `Taro.getWindowInfo()`、`Taro.getSystemInfoSync()` 与 `Taro.getMenuButtonBoundingClientRect()`，它们通过 `apps/miniapp/src/utils/device-info.ts` 和 `apps/miniapp/src/utils/navbar.ts` 被包装成顶部高度计算。第二类是 `@taroify/core/navbar`，它主要用于 H5 端生成带占位的顶部导航。第三类是全局 Sass 变量和页面容器类，它们位于 `apps/miniapp/src/app.scss`，负责把“需要为底部导航留出多少空间”这件事统一表达出来。

如果未来要新增统一页面壳组件，建议它至少显式暴露四个概念：顶部占位高度、主体滚动区、底部安全区 padding、底部固定导航容器。只有这四个概念同时存在，组件才有资格替代当前分散在多个页面中的实现。

变更记录：2026-03-06 19:03Z，创建初版安全区与页面排布总结文档。原因：当前 `apps/miniapp` 已存在多种页面壳模型，且近期刚发生业务员页安全区回归，需要一份符合 `ExecPlan` 规范的仓库内说明文档来统一认知。
