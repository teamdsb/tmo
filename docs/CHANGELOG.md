# Changelog

这个文件只记录会影响后续 agent 判断的近期仓库变化，不承担发布说明、项目周报或任务流水账职责。

## 2026-03-08

- 重组 `docs/` 为 `context/`、`runbooks/`、`decisions/`、`execplans/` 四层结构，并新增 `docs/README.md` 作为总入口。
  影响面：后续新增文档必须先归类；旧的 `docs/` 根目录散文件路径已失效。
  建议阅读：`docs/README.md`、`docs/decisions/README.md`

- 统一 `docs/` 文档文件名为 ASCII `kebab-case`，并将 `docs/RUNBOOK/` 更名为 `docs/runbooks/`。
  影响面：引用旧文件名或旧目录名的脚本、README、ExecPlan 需要使用新路径。
  建议阅读：`docs/README.md`
