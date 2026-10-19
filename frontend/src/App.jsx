import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SubmissionPage from './pages/SubmissionPage';
import ReviewDashboardPage from './pages/ReviewDashboardPage';
import HistoryPage from './pages/HistoryPage';
import ComponentPreview from './views/ComponentPreview';
import { ErrorBoundary } from './components/common';

import { API_BASE_URL } from './config/api';

function App() {
  const [backendStatus, setBackendStatus] = useState(null);
  const [backendLoading, setBackendLoading] = useState(false);

  const checkBackendHealth = async () => {
    setBackendLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/health`);
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
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/submit"
            element={
              <ErrorBoundary>
                <SubmissionPage />
              </ErrorBoundary>
            }
          />
          <Route
            path="/review/:id"
            element={
              <ErrorBoundary>
                <ReviewDashboardPage />
              </ErrorBoundary>
            }
          />
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
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
