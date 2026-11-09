import { WartaProvider, useWarta } from './context/WartaContext';
import { SAMPLE_DATA } from './data/wartaData';
import CitizenLoginModal from './components/common/CitizenLoginModal';
import ScrollPositionIndicator from './components/common/ScrollPositionIndicator';
import DevSimulatorBar from './components/layout/DevSimulatorBar';
import Footer from './components/layout/Footer';
import Header from './components/layout/Header';
import ProjectDetailModal from './components/project/ProjectDetailModal';
import CitizenProfileView from './components/views/CitizenProfileView';
import ClaimLocationView from './components/views/ClaimLocationView';
import MapExplorerView from './components/views/MapExplorerView';
import ReportFormView from './components/views/ReportFormView';
import VerificationQueueView from './components/views/VerificationQueueView';

function Screen() {
  const { activeScreen } = useWarta();
  switch (activeScreen) {
    case 'lapor':
      return <ReportFormView />;
    case 'klaim':
      return <ClaimLocationView />;
    case 'peta':
    case 'detail':
      return <MapExplorerView />;
    case 'profil':
      return <CitizenProfileView />;
    default:
      return <VerificationQueueView />;
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
        <CitizenLoginModal />
        <ScrollPositionIndicator />
      </div>
    </WartaProvider>
  );
}
