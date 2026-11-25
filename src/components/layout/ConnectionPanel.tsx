import { ArrowRight, Cloud } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';

export function ConnectionPanel({ title, loading }: { title: string; loading: boolean }) {
  return (
    <>
      <div className="page-heading">
        <h1>{title}</h1>
      </div>
      <section className="connect-panel" aria-busy={loading}>
        <span className="connect-cloud">
          <Cloud size={34} />
        </span>
        <h2>{loading ? '正在连接工作空间' : '连接你的账户'}</h2>
        <p>
          {loading
            ? '正在读取配置与最近一次用量。'
            : '保存只读 Token 后，即可查看当前账期的用量、额度和费用。'}
        </p>
        <Button asChild>
          <Link to="/settings">
            配置 API Token <ArrowRight size={16} />
          </Link>
        </Button>
        {import.meta.env.DEV && (
          <Link className="text-link" to="/?demo=normal" reloadDocument>
            查看演示
          </Link>
        )}
      </section>
    </>
  );
}
