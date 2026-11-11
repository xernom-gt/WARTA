import { useEffect } from 'react';
import { WartaProvider, useWarta } from './context/WartaContext';
import { SAMPLE_DATA } from './data/wartaData';
import ScrollPositionIndicator from './components/common/ScrollPositionIndicator';
import DevSimulatorBar from './components/layout/DevSimulatorBar';
import Footer from './components/layout/Footer';
import Header from './components/layout/Header';
import ProjectDetailModal from './components/project/ProjectDetailModal';
import ProjectEditModal from './components/project/ProjectEditModal';
import AdminDashboardView from './components/views/AdminDashboardView';
import AdminProjectsView from './components/views/AdminProjectsView';
import MapExplorerView from './components/views/MapExplorerView';
import VerificationQueueView from './components/views/VerificationQueueView';

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

export default function App() {
  return (
    <WartaProvider>
      <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
        <Header />
        {SAMPLE_DATA && <DevSimulatorBar />}
        <main className="flex flex-1 flex-col">
          <Screen />
        </main>
        <Footer />
        <ProjectDetailModal />
        <ProjectEditModal />
        <ScrollPositionIndicator />
      </div>
    </WartaProvider>
  );
}
