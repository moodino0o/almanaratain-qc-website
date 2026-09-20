import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@workspace/replit-auth-web';
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
import Standards from '@/pages/standards';
import Archive from '@/pages/archive';
import Login from '@/pages/login';
import Complaints from '@/pages/complaints';
import ComplaintForm from '@/pages/complaint-form';
import ComplaintDetail from '@/pages/complaint-detail';
import ComplaintPrint from '@/pages/complaint-print';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

const queryClient = new QueryClient();

function PrintLayout({ children }: { children: ReactNode }) {
  return <div className="print-layout-container min-h-screen bg-background">{children}</div>;
}

function Router() {
  const [location] = useLocation();
  const { role } = useAuth();
  const canViewComplaints = role !== "technician";
  const isPrint = location.match(/^\/reports\/\d+$/) || (canViewComplaints && location.match(/^\/complaints\/\d+\/print$/));

  return (
    <RoutedErrorBoundary>
      {isPrint ? (
        <PrintLayout>
          <Switch>
            <Route path="/reports/:id" component={ReportPrint} />
            <Route path="/complaints/:id/print" component={ComplaintPrint} />
            <Route component={NotFound} />
          </Switch>
        </PrintLayout>
      ) : (
        <Layout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/records" component={Records} />
            <Route path="/records/new" component={RecordForm} />
            <Route path="/records/:id/edit" component={RecordForm} />
            <Route path="/records/:id" component={RecordDetail} />
            {canViewComplaints && <Route path="/complaints" component={Complaints} />}
            {canViewComplaints && <Route path="/complaints/new" component={ComplaintForm} />}
            {canViewComplaints && <Route path="/complaints/:id/edit" component={ComplaintForm} />}
            {canViewComplaints && <Route path="/complaints/:id" component={ComplaintDetail} />}
            <Route path="/reports" component={Reports} />
            <Route path="/settings" component={Settings} />
            <Route path="/standards" component={Standards} />
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

function AccessDenied({
  email,
  onLogout,
}: {
  email: string | null | undefined;
  onLogout: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm sm:p-10">
        <img
          src="/al-manaratain-logo.webp"
          alt="Al Manaratain"
          className="mx-auto mb-8 h-12 object-contain"
        />
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-7 w-7" aria-hidden="true" />
        </div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-destructive">
          Access denied
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Employee access has not been approved
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {email ? `${email} is authenticated, but it is not on the active QC employee access list.` : 'Your account is authenticated, but it is not on the active QC employee access list.'}
          {' '}Contact a QC administrator to request access.
        </p>
        <Button className="mt-8 w-full" variant="outline" onClick={onLogout}>
          Log out
        </Button>
      </section>
    </main>
  );
}
function App() {
  const auth = useAuth();
  async function loginWithEmployeeId(employeeId: string, password: string): Promise<string | null> {
    try {
      const response = await fetch("/api/employee-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ employeeId, password }),
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        return body?.error ?? "Unable to log in with that employee ID.";
      }
      window.location.reload();
      return null;
    } catch {
      return "Unable to reach the login service. Please try again.";
    }
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, '') || ''}>
          {auth.isLoading ? (
            <div className="flex min-h-screen items-center justify-center bg-muted/30 text-sm text-muted-foreground">
              Checking employee access…
            </div>
          ) : auth.isAuthenticated && auth.isAccessDenied ? (
            <AccessDenied email={auth.user?.email} onLogout={auth.logout} />
          ) : auth.isAuthenticated ? (
            <Router />
          ) : (
            <Login onLogin={loginWithEmployeeId} />
          )}
        </WouterRouter>
        <Toaster position="bottom-right" richColors />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
