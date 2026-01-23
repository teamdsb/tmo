import { defineConfig } from 'orval'

export default defineConfig({
  commerce: {
    input: '../../contracts/openapi/commerce.yaml',
    output: {
      mode: 'single',
      target: './src/generated/commerce.ts',
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
