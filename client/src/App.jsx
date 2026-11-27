import { useEffect, useState } from 'react'

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function App() {
  const [mode, setMode] = useState('note')
  const [note, setNote] = useState('')
  const [url, setUrl] = useState('')
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [expandedItemId, setExpandedItemId] = useState(null)
  const [chunksByItemId, setChunksByItemId] = useState({})
  const [loadingChunksId, setLoadingChunksId] = useState(null)
  const [chunkError, setChunkError] = useState('')
  const pendingEmbeddingCount = items.reduce(
    (total, item) => total + Math.max(item.chunkCount - (item.embeddedChunkCount || 0), 0),
    0,
  )

  useEffect(() => {
    let isCurrent = true

    fetch('/api/items')
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not load saved items.')
        return data.items
      })
      .then((savedItems) => {
        if (isCurrent) setItems(savedItems)
      })
      .catch((loadError) => {
        if (isCurrent) setError(loadError.message)
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsSaving(true)

    try {
      const payload = mode === 'note'
        ? { type: 'note', content: note }
        : { type: 'url', url }
      const response = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Could not save this item.')

      setItems((currentItems) => [data.item, ...currentItems])
      if (mode === 'note') setNote('')
      else setUrl('')
      setNotice(data.embeddingWarning || (mode === 'note' ? 'Note saved to your library.' : 'Page added to your library.'))
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleGenerateEmbeddings() {
    setError('')
    setNotice('')
    setIsGeneratingEmbeddings(true)

    try {
      const response = await fetch('/api/embeddings/generate', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not generate embeddings.')

      const itemsResponse = await fetch('/api/items')
      const itemsData = await itemsResponse.json()
      if (!itemsResponse.ok) throw new Error(itemsData.error || 'Could not refresh the library.')

      setItems(itemsData.items)
      setChunksByItemId({})
      setNotice(`Generated embeddings for ${data.embeddedChunks} chunks with ${data.model}.`)
    } catch (embeddingError) {
      setError(embeddingError.message)
    } finally {
      setIsGeneratingEmbeddings(false)
    }
  }

  async function toggleChunks(itemId) {
    if (expandedItemId === itemId) {
      setExpandedItemId(null)
      setChunkError('')
      return
    }

    setExpandedItemId(itemId)
    setChunkError('')
    if (chunksByItemId[itemId]) return

    setLoadingChunksId(itemId)
    try {
      const response = await fetch(`/api/items/${itemId}/chunks`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load these chunks.')
      setChunksByItemId((current) => ({ ...current, [itemId]: data.chunks }))
    } catch (loadError) {
      setChunkError(loadError.message)
    } finally {
      setLoadingChunksId(null)
    }
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Knowledge Inbox home">
          <span className="wordmark-icon" aria-hidden="true">K</span>
          <span>knowledge inbox</span>
        </a>
        <span className="stage-label">YOUR PRIVATE LIBRARY</span>
      </header>

      <section className="workspace-intro">
        <div>
          <p className="eyebrow">A LITTLE SPACE FOR BIG IDEAS</p>
          <h1>Keep what<br />you learn.</h1>
          <p className="welcome-copy">
            Save useful notes and pages. Ask a question when you’re ready to
            connect the dots.
          </p>
        </div>

        <form className="composer-card" onSubmit={handleSubmit}>
          <div className="composer-heading">
            <div>
              <p className="eyebrow">CAPTURE SOMETHING</p>
              <h2>Add to your library</h2>
            </div>
            <span className="composer-mark" aria-hidden="true">+</span>
          </div>

          <div className="source-toggle" aria-label="Content type">
            <button
              type="button"
              aria-pressed={mode === 'note'}
              className={mode === 'note' ? 'selected' : ''}
              onClick={() => { setMode('note'); setError(''); setNotice('') }}
            >
              Write a note
            </button>
            <button
              type="button"
              aria-pressed={mode === 'url'}
              className={mode === 'url' ? 'selected' : ''}
              onClick={() => { setMode('url'); setError(''); setNotice('') }}
            >
              Add a web page
            </button>
          </div>

          {mode === 'note' ? (
            <label className="field-label" htmlFor="note-content">
              NOTE TEXT
              <textarea
                id="note-content"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="A thought, a useful detail, something you want to remember…"
                maxLength={50_000}
                rows={5}
                required
              />
              <span className="character-count">{note.length.toLocaleString()} / 50,000</span>
            </label>
          ) : (
            <label className="field-label" htmlFor="page-url">
              PAGE ADDRESS
              <input
                id="page-url"
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/article"
                required
              />
              <span className="field-hint">We’ll fetch and save its readable text.</span>
            </label>
          )}

          {error && <p className="form-message error-message" role="alert">{error}</p>}
          {notice && <p className="form-message success-message" role="status">{notice}</p>}

          <button className="submit-button" type="submit" disabled={isSaving}>
            {isSaving ? 'Saving…' : mode === 'note' ? 'Save note' : 'Import page'}
            <span aria-hidden="true">↗</span>
          </button>
          <p className="privacy-note">
            With an API key configured, saved chunks are sent to OpenAI to create embeddings.
          </p>
        </form>
      </section>

      <section className="library-section" aria-labelledby="library-title">
        <div className="library-heading">
          <div>
            <p className="eyebrow">COLLECTED IN ONE PLACE</p>
            <h2 id="library-title">Your library <span className="item-count">{items.length}</span></h2>
          </div>
          <div className="library-actions">
            {pendingEmbeddingCount > 0 && (
              <>
                <span className="pending-caption">{pendingEmbeddingCount} chunks need embeddings</span>
                <button
                  className="embed-button"
                  type="button"
                  onClick={handleGenerateEmbeddings}
                  disabled={isGeneratingEmbeddings}
                >
                  {isGeneratingEmbeddings ? 'Generating…' : 'Generate embeddings'}
                </button>
              </>
            )}
            {pendingEmbeddingCount === 0 && <span className="library-caption">NOTES &amp; PAGES</span>}
          </div>
        </div>

        {isLoading ? (
          <div className="empty-state">Opening your library…</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <span className="empty-mark" aria-hidden="true">✳</span>
            <p>Your library is waiting for its first note or page.</p>
          </div>
        ) : (
          <ul className="item-grid">
            {items.map((item) => (
              <li className="item-card" key={item.id}>
                <div className="item-meta">
                  <span className={`item-type ${item.type}`}>
                    {item.type === 'note' ? 'NOTE' : 'WEB PAGE'}
                  </span>
                  <time dateTime={item.createdAt}>
                    {dateFormatter.format(new Date(item.createdAt))}
                  </time>
                </div>
                <p className="embedding-count">
                  {item.embeddedChunkCount || 0} / {item.chunkCount} chunk embeddings ready
                </p>
                <h3>{item.title}</h3>
                {item.sourceUrl && (
                  <a className="source-link" href={item.sourceUrl} target="_blank" rel="noreferrer">
                    {new URL(item.sourceUrl).hostname}
                    <span aria-hidden="true"> ↗</span>
                  </a>
                )}
                <p className="item-excerpt">{item.content}</p>
                <button
                  type="button"
                  className="chunks-button"
                  aria-expanded={expandedItemId === item.id}
                  onClick={() => toggleChunks(item.id)}
                >
                  {loadingChunksId === item.id
                    ? 'Loading chunks…'
                    : expandedItemId === item.id
                      ? 'Hide chunks'
                      : `Inspect ${item.chunkCount} chunks`}
                  <span aria-hidden="true">{expandedItemId === item.id ? '−' : '+'}</span>
                </button>
                {expandedItemId === item.id && (
                  <div className="chunks-panel">
                    {chunkError ? (
                      <p className="form-message error-message" role="alert">{chunkError}</p>
                    ) : (chunksByItemId[item.id] || []).map((chunk) => (
                      <div className="chunk-preview" key={chunk.chunkIndex}>
                        <div className="chunk-label">
                          <span>CHUNK {String(chunk.chunkIndex + 1).padStart(2, '0')}</span>
                          <span>{chunk.startChar}–{chunk.endChar} chars</span>
                        </div>
                        <p>{chunk.content}</p>
                        <div className={`vector-status ${chunk.embeddingStatus}`}>
                          {chunk.embeddingStatus === 'ready'
                            ? `${chunk.embeddingDimensions}D vector · ${chunk.embeddingModel}`
                            : 'Embedding pending'}
                        </div>
                        {chunk.embeddingPreview && (
                          <code className="vector-preview">
                            [{chunk.embeddingPreview.map((value) => value.toFixed(4)).join(', ')}, …]
                          </code>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="page-footer">
        <span>CAPTURE NOW. MAKE SENSE LATER.</span>
        <span>03 / MAPPING MEANING</span>
      </footer>
    </main>
  )
}

export default App
