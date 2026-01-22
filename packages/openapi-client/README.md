# openapi-client

Shared utilities for OpenAPI client generation and consumption.

## Example

```ts
import { buildUrl, createClient } from '@tmo/openapi-client'

const client = createClient({
  baseUrl: 'http://localhost:8080',
  requester: async (options) => {
    console.log('request', options)
    throw new Error('requester not configured')
  }
})

const healthUrl = buildUrl('http://localhost:8080', '/health')
console.log(client, healthUrl)
```
