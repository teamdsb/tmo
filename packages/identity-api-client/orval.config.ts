import { defineConfig } from 'orval'

export default defineConfig({
  identity: {
    input: '../../contracts/openapi/identity.yaml',
    output: {
      mode: 'single',
      target: './src/generated/identity.ts',
      client: 'fetch',
      clean: true,
      prettier: false,
      override: {
        mutator: {
          path: './src/runtime.ts',
          name: 'apiMutator'
        }
      }
    }
  }
})
