import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { DashboardProvider } from './DashboardProvider';
import { Shell } from '../components/layout/Shell';
import { Overview } from '../pages/Overview';
const Product = lazy(() => import('../pages/Product').then((m) => ({ default: m.Product })));
const Settings = lazy(() => import('../pages/Settings').then((m) => ({ default: m.Settings })));
export function App() {
  return (
    <BrowserRouter>
      <DashboardProvider>
        <Suspense fallback={<div className="loading-page">正在加载…</div>}>
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<Overview />} />
              <Route path="products/:productId" element={<Product />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Overview />} />
            </Route>
          </Routes>
        </Suspense>
      </DashboardProvider>
    </BrowserRouter>
  );
}
