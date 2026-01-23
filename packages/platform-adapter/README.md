# platform-adapter

Unified wrapper for wx/my differences (login, request, pay, chooseImage, chooseFile, uploadFile, storage).

## Example

```ts
import { getPlatform, login } from '@tmo/platform-adapter'

const platform = getPlatform()
console.log('platform', platform)

login().then(console.log).catch(console.error)
```
