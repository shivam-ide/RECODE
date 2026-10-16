import { useState } from 'react'
import './App.css'

function App() {
  const [backendStatus, setBackendStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  const checkBackendHealth = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/v1/health')
      const data = await response.json()
      setBackendStatus(data)
    } catch (err) {
      setBackendStatus({ status: 'offline', error: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="recode-container">
      <header className="recode-header">
        <img src="/Logo.svg" alt="Re:Code Logo" className="recode-logo" />
        <p className="recode-tagline">Automated Code Diagnostics • Static AST Scanner • AI Code Reviews</p>
      </header>

      <main className="recode-card">
        <div className="badge">Module 1 Operational</div>
        <h1>Read. Review. Refine.</h1>
        <p className="description">
          Frontend client successfully initialized with React &amp; Vite. Serving official unmodified <code>/Logo.svg</code>.
        </p>

        <div className="actions">
          <button 
            type="button" 
            className="action-btn"
            onClick={checkBackendHealth}
            disabled={loading}
          >
            {loading ? 'Checking Health...' : 'Probe Backend Health (GET /api/v1/health)'}
          </button>
        </div>

        {backendStatus && (
          <div className="status-box">
            <span className="status-label">Status Response:</span>
            <pre>{JSON.stringify(backendStatus, null, 2)}</pre>
          </div>
        )}
      </main>

      <footer className="recode-footer">
        A College Project By Shivam Vishwakarma
      </footer>
    </div>
  )
}

export default App
