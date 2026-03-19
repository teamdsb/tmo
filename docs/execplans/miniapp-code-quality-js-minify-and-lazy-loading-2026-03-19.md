# 修复小程序代码质量中的 JS 压缩与组件按需注入

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `docs/execplans/PLANS.md`.

## Purpose / Big Picture

完成后，`apps/miniapp` 在微信开发者工具的“代码质量”面板里，不再因为“未开启 JS 文件压缩”和“未开启组件懒注入（按需注入）”而失败。对仓库维护者来说，这项工作的可见结果不是“多了两个配置项”这么简单，而是把微信官方要求稳定地固化到源码和构建产物里：无论开发者直接打开仓库内的微信项目配置，还是重新跑一遍 `weapp` 构建，都能得到符合这两条规则的结果。

这项改动的验收方式有两层。第一层是静态配置验收：`apps/miniapp/project.config.json` 与构建后 `apps/miniapp/dist/weapp/project.config.json` 都要体现脚本压缩开启；`apps/miniapp/src/app.config.ts` 生成的 `dist/weapp/app.json` 要带上组件按需注入配置。第二层是工具侧验收：在微信开发者工具重新编译并重新扫描代码质量后，这两项不再显示未通过。

## Progress

- [x] (2026-03-19 12:40Z) 重新阅读 `docs/execplans/PLANS.md`，确认当前任务需要单独写成自包含 ExecPlan，而不是把过程零散写进聊天记录。
- [x] (2026-03-19 12:44Z) 阅读微信代码质量规则与官方配置文档，确认本任务对应的两个真实配置点分别是 `project.config.json` 中的 `setting.minified: true`，以及 `app.json` 中的 `lazyCodeLoading: "requiredComponents"`。
- [x] (2026-03-19 12:47Z) 调研 `apps/miniapp` 当前实现，确认项目根配置 `apps/miniapp/project.config.json` 的 `setting.minified` 仍为 `false`，同时 `apps/miniapp/src/app.config.ts` 尚未声明 `lazyCodeLoading`。
- [x] (2026-03-19 12:49Z) 调研构建链路，确认 `apps/miniapp/scripts/postprocess-weapp-project.js` 会在 `weapp` 构建后重写 `dist/weapp/project.config.json`，因此必须同步在这个脚本里强制写入 `setting.minified: true`，否则源码配置可能被产物覆盖。
- [x] (2026-03-19 12:52Z) 修改 `apps/miniapp/src/app.config.ts`、`apps/miniapp/project.config.json`、`apps/miniapp/scripts/postprocess-weapp-project.js`，把微信代码质量要求固化到源码和产物后处理逻辑中。
- [x] (2026-03-19 12:59Z) 运行 `pnpm -C apps/miniapp build:weapp:dev` 验证，确认 `dist/weapp/app.json` 已生成 `lazyCodeLoading: "requiredComponents"`，`dist/weapp/project.config.json` 已生成 `setting.minified: true`。
- [ ] 在微信开发者工具中手工重新扫描“代码质量”，确认这两项从“未通过”变为“已通过”。这个步骤依赖本机 GUI，当前文档先记录代码与构建层面的完成状态。

## Surprises & Discoveries

- Observation: 这次问题不只是“项目根配置值写错了”，而是仓库里同时存在源码配置和构建产物后处理脚本两个入口，必须一起改，否则重新构建后仍可能回退到旧值。
  Evidence: `apps/miniapp/scripts/postprocess-weapp-project.js` 会在 `weapp` 构建后直接读写 `dist/weapp/project.config.json`，而修复前这个脚本没有设置 `config.setting.minified = true`。

- Observation: `apps/miniapp` 的微信代码质量问题和 Taro 源码入口之间有一层映射。开发者不会直接维护 `app.json`，而是维护 `src/app.config.ts`，再由 Taro 产出 `dist/weapp/app.json`。
  Evidence: `pnpm -C apps/miniapp build:weapp:dev` 后，`apps/miniapp/dist/weapp/app.json` 是由 `apps/miniapp/src/app.config.ts` 生成的，修复前该源码文件没有 `lazyCodeLoading`，修复后产物出现了对应字段。

