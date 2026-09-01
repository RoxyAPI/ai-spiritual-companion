import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node' },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` throws when imported outside a server bundle, so every module behind the API
      // boundary would fail to load under the test runner. Aliasing it to a no-op is the sanctioned
      // workaround and it changes nothing about how the module behaves in the application.
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
});
