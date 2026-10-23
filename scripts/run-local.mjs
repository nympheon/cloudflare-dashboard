import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const [tool, ...args] = process.argv.slice(2);
const bins = {
  vite: 'vite/bin/vite.js',
  wrangler: 'wrangler/bin/wrangler.js',
  vitest: 'vitest/vitest.mjs',
  tsx: 'tsx/dist/cli.mjs',
};
if (!bins[tool]) throw new Error('Unknown local tool');
const child = spawn(process.execPath, [resolve('node_modules', bins[tool]), ...args], {
  stdio: 'inherit',
  env: {
    ...process.env,
    MINIFLARE_REGISTRY_PATH: resolve('.wrangler/registry'),
    WRANGLER_REGISTRY_PATH: resolve('.wrangler/registry'),
    WRANGLER_LOG_PATH: resolve('.wrangler/logs/runtime.log'),
    WRANGLER_SEND_METRICS: 'false',
  },
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
