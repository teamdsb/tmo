# Docs

`docs/` 是仓库的 agent-first 文档入口。目标不是堆积说明，而是让强 agent 在最短时间内找到“当前要读哪类文档”。

## 阅读顺序

默认按下面顺序进入：

1. 先看 `docs/context/`，确认稳定背景、业务规则和长期事实。
2. 如果是排障、联调或复现问题，看 `docs/runbooks/`。
3. 如果是复杂实现或重大重构，看 `docs/execplans/` 与 `docs/execplans/plans.md`。
4. 如果需要了解仓库级决策、文档治理或近期重要变化，看 `docs/decisions/README.md` 与 `docs/CHANGELOG.md`。

## 分类规则

### `docs/context/`

稳定背景与长期事实。这里放“做事前必须知道”的文档，例如产品需求、RBAC、支付接入、领域约定。默认是稳定文档，不要求高频追加。

当前 canonical 文档：

- `product-requirements.md`
- `rbac.md`
- `payment-setup.md`
- `commerce-conventions.md`
- `customer-finance-ledger.md`

### `docs/runbooks/`

排障、联调、操作步骤、审计与时效性文档。这里回答“如何定位/复现/操作”，而不是“系统长期应该是什么样”。

这类文档允许带日期；带日期的文档默认视为归档或审计记录。

### `docs/decisions/`

仓库级决策与规则变化。只记录会影响后续 agent 判断、实现策略或文档治理的变化，不记录任务过程流水账。

### `docs/execplans/`

复杂功能、重大重构和多阶段工作使用的 ExecPlan。这里是特殊活文档区，必须遵守 `docs/execplans/plans.md`。

## 活文档与稳定文档

长期活文档只保留最小集合：

- `docs/execplans/*.md`
- `docs/decisions/README.md`
- `docs/CHANGELOG.md`

其余文档默认是稳定文档或一次性归档文档。除非内容已经失真，否则不要为了“显得勤奋”做无意义追加。

## 更新规则

- 产品范围、业务规则、角色权限变化：更新 `docs/context/` 下对应 canonical 文档。
- 新增排障步骤、联调结论、一次性审计：更新 `docs/runbooks/`。
- 新的仓库级规则、文档治理决策、长期约定：更新 `docs/decisions/README.md`。
- 会影响后续 agent 判断的重要近期变化：追加到 `docs/CHANGELOG.md`。
- 复杂功能或重大重构：新增或维护 `docs/execplans/*.md`。

## 命名规则

- 文档文件名统一使用 ASCII `kebab-case`。
- 正文标题可以继续使用中文。
- 只有 runbook/audit 这类时效性文档允许在文件名中带日期，格式固定为 `yyyy-mm-dd`。
- 不再向 `docs/` 根目录直接新增散文件；新文档必须先归类到上述目录之一。
