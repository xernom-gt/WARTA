import ScrollPositionIndicator from './components/common/ScrollPositionIndicator';
import FeaturedProjectsSection from './components/landing/FeaturedProjectsSection';
import HeroSection from './components/landing/HeroSection';
import InteractiveConsensusDemo from './components/landing/InteractiveConsensusDemo';
import LandingFooter from './components/landing/LandingFooter';
import LandingNavbar from './components/landing/LandingNavbar';
import PrivacyFaqSection from './components/landing/PrivacyFaqSection';
import ProblemHighlightSection from './components/landing/ProblemHighlightSection';
import WorkflowSection from './components/landing/WorkflowSection';

const APP_URL = import.meta.env.VITE_APP_URL ?? 'http://localhost:5173';

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <LandingNavbar appUrl={APP_URL} />
      <main className="flex flex-1 flex-col">
        <HeroSection appUrl={APP_URL} />
        <ProblemHighlightSection />
        <WorkflowSection />
        <FeaturedProjectsSection />
        <InteractiveConsensusDemo />
        <PrivacyFaqSection />
      </main>
      <LandingFooter appUrl={APP_URL} />
      <ScrollPositionIndicator />
    </div>
  );
}
