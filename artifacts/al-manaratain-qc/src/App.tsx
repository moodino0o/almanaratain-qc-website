import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

import { Layout } from '@/components/layout';
import Home from '@/pages/home';
import Records from '@/pages/records';
import RecordForm from '@/pages/record-form';
import RecordDetail from '@/pages/record-detail';
import Reports from '@/pages/reports';
import ReportPrint from '@/pages/report-print';
import Settings from '@/pages/settings';
import Archive from '@/pages/archive';

const queryClient = new QueryClient();

function PrintLayout({ children }: { children: ReactNode }) {
  return <div className="print-layout-container min-h-screen bg-background">{children}</div>;
}

function Router() {
  const [location] = useLocation();
  const isPrint = location.match(/^\/reports\/\d+$/);

  return (
    <RoutedErrorBoundary>
      {isPrint ? (
        <PrintLayout>
          <Switch>
            <Route path="/reports/:id" component={ReportPrint} />
            <Route component={NotFound} />
          </Switch>
        </PrintLayout>
      ) : (
        <Layout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/records" component={Records} />
            <Route path="/records/new" component={RecordForm} />
            <Route path="/records/:id" component={RecordDetail} />
            <Route path="/reports" component={Reports} />
            <Route path="/settings" component={Settings} />
            <Route path="/archive" component={Archive} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      )}
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, '') || ''}>
          <Router />
        </WouterRouter>
        <Toaster position="bottom-right" richColors />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
