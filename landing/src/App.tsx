import CitizenLoginModal from './components/common/CitizenLoginModal';
import ScrollPositionIndicator from './components/common/ScrollPositionIndicator';
import CitizenFooter from './components/layout/CitizenFooter';
import CitizenHeader from './components/layout/CitizenHeader';
import ProjectDetailModal from './components/project/ProjectDetailModal';
import CitizenAccountView from './components/views/CitizenAccountView';
import CitizenReportFormView from './components/views/CitizenReportFormView';
import ExploreProjectsView from './components/views/ExploreProjectsView';
import PublicReportsFeedView from './components/views/PublicReportsFeedView';
import { WartaProvider, useWarta } from './context/WartaContext';

function CitizenScreen() {
  const { activeScreen, editingDraftId } = useWarta();

  switch (activeScreen) {
    case 'aduan':
    case 'verifikasi':
      return <PublicReportsFeedView />;
    case 'lapor':
    case 'klaim':
      return <CitizenReportFormView key={editingDraftId ?? 'new'} />;
    case 'profil':
      return <CitizenAccountView />;
    default:
      // 'peta' & 'detail' (modal detail terbuka di atas tampilan jelajah proyek)
      return <ExploreProjectsView />;
  }
}

export default function App() {
  return (
    <WartaProvider>
      <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
        <CitizenHeader />
        <main className="flex flex-1 flex-col">
          <CitizenScreen />
        </main>
        <CitizenFooter />
        <ProjectDetailModal />
        <CitizenLoginModal />
        <ScrollPositionIndicator />
      </div>
    </WartaProvider>
  );
}
