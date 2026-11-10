import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import NewScan from './pages/NewScan';
import ScanResults from './pages/ScanResults';
import ScanHistory from './pages/ScanHistory';
import Settings from './pages/Settings';
import Help from './pages/Help';
import QAAgent from './pages/QAAgent';
import QAReport from './pages/QAReport';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="scan" element={<NewScan />} />
            <Route path="results/:scanId" element={<ScanResults />} />
            <Route path="history" element={<ScanHistory />} />
            <Route path="qa-agent" element={<QAAgent />} />
            <Route path="qa-report/:sessionId" element={<QAReport />} />
            <Route path="settings" element={<Settings />} />
            <Route path="help" element={<Help />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
