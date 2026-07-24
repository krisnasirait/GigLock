import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { BlockchainFooter } from './components/BlockchainFooter';
import { HomePage } from './pages/HomePage';
import { AppDashboardPage } from './pages/AppDashboardPage';
import { NewJobPage } from './pages/NewJobPage';
import { JobDetailPage } from './pages/JobDetailPage';
import { PlaceholderPage } from './components/PlaceholderPage';

export function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#030712] text-white flex flex-col">
        <Navbar />

        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route
              path="/protocol"
              element={
                <PlaceholderPage
                  title="Protocol"
                  description="Deep dive into the GigLock protocol — smart contracts, escrow mechanics, and on-chain trust primitives."
                  icon="⚙️"
                  color="#3b82f6"
                />
              }
            />
            <Route
              path="/ecosystem"
              element={
                <PlaceholderPage
                  title="Ecosystem"
                  description="Explore the growing network of platforms and applications building on top of GigLock infrastructure."
                  icon="🌐"
                  color="#10b981"
                />
              }
            />
            <Route
              path="/developers"
              element={
                <PlaceholderPage
                  title="Developers"
                  description="Integrate GigLock into your platform. SDKs, APIs, and smart contract ABIs for every stack."
                  icon="🛠️"
                  color="#f59e0b"
                />
              }
            />
            <Route
              path="/giwa-id"
              element={
                <PlaceholderPage
                  title="GIWA ID"
                  description="Your on-chain identity. Soulbound, portable, and verifiable across every platform in the ecosystem."
                  icon="🪪"
                  color="#8b5cf6"
                />
              }
            />
            <Route
              path="/docs"
              element={
                <PlaceholderPage
                  title="Documentation"
                  description="Everything you need to understand and build with GigLock — guides, references, and tutorials."
                  icon="📚"
                  color="#22d3ee"
                />
              }
            />
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
