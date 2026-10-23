import { parse } from 'lossless-json';
import type { Json } from './json';
import { arr, obj, text } from './json';
export class SourceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export class CloudflareReadClient {
  calls = 0;
  constructor(
    private token: string,
    private transport: typeof fetch = fetch,
  ) {}
  private async request(path: string, query?: string): Promise<Record<string, Json>> {
    this.calls++;
    let response: Response;
    const transport = this.transport;
    try {
      response = await transport(`https://api.cloudflare.com/client/v4${path}`, {
        method: query ? 'POST' : 'GET',
        headers: {
          Authorization: `Bearer ${this.token}`,
          ...(query ? { 'Content-Type': 'application/json' } : {}),
        },
        body: query ? JSON.stringify({ query }) : undefined,
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new SourceError(0, '网络读取失败或超时，请稍后手动刷新');
    }
    if (!response.ok)
      throw new SourceError(
        response.status,
        response.status === 403
          ? '来源访问受限，请检查 Token 权限或账户开放范围'
          : response.status === 401
            ? 'Token 验证失败'
            : response.status === 429
              ? '来源请求频率受限，请稍后手动刷新'
              : `来源读取失败（HTTP ${response.status}）`,
      );
    const reader = response.body?.getReader();
    if (!reader) throw new SourceError(0, '来源没有返回内容');
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 5 * 1024 * 1024) {
        await reader.cancel();
        throw new SourceError(0, '来源响应过大，未作完整读取');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.length;
    }
    let data: Record<string, Json>;
    try {
      data = obj(parse(new TextDecoder().decode(bytes), undefined, (v: string) => v));
    } catch {
      throw new SourceError(0, '来源返回了无法解析的响应');
    }
    if (data.success === false || arr(data.errors).length) {
      const detail = text(obj(arr(data.errors)[0]).message)
        .replaceAll(this.token, '[redacted]')
        .slice(0, 220);
      throw new SourceError(
        /permission|not authorized|unauthorized|does not have access|access denied/i.test(detail)
          ? 403
          : 0,
        '来源返回错误' + (detail ? '：' + detail : '，未把不完整响应计为零'),
      );
    }
    return data;
  }
  async get(path: string, envelope = false): Promise<Json> {
    if (!path.startsWith('/accounts') && !path.startsWith('/user/') && !path.startsWith('/zones'))
      throw new Error('不允许的只读来源路径');
    const data = await this.request(path);
    return envelope ? data : 'result' in data ? data.result : data;
  }
  async list(path: string): Promise<Json[]> {
    const values: Json[] = [];
    for (let page = 1; page <= 30; page++) {
      const d = await this.request(
        `${path}${path.includes('?') ? '&' : '?'}per_page=50&page=${page}`,
      );
      if (!Array.isArray(d.result)) throw new SourceError(0, '资源列表响应不完整');
      values.push(...d.result);
      const info = obj(d.result_info);
      const total = Number(info.total_pages) || Math.ceil(Number(info.total_count) / 50);
      if ((total && page >= total) || (!total && d.result.length < 50)) return values;
    }
    throw new SourceError(0, '资源分页超出范围，未把截断列表计为完整');
  }
  async query(query: string): Promise<Record<string, Json>> {
    if (!query.trim().startsWith('query') && !query.trim().startsWith('{'))
      throw new Error('仅允许 GraphQL 读取查询');
    if (/\bmutation\b/.test(query)) throw new Error('不允许修改查询');
    const response = await this.request('/graphql', query);
    if (!response.data) throw new SourceError(0, '统计响应缺少 data');
    return obj(response.data);
  }
  async account() {
    const accounts = await this.list('/accounts');
    if (accounts.length !== 1) throw new SourceError(0, 'Token 必须只能访问一个目标账户');
    const account = obj(accounts[0]);
    const id = text(account.id);
    if (!/^[a-f0-9]{32}$/.test(id)) throw new SourceError(0, '账户信息不完整');
    return { id, name: text(account.name) || 'Cloudflare 账户' };
  }
}
