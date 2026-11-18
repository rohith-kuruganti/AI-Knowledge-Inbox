import express from 'express'
import itemsRouter from './src/routes/items.js'

const app = express()
const port = process.env.PORT || 3001

app.use(express.json({ limit: '100kb' }))

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', message: 'The API is connected.' })
})

app.use('/api', itemsRouter)

app.use((_request, response) => {
  response.status(404).json({ error: 'Route not found.' })
})

app.use((error, _request, response, _next) => {
  if (error.type === 'entity.parse.failed') {
    return response.status(400).json({ error: 'Request body must contain valid JSON.' })
  }
  if (error.type === 'entity.too.large') {
    return response.status(413).json({ error: 'Request body is too large.' })
  }

  console.error(JSON.stringify({ level: 'error', event: 'request_error', message: error.message }))
  return response.status(500).json({ error: 'An unexpected server error occurred.' })
})

app.listen(port, '127.0.0.1', () => {
  console.log(`Knowledge Inbox API listening on http://localhost:${port}`)
})
