import { useEffect, useState } from 'react'

function App() {
  const [apiStatus, setApiStatus] = useState('Checking the API…')

  useEffect(() => {
    fetch('/api/health')
      .then((response) => {
        if (!response.ok) throw new Error('The API returned an error.')
        return response.json()
      })
      .then((data) => setApiStatus(data.message))
      .catch(() => setApiStatus('API unavailable. Start the server and try again.'))
  }, [])

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Knowledge Inbox home">
          <span className="wordmark-icon" aria-hidden="true">K</span>
          <span>knowledge inbox</span>
        </a>
        <span className="stage-label">YOUR PRIVATE LIBRARY</span>
      </header>

      <section className="welcome-card" aria-labelledby="welcome-title">
        <p className="eyebrow">A LITTLE SPACE FOR BIG IDEAS</p>
        <h1 id="welcome-title">Keep what<br />you learn.</h1>
        <p className="welcome-copy">
          Save useful notes and pages. Ask a question when you’re ready to
          connect the dots.
        </p>
        <div className="coming-soon" aria-live="polite">
          <span className="status-dot" />
          <span>{apiStatus}</span>
        </div>
      </section>

      <footer className="page-footer">
        <span>CAPTURE NOW. MAKE SENSE LATER.</span>
        <span>01 / JUST GETTING STARTED</span>
      </footer>
    </main>
  )
}

export default App
