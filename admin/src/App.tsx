import { useEffect } from 'react';
import { WartaProvider, useWarta } from './context/WartaContext';
import { SAMPLE_DATA } from './data/wartaData';
import DevSimulatorBar from './components/layout/DevSimulatorBar';
import Footer from './components/layout/Footer';
import Header from './components/layout/Header';
import ProjectDetailModal from './components/project/ProjectDetailModal';
import ProjectEditModal from './components/project/ProjectEditModal';
import AdminDashboardView from './components/views/AdminDashboardView';
import AdminProjectsView from './components/views/AdminProjectsView';
import MapExplorerView from './components/views/MapExplorerView';
import VerificationQueueView from './components/views/VerificationQueueView';
import AdminLoginView from './components/views/AdminLoginView';

function Screen() {
  const { activeScreen } = useWarta();

  // Reset scroll ke puncak setiap kali berpindah tab
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [activeScreen]);

  switch (activeScreen) {
    case 'aduan':
    case 'verifikasi':
    case 'lapor':
    case 'klaim':
      return <VerificationQueueView />;
    case 'proyek':
      return <AdminProjectsView />;
    case 'peta':
    case 'detail':
      return <MapExplorerView />;
    case 'dashboard':
    default:
      return <AdminDashboardView />;
  }
}

function AdminRoot() {
  const { currentUser, isAuthChecking } = useWarta();

  if (isAuthChecking) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="size-9 animate-spin rounded-full border-3 border-sky-400 border-t-transparent" />
          <p className="text-sm font-semibold text-slate-300">Memverifikasi Sesi Administrator Dinas...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AdminLoginView />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Header />
      {SAMPLE_DATA && <DevSimulatorBar />}
      <main className="flex flex-1 flex-col">
        <Screen />
      </main>
      <Footer />
      <ProjectDetailModal />
      <ProjectEditModal />
    </div>
  );
}

export default function App() {
  return (
    <WartaProvider>
      <AdminRoot />
    </WartaProvider>
  );
}