- Observation: 微信开发者工具的“JS 文件压缩”规则在项目配置里对应的是通用的 `setting.minified`，而不是额外单独的 `minifyJS` 字段。
  Evidence: 本地核对微信开发者工具项目配置说明后，示例配置使用的是 `setting.minified: true`；仓库当前 `apps/miniapp/project.config.json` 也正是通过这个字段表达是否压缩。

- Observation: 截图里 `WXML` 和 `WXSS` 压缩已经通过，因此这次任务的最小修改范围应只覆盖截图中仍失败的两项，不应顺手改动无关的打包策略。
  Evidence: 用户提供的微信开发者工具截图中，`WXML 文件` 与 `WXSS 文件` 显示“已通过”，只有 `JS 文件` 与 `组件` 显示“未通过”。

## Decision Log

- Decision: 不修改当前 `.agent/PLANS.md`，而是在 `docs/execplans/` 新增独立 ExecPlan。
  Rationale: `.agent/PLANS.md` 已承载另一项进行中的任务，直接覆盖会污染当前执行上下文；本次代码质量修复范围独立，适合单独存档。
  Date/Author: 2026-03-19 / Codex

- Decision: 组件按需注入通过 `apps/miniapp/src/app.config.ts` 增加 `lazyCodeLoading: "requiredComponents"` 实现，而不是手工编辑构建产物。
  Rationale: `dist/weapp/app.json` 是构建产物，直接编辑不可持续；只有修改 Taro 源配置，后续构建才能稳定保留这一行为。
  Date/Author: 2026-03-19 / Codex

- Decision: JS 压缩既修改 `apps/miniapp/project.config.json`，也修改 `apps/miniapp/scripts/postprocess-weapp-project.js`。
  Rationale: 只改项目根配置不能保证构建后产物正确；只改产物后处理又无法保证开发者直接打开项目根时看到正确设置。两处同时收敛才能避免漂移。
  Date/Author: 2026-03-19 / Codex

- Decision: 本次任务只修复微信代码质量截图里明确失败的两项，不顺带改造分包、无依赖文件或其他体积治理项。
  Rationale: 用户诉求和截图都聚焦在两个明确问题上，先做最小闭环更稳妥；其余代码质量项可在独立任务中继续展开。
  Date/Author: 2026-03-19 / Codex

## Outcomes & Retrospective

本次任务在代码和构建层面已经完成闭环。现在源码入口 `apps/miniapp/src/app.config.ts` 会稳定生成带有 `lazyCodeLoading: "requiredComponents"` 的 `app.json`，而微信项目配置 `apps/miniapp/project.config.json` 与构建后产物 `apps/miniapp/dist/weapp/project.config.json` 都会稳定保持 `setting.minified: true`。这意味着“JS 文件压缩”和“组件按需注入”已经不再依赖人工在开发者工具界面里逐次点选。

当前唯一仍未在本文内直接完成的是 GUI 侧重新扫描。由于 Codex 不能直接操作用户本机的微信开发者工具界面，这一步留给手工确认；但构建产物已经证明仓库侧所需字段齐备，后续若工具中仍显示旧结果，优先考虑项目缓存或旧工程实例未重新加载，而不是仓库配置未生效。

## Context and Orientation

本仓库的小程序工程位于 `apps/miniapp`，技术栈是 Taro + React + TypeScript。这里需要先澄清三个容易混淆的文件角色。

`apps/miniapp/src/app.config.ts` 是 Taro 的小程序全局配置源码。它不是微信开发者工具直接读取的最终文件，但 Taro 在构建 `weapp` 时会根据它生成 `apps/miniapp/dist/weapp/app.json`。如果要让最终的微信小程序 `app.json` 带某个字段，正确入口通常是这个 TypeScript 文件。

`apps/miniapp/project.config.json` 是微信开发者工具项目配置文件，作用于工程设置，例如是否在上传时自动压缩脚本文件。微信代码质量面板里的“JS 文件压缩”检查对应该文件中的 `setting.minified`。当它是 `true` 时，表示上传代码时会自动压缩脚本文件；当它是 `false` 时，代码质量面板会提示未通过。

