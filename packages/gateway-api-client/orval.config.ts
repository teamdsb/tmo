import { defineConfig } from 'orval'

export default defineConfig({
  gateway: {
    input: '../../contracts/openapi/gateway.yaml',
    output: {
      mode: 'single',
      target: './src/generated/gateway.ts',
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
