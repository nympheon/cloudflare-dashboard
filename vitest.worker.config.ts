import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-plugin';
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      remoteBindings: false,
      miniflare: { bindings: { TOKEN_ENCRYPTION_KEY: 'ab'.repeat(32) } },
    }),
  ],
  test: { include: ['tests/worker/**/*.test.ts'] },
});