`apps/miniapp/scripts/postprocess-weapp-project.js` 是本仓库自定义的构建后处理脚本。`apps/miniapp/scripts/build-weapp.js` 在执行 `taro build --type weapp` 后，会额外调用这个脚本去修正构建产物目录中的 `project.config.json`。这意味着，如果这里只保留旧逻辑，即使项目根配置改对了，重新构建后 `dist/weapp/project.config.json` 也可能被写回到旧状态。

这次任务对应的两条微信规则在仓库中的落点如下。第一条“开启 JS 压缩”对应 `apps/miniapp/project.config.json` 和 `apps/miniapp/dist/weapp/project.config.json` 中的 `setting.minified: true`。第二条“开启组件按需注入”对应 `apps/miniapp/dist/weapp/app.json` 中的 `lazyCodeLoading: "requiredComponents"`，而它的源码入口是 `apps/miniapp/src/app.config.ts`。

## Plan of Work

先把微信规则与仓库结构对齐，再做三处最小修改，最后通过构建确认产物。第一步是确认“截图中的失败项”各自对应哪个仓库配置入口，避免把微信开发者工具界面选项误以为只能手工点击。这个步骤已经得出结论：脚本压缩对应 `project.config.json` 的 `setting.minified`，组件按需注入对应 `app.json` 的 `lazyCodeLoading: "requiredComponents"`。

第二步是修改源码入口。对于组件按需注入，在 `apps/miniapp/src/app.config.ts` 的顶层配置对象中加入 `lazyCodeLoading: 'requiredComponents'`。这样 Taro 在生成 `dist/weapp/app.json` 时就会携带该字段。

第三步是修改微信项目配置与构建产物后处理。先在 `apps/miniapp/project.config.json` 中把 `setting.minified` 从 `false` 改为 `true`，让仓库中的微信项目定义本身符合规则。然后在 `apps/miniapp/scripts/postprocess-weapp-project.js` 中加入同样的强制逻辑：如果构建产物中的 `config.setting.minified !== true`，就改写为 `true`。这样一来，无论是直接打开工程，还是通过仓库脚本重新构建，最终微信项目配置都不会漂移回旧状态。

第四步是运行一次 `weapp` 构建来验证结果。该步骤的目标不是单纯“构建成功”，而是检查两个关键产物：`apps/miniapp/dist/weapp/app.json` 是否出现 `lazyCodeLoading`，以及 `apps/miniapp/dist/weapp/project.config.json` 是否出现 `setting.minified: true`。

## Concrete Steps

在仓库根目录 `/Users/asimov3059/工作代码/tmall/tmo` 中工作。

1. 编辑以下文件。

    `apps/miniapp/src/app.config.ts`
    `apps/miniapp/project.config.json`
    `apps/miniapp/scripts/postprocess-weapp-project.js`

    修改目标如下：

    - 在 `src/app.config.ts` 中增加：

          lazyCodeLoading: 'requiredComponents'

    - 在 `project.config.json` 中确保：

          "setting": {
            "minified": true
          }

    - 在 `postprocess-weapp-project.js` 中确保构建后若 `config.setting.minified !== true`，就把它写成 `true`。

2. 运行 `weapp` 构建。

        pnpm -C apps/miniapp build:weapp:dev

    预期：构建完成，并依次执行 tailwind、clean、taro build、`postprocess-weapp-project`、`verify-weapp-routes`、`verify-miniapp-api-base`。

3. 检查构建产物。

        sed -n '1,80p' apps/miniapp/dist/weapp/app.json
        sed -n '1,80p' apps/miniapp/dist/weapp/project.config.json

    预期：`app.json` 中出现 `lazyCodeLoading`，`project.config.json` 中出现 `"minified": true`。

4. 在微信开发者工具中重新打开或重新编译项目，然后重新扫描“代码质量”。

    预期：`JS文件` 与 `组件` 两项不再显示“未通过”。如果仍显示旧状态，先重启项目或清理开发者工具缓存后再检查。

## Validation and Acceptance

本次工作的最低验收标准是代码和产物双重正确。运行：

    pnpm -C apps/miniapp build:weapp:dev

