import {
  Code2,
  Hammer,
  Database,
  Layers,
  Box,
  Cylinder,
  ListTree,
  Workflow,
  Container,
  Zap,
  Network,
  GitBranch,
  ChartNoAxesCombined,
  KeyRound,
  Package,
  Braces,
  Blocks,
  BrainCircuit,
  Search,
  Waypoints,
  Globe,
  ScanSearch,
  Mail,
  Image,
  Video,
  Radio,
  Globe2,
  Shield,
  BookOpen,
  Receipt,
  type LucideIcon,
} from 'lucide-react';
import type { Product } from '../../../shared/dashboard';
const icons: Record<string, LucideIcon> = {
  Code2,
  Hammer,
  Database,
  Layers,
  Box,
  Cylinder,
  ListTree,
  Workflow,
  Container,
  Zap,
  Network,
  GitBranch,
  ChartNoAxesCombined,
  KeyRound,
  Package,
  Braces,
  Blocks,
  BrainCircuit,
  Search,
  Waypoints,
  Globe,
  ScanSearch,
  Mail,
  Image,
  Video,
  Radio,
  Globe2,
  Shield,
  BookOpen,
  Receipt,
};
export function ProductIcon({ product, small = false }: { product: Product; small?: boolean }) {
  const Icon = icons[product.icon] ?? Box;
  return (
    <span
      className={`product-icon ${small ? 'small' : ''}`}
      style={{ color: product.color, background: `${product.color}0e` }}
    >
      <Icon size={small ? 17 : 22} strokeWidth={1.8} />
    </span>
  );
}
