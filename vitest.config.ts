import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@shared': resolve('src/shared'), electron: resolve('tests/electron-stub.ts') } },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 30000 }
})
