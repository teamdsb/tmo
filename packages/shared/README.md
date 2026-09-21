# shared

TypeScript DTOs, enums, validators, and constants shared across apps.

## Exports

- `@tmo/shared/constants`: shared constants.
- `@tmo/shared/dto`: shared DTOs like `ApiError`, `PagedResponse`, and `MoneyFen`.
- `@tmo/shared/enums`: shared enums like `Platform`.
- `@tmo/shared/validators`: string/number validators (including `isMoneyFen`).

## Example

```ts
import { Platform } from '@tmo/shared/enums'
import { isNonEmptyString } from '@tmo/shared/validators'

const platform = Platform.Weapp
const ok = isNonEmptyString(platform)
```

## Product specifications

Import specification helpers from `@tmo/shared`. Product `filterDimensions` stores one to three ordered names; SKU `attributes` stores each named value and may retain unrelated attributes. `formatSkuSpec` produces the complete value path (`钢 / 30mm / M8`). Always pass the original dimensions: an empty array denotes a legacy single-level SKU whose value is `spec`, falling back to `name`.

- `validateProductSpecs` validates dimension names and active SKU completeness/uniqueness; disabled historical rows may retain their old structure.
- `getPurchasableSpecSkus` filters inactive or incompletely specified rows without truncating invalid dimension lists.
- `getSpecLevelOptions`, `selectSpecValue` and `findSkuBySpecSelection` implement ordered selection; changing an earlier value clears later choices.

The miniapp Jest suite exercises these shared helpers through `src/components/spec-selector/index.test.tsx`; run `pnpm --filter miniapp test` from the repository root.
