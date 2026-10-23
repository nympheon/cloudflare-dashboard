import type { PublicSettings, TokenKind } from '../../shared/dashboard';
import { CloudflareReadClient } from '../cloudflare/client';
import { decryptToken, encryptToken } from './crypto';
import { Repository, type StoredSettings } from '../storage/repository';
export function publicSettings(settings: StoredSettings, ready: boolean): PublicSettings {
  const credentials: PublicSettings['credentials'] = {};
  for (const kind of ['account', 'user'] as const) {
    const c = settings.credentials[kind];
    if (c) credentials[kind] = { suffix: c.suffix, verifiedAt: c.verifiedAt };
  }
  return {
    revision: settings.revision,
    account: settings.account,
    credentials,
    encryptionReady: ready,
  };
}
export async function validateCredential(
  kind: TokenKind,
  value: string,
  existing: StoredSettings,
  transport: typeof fetch = fetch,
) {
  if (!/^[A-Za-z\d_-]{20,256}$/.test(value)) throw new Error('请输入有效的 API Token');
  const client = new CloudflareReadClient(value, transport);
  const account = await client.account();
  await client.get(
    kind === 'user' ? '/user/tokens/verify' : `/accounts/${account.id}/tokens/verify`,
  );
  if (existing.account && existing.account.id !== account.id)
    throw new Error('两个 Token 必须对应同一个 Cloudflare 账户，请先清除原账户配置');
  return account;
}
export async function saveCredential(
  repo: Repository,
  kind: TokenKind,
  value: string,
  key: string,
  transport: typeof fetch = fetch,
) {
  const settings = await repo.settings();
  const revision = settings.revision;
  const account = await validateCredential(kind, value, settings, transport);
  settings.account = account;
  settings.credentials[kind] = {
    encrypted: await encryptToken(value, key),
    suffix: value.slice(-4),
    verifiedAt: new Date().toISOString(),
  };
  await repo.saveSettings(settings, revision);
  return publicSettings(settings, true);
}
export async function deleteCredential(repo: Repository, kind: TokenKind, ready: boolean) {
  const settings = await repo.settings();
  const revision = settings.revision;
  delete settings.credentials[kind];
  if (!settings.credentials.account && !settings.credentials.user) {
    settings.account = null;
    settings.capabilities = {};
  }
  await repo.saveSettings(settings, revision);
  return publicSettings(settings, ready);
}
export async function clientsFor(settings: StoredSettings, key: string) {
  const result: Partial<Record<TokenKind, CloudflareReadClient>> = {};
  await Promise.all(
    (['account', 'user'] as const).map(async (kind) => {
      const c = settings.credentials[kind];
      if (c) result[kind] = new CloudflareReadClient(await decryptToken(c.encrypted, key));
    }),
  );
  return result;
}
