import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SubmissionPage from './pages/SubmissionPage';
import ReviewDashboardPage from './pages/ReviewDashboardPage';
import HistoryPage from './pages/HistoryPage';
import ComponentPreview from './views/ComponentPreview';

function App() {
  const [backendStatus, setBackendStatus] = useState(null);
  const [backendLoading, setBackendLoading] = useState(false);

  const checkBackendHealth = async () => {
    setBackendLoading(true);
    try {
      const response = await fetch('/api/v1/health');
      const data = await response.json();
      setBackendStatus(data);
    } catch (err) {
      setBackendStatus({ status: 'offline', error: err.message });
    } finally {
      setBackendLoading(false);
    }
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/submit" element={<SubmissionPage />} />
        <Route path="/review/:id" element={<ReviewDashboardPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route
          path="/preview"
          element={
            <ComponentPreview
              onProbeBackend={checkBackendHealth}
              backendStatus={backendStatus}
              backendLoading={backendLoading}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
