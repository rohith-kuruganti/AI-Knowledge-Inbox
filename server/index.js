import express from 'express'

const app = express()
const port = process.env.PORT || 3001

app.use(express.json())

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', message: 'The API is connected.' })
})

app.listen(port, '127.0.0.1', () => {
  console.log(`Knowledge Inbox API listening on http://localhost:${port}`)
})
