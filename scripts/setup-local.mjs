import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (!existsSync('.dev.vars')) {
  writeFileSync('.dev.vars', `TOKEN_ENCRYPTION_KEY=${randomBytes(32).toString('hex')}\n`, {
    mode: 0o600,
  });
  console.log('Created local encryption key in ignored .dev.vars.');
} else console.log('Preserved existing local encryption key.');
