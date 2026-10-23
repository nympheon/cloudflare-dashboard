import { Repository, RevisionConflict } from './storage/repository';
import {
  publicSettings,
  saveCredential,
  deleteCredential,
  validateCredential,
} from './settings/service';
import { refreshDashboard, recheckCapabilities } from './refresh';
import { SourceError } from './cloudflare/client';
import type { TokenKind } from '../shared/dashboard';
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      if (request.method !== 'GET') {
        const origin = request.headers.get('Origin');
        if (origin && origin !== url.origin) return json({ error: '仅允许同源请求' }, 403);
        if (request.headers.get('Sec-Fetch-Site') === 'cross-site')
          return json({ error: '仅允许同源请求' }, 403);
        if (Number(request.headers.get('Content-Length') ?? 0) > 4096)
          return json({ error: '请求内容过大' }, 413);
      }
      const repo = new Repository(env.DB),
        ready = /^[a-f\d]{64}$/i.test(env.TOKEN_ENCRYPTION_KEY ?? '');
      if (url.pathname === '/api/bootstrap' && request.method === 'GET') {
        const [s, snapshot] = await Promise.all([repo.settings(), repo.snapshot()]);
        return json({
          settings: publicSettings(s, ready),
          capabilities: s.capabilities,
          snapshot: s.account && snapshot?.account.id === s.account.id ? snapshot : null,
        });
      }
      const match = url.pathname.match(/^\/api\/tokens\/(account|user)(\/validate)?$/);
      if (match) {
        const kind = match[1] as TokenKind;
        if (request.method === 'DELETE' && !match[2])
          return json(await deleteCredential(repo, kind, ready));
        if (request.method === 'PUT' || (request.method === 'POST' && match[2])) {
          if (!request.headers.get('Content-Type')?.startsWith('application/json'))
            return json({ error: '需要 JSON 请求' }, 415);
          const raw = await request.text();
          if (raw.length > 4096) return json({ error: '请求内容过大' }, 413);
          const body = JSON.parse(raw) as { token?: unknown };
          if (typeof body.token !== 'string') return json({ error: '请输入 Token' }, 400);
          if (match[2]) {
            const account = await validateCredential(kind, body.token, await repo.settings());
            return json({ valid: true, account });
          }
          if (!ready) throw new Error('请先配置服务端 TOKEN_ENCRYPTION_KEY');
          return json(await saveCredential(repo, kind, body.token, env.TOKEN_ENCRYPTION_KEY));
        }
      }
      if (url.pathname === '/api/refresh' && request.method === 'POST') {
        const body = (await request.json()) as { reason?: unknown };
        if (body.reason !== 'open' && body.reason !== 'manual')
          return json({ error: '无效刷新原因' }, 400);
        return json(await refreshDashboard(body.reason, env, repo));
      }
      if (url.pathname === '/api/capabilities/recheck' && request.method === 'POST')
        return json(await recheckCapabilities(env, repo));
      return json({ error: '接口不存在' }, 404);
    } catch (e) {
      const known = e instanceof RevisionConflict || e instanceof SourceError;
      const message = e instanceof Error ? e.message : '服务暂时不可用';
      return json(
        {
          error:
            known || /Token|账户|加密|密钥|账期|数据库|配置|同源|能力/.test(message)
              ? message
              : '请求失败，请检查输入后重试',
        },
        e instanceof RevisionConflict ? 409 : 400,
      );
    }
  },
} satisfies ExportedHandler<Env>;
