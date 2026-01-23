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
