# commerce-services

Thin business-logic layer for the miniapp. Wraps the generated API client and adds
idempotency key management, upload helpers, and error normalization.

## Example

```ts
import { createCommerceServices } from '@tmo/commerce-services'

const services = createCommerceServices({
  baseUrl: process.env.TARO_APP_COMMERCE_BASE_URL ?? '',
  devToken: process.env.TARO_APP_COMMERCE_DEV_TOKEN
})

services.catalog.listCategories().then((data) => {
  console.log(data.items)
})
```

## Notes

- Order submit uses an in-memory idempotency key; call `orders.resetIdempotency()` when draft changes.
- Excel imports use `chooseExcelFile()` and `upload...Excel()` helpers.
