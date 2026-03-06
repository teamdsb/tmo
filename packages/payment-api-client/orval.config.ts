import { defineConfig } from 'orval'

export default defineConfig({
  payment: {
    input: '../../contracts/openapi/payment.yaml',
    output: {
      mode: 'single',
      target: './src/generated/payment.ts',
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
