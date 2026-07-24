import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { BlockchainFooter } from './components/BlockchainFooter';
import { HomePage } from './pages/HomePage';
import { AppDashboardPage } from './pages/AppDashboardPage';
import { NewJobPage } from './pages/NewJobPage';
import { JobDetailPage } from './pages/JobDetailPage';
import { ProtocolPage } from './pages/ProtocolPage';
import { EcosystemPage } from './pages/EcosystemPage';
import { DevelopersPage } from './pages/DevelopersPage';
import { GiwaIdPage } from './pages/GiwaIdPage';
import { DocsPage } from './pages/DocsPage';
import { PlaceholderPage } from './components/PlaceholderPage';

export function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#030712] text-white flex flex-col">
        <Navbar />

        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/protocol" element={<ProtocolPage />} />
            <Route path="/ecosystem" element={<EcosystemPage />} />
            <Route path="/developers" element={<DevelopersPage />} />
            <Route path="/giwa-id" element={<GiwaIdPage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route
              path="/app"
              element={<AppDashboardPage />}
            />
            <Route path="/app/jobs/new" element={<NewJobPage />} />
            <Route path="/app/jobs/:address" element={<JobDetailPage />} />
            <Route
              path="*"
              element={
                <PlaceholderPage
                  title="404 — Not Found"
                  description="This page doesn't exist on-chain or off. Head back home."
                  icon="🔍"
                  color="#ef4444"
                />
              }
            />
          </Routes>
        </main>

        <Footer />
        <BlockchainFooter />
      </div>
    </BrowserRouter>
  );
}
