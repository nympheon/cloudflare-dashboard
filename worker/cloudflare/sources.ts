import type { TokenKind } from '../../shared/dashboard';
import { CloudflareReadClient, SourceError } from './client';
import type { Json } from './json';
export class ReadSources {
  constructor(private clients: Partial<Record<TokenKind, CloudflareReadClient>>) {}
  private async read<T>(
    preferred: TokenKind,
    fn: (client: CloudflareReadClient) => Promise<T>,
  ): Promise<T> {
    const other = preferred === 'user' ? 'account' : 'user',
      first = this.clients[preferred] ?? this.clients[other],
      second = this.clients[preferred] ? this.clients[other] : undefined;
    if (!first) throw new Error('尚未配置 Token');
    try {
      return await fn(first);
    } catch (e) {
      if (second && e instanceof SourceError && (e.status === 401 || e.status === 403))
        return fn(second);
      throw e;
    }
  }
  private preferred(path: string): TokenKind {
    return /\/builds\/|\/billable|\/subscriptions|\/observability\//.test(path)
      ? 'user'
      : 'account';
  }
  get(path: string, envelope = false): Promise<Json> {
    return this.read(this.preferred(path), (client) => client.get(path, envelope));
  }
  list(path: string): Promise<Json[]> {
    return this.read(this.preferred(path), (client) => client.list(path));
  }
  query(query: string, preferred: TokenKind = 'account') {
    return this.read(preferred, (client) => client.query(query));
  }
}
