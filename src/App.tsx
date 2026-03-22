import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import RecoverAccount from './pages/RecoverAccount';
import InitialBalance from './pages/InitialBalance';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { auth } from './config/firebaseConfig';
import { signOut } from 'firebase/auth';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { logAction } from './utils/audit';
import FirebaseStatus from './components/FirebaseStatus';

// Lazy load modular components
const DashboardComponent = lazy(() => import('./components/dashboard/DashboardComponent'));
const MovimentacoesComponent = lazy(() => import('./components/movimentacoes/MovimentacoesComponent'));
const EventosComponent = lazy(() => import('./components/eventos/EventosComponent'));
const ProdutosComponent = lazy(() => import('./components/produtos/ProdutosComponent'));
const SimuladorEventosComponent = lazy(() => import('./components/simulador/SimuladorEventosComponent'));
const AuditoriaComponent = lazy(() => import('./components/auditoria/AuditoriaComponent'));
const ExtratosComponent = lazy(() => import('./components/extratos/ExtratosComponent'));
const PatrocinioComponent = lazy(() => import('./components/patrocinio/PatrocinioComponent'));
const CategoriasComponent = lazy(() => import('./components/categorias/CategoriasComponent'));
const NovaVendaComponent = lazy(() => import('./components/vendas/NovaVendaComponent'));
const ControleFinanceiroComponent = lazy(() => import('./components/financeiro/ControleFinanceiroComponent'));

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <Loader2 className="animate-spin text-primary" size={48} />
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, settings, isAdmin, isOtherDirectorate, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  // 1. Check Authentication
  if (!user) return <Navigate to="/login" />;

  // 2. Check Permissions
  if (profile && profile.setupCompleto) {
    // Check Initial Balance Setup for finance directors
    if (isAdmin && !settings && location.pathname !== '/configuracao-inicial') {
      return <Navigate to="/configuracao-inicial" />;
    }
    return <>{children}</>;
  }

  // 3. Check Profile Completion
  if (!profile || !profile.setupCompleto) return <Navigate to="/register" />;

  // 4. Block access for non-admins (Membros)
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="glass-card p-8 max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-4 bg-danger/10 rounded-full text-danger">
            <ShieldAlert size={48} />
          </div>
        </div>
        <h2 className="text-2xl font-bold">Acesso Restrito</h2>
        <p className="text-gray-500">
          Acesso restrito à diretoria. Entre em contato com um administrador para solicitar permissão.
        </p>
        <button onClick={() => signOut(auth)} className="btn-primary w-full justify-center">
          Sair da Conta
        </button>
      </div>
    </div>
  );
};

const AuditWrapper = ({ children }: { children: React.ReactNode }) => {
  const { profile } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (profile) {
      logAction(profile.nome, 'Visualizou página', 'Sistema', location.pathname);
    }
  }, [location.pathname, profile]);

  return <>{children}</>;
};

const FinanceDirectorRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin, loading } = useAuth();

  if (loading) return null;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="glass-card p-8 max-w-md text-center space-y-6">
          <div className="flex justify-center">
            <div className="p-4 bg-danger/10 rounded-full text-danger">
              <ShieldAlert size={48} />
            </div>
          </div>
          <h2 className="text-2xl font-bold">Acesso Restrito</h2>
          <p className="text-gray-500">
            Esta área é restrita à Diretoria Financeira.
          </p>
          <Navigate to="/" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <FirebaseStatus />
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/recover" element={<RecoverAccount />} />

          {/* Setup Route */}
          <Route path="/configuracao-inicial" element={
            <ProtectedRoute>
              <InitialBalance />
            </ProtectedRoute>
          } />

          {/* Protected App Routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <AuditWrapper>
                <Layout />
              </AuditWrapper>
            </ProtectedRoute>
          }>
            <Route index element={
              <Suspense fallback={<LoadingFallback />}>
                <DashboardComponent />
              </Suspense>
            } />
            <Route path="movimentacoes" element={
              <Suspense fallback={<LoadingFallback />}>
                <MovimentacoesComponent />
              </Suspense>
            } />
            <Route path="eventos" element={
              <Suspense fallback={<LoadingFallback />}>
                <EventosComponent />
              </Suspense>
            } />
            <Route path="loja" element={
              <Suspense fallback={<LoadingFallback />}>
                <ProdutosComponent />
              </Suspense>
            } />
            <Route path="simulador" element={
              <Suspense fallback={<LoadingFallback />}>
                <SimuladorEventosComponent />
              </Suspense>
            } />
            <Route path="auditoria" element={
              <Suspense fallback={<LoadingFallback />}>
                <AuditoriaComponent />
              </Suspense>
            } />
            <Route path="extratos" element={
              <Suspense fallback={<LoadingFallback />}>
                <ExtratosComponent />
              </Suspense>
            } />
            <Route path="patrocinios" element={
              <Suspense fallback={<LoadingFallback />}>
                <PatrocinioComponent />
              </Suspense>
            } />
            <Route path="categorias" element={
              <Suspense fallback={<LoadingFallback />}>
                <CategoriasComponent />
              </Suspense>
            } />
            <Route path="controle-financeiro" element={
              <Suspense fallback={<LoadingFallback />}>
                <FinanceDirectorRoute>
                  <ControleFinanceiroComponent />
                </FinanceDirectorRoute>
              </Suspense>
            } />
            <Route path="nova-venda" element={
              <Suspense fallback={<LoadingFallback />}>
                <NovaVendaComponent />
              </Suspense>
            } />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