后，必须同时满足以下观察结果：

    apps/miniapp/dist/weapp/app.json
      "lazyCodeLoading": "requiredComponents"

    apps/miniapp/dist/weapp/project.config.json
      "minified": true

更高一级的验收标准是微信开发者工具中的实际显示。把项目重新编译并重新扫描后，截图中的两项问题都应消失。如果工具仍然报旧状态，但仓库内产物已符合预期，那么优先排查微信开发者工具缓存、打开的是否是旧项目目录、以及是否重新加载了最新 `dist/weapp`。

## Idempotence and Recovery

这次修改是幂等的，也就是可以安全重复执行。重复运行 `pnpm -C apps/miniapp build:weapp:dev` 不会制造额外状态；`postprocess-weapp-project.js` 只会在发现 `minified` 不是 `true` 时才改写配置。

如果后续发现某些开发流程确实必须关闭 `minified` 做特殊调试，可以临时手工在微信开发者工具里修改本地私有设置，但不应改回仓库中的公共配置。若确实要回退本次改动，恢复路径也很明确：删除 `apps/miniapp/src/app.config.ts` 中新增的 `lazyCodeLoading`，并把 `apps/miniapp/project.config.json` 与 `apps/miniapp/scripts/postprocess-weapp-project.js` 中的 `minified` 强制逻辑一起撤回，避免源码和产物逻辑不一致。

## Artifacts and Notes

这次实施过程中最关键的命令与结果如下。

    修改前，仓库状态：
      apps/miniapp/project.config.json
        "minified": false

      apps/miniapp/src/app.config.ts
        不包含 lazyCodeLoading

      apps/miniapp/scripts/postprocess-weapp-project.js
        不会把 dist/weapp/project.config.json 的 minified 改成 true

    修改后，关键 diff：
      apps/miniapp/src/app.config.ts
        + lazyCodeLoading: 'requiredComponents',

      apps/miniapp/project.config.json
        - "minified": false
        + "minified": true

      apps/miniapp/scripts/postprocess-weapp-project.js
        + if (config.setting.minified !== true) {
        +   config.setting.minified = true
        +   changed = true
        + }

    实际执行的验证命令：
      pnpm -C apps/miniapp build:weapp:dev

    实际观察到的构建结论：
      [postprocess-weapp-project] appid already wx8e8831fc456f019b, urlCheck=false, packNpmManually=false
      [verify-weapp-routes] ok: 26 page route(s) and tabBar icon paths are valid
      [verify-miniapp-api-base] ok (weapp/development): api base references "localhost:8080"

    修改后的产物片段：
      apps/miniapp/dist/weapp/app.json
        "lazyCodeLoading": "requiredComponents"

      apps/miniapp/dist/weapp/project.config.json
        "minified": true

变更记录：2026-03-19 12:52Z，创建“小程序代码质量 JS 压缩与组件按需注入”ExecPlan。原因：用户要求按仓库 `PLANS.md` 规范沉淀一份任务文档，并基于该文档修复微信代码质量中的两项明确失败配置。
变更记录：2026-03-19 12:59Z，更新 ExecPlan 为已实施状态。原因：代码修改和命令行构建验证已经完成，需要把现状、决策、证据和剩余人工验证步骤写回文档，便于后续重复执行。

## Interfaces and Dependencies

`apps/miniapp/src/app.config.ts` 必须继续作为小程序全局配置源码入口，不应改成直接维护 `dist/weapp/app.json`。这既是 Taro 的正常使用方式，也是避免构建产物被覆盖的唯一稳定路径。

`apps/miniapp/scripts/build-weapp.js` 当前的工作流会在 `taro build --type weapp --no-check` 之后调用 `apps/miniapp/scripts/postprocess-weapp-project.js`。因此凡是希望稳定存在于 `dist/weapp/project.config.json` 的项目配置，都应在这个后处理脚本中显式维护，而不是假设 Taro 生成值总是正确。

`apps/miniapp/project.config.json` 仍然是微信开发者工具打开仓库工程时的重要入口。对微信代码质量这种直接依赖项目设置的规则，仓库里的这个文件与构建产物目录里的同名文件都需要保持一致。
