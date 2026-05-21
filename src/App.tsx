import '@/lib/sentry';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import ReiseplanungPage from '@/pages/ReiseplanungPage';
import AusgabenkategorienPage from '@/pages/AusgabenkategorienPage';
import BudgetpostenPage from '@/pages/BudgetpostenPage';
import PublicFormReiseplanung from '@/pages/public/PublicForm_Reiseplanung';
import PublicFormAusgabenkategorien from '@/pages/public/PublicForm_Ausgabenkategorien';
import PublicFormBudgetposten from '@/pages/public/PublicForm_Budgetposten';
// <public:imports>
// </public:imports>
// <custom:imports>
const ReisePlanenPage = lazy(() => import('@/pages/intents/ReisePlanenPage'));
const ReiseAbrechnungPage = lazy(() => import('@/pages/intents/ReiseAbrechnungPage'));
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/6a0f4fcdec66e03d639ee8a3" element={<PublicFormReiseplanung />} />
              <Route path="public/6a0f4fd4d37bb65dc3e2470c" element={<PublicFormAusgabenkategorien />} />
              <Route path="public/6a0f4fd5f913a3aa3d026472" element={<PublicFormBudgetposten />} />
              {/* <public:routes> */}
              {/* </public:routes> */}
              <Route element={<Layout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="reiseplanung" element={<ReiseplanungPage />} />
                <Route path="ausgabenkategorien" element={<AusgabenkategorienPage />} />
                <Route path="budgetposten" element={<BudgetpostenPage />} />
                <Route path="admin" element={<AdminPage />} />
                {/* <custom:routes> */}
                <Route path="intents/reise-planen" element={<Suspense fallback={null}><ReisePlanenPage /></Suspense>} />
                <Route path="intents/reise-abrechnung" element={<Suspense fallback={null}><ReiseAbrechnungPage /></Suspense>} />
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
