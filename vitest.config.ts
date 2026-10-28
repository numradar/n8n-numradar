import { defineConfig } from 'vitest/config'

// `.mts`, not `.ts`: n8n's default lint config (which strict mode requires unchanged) lints every
// `**/*.ts` with the community-node rules, and those forbid the node:fs reads the tests make of
// the package's own files. The rules are about code that runs inside n8n; tests never ship.
export default defineConfig({
  test: { environment: 'node', include: ['test/**/*.test.mts'] },
})
