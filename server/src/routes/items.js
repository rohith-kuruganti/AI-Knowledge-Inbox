import { Router } from 'express'
import { createItem, getItemChunks, getItems } from '../storage/itemRepository.js'
import { fetchPageContent, UrlIngestionError } from '../services/urlContentService.js'

const router = Router()
const MAX_NOTE_LENGTH = 50_000

router.get('/items', (_request, response) => {
  response.json({ items: getItems() })
})

router.get('/items/:itemId/chunks', (request, response) => {
  const itemId = Number(request.params.itemId)
  if (!Number.isInteger(itemId) || itemId < 1) {
    return response.status(400).json({ error: 'Item ID must be a positive integer.' })
  }

  const chunks = getItemChunks(itemId)
  if (chunks === null) {
    return response.status(404).json({ error: 'Saved item not found.' })
  }

  return response.json({ chunks })
})

router.post('/ingest', async (request, response) => {
  const { type, content, url } = request.body ?? {}

  if (type === 'note') {
    if (typeof content !== 'string' || !content.trim()) {
      return response.status(400).json({ error: 'Write a note before saving it.' })
    }
    if (content.length > MAX_NOTE_LENGTH) {
      return response.status(413).json({ error: 'Notes must be 50,000 characters or fewer.' })
    }

    const cleanContent = content.trim()
    const firstLine = cleanContent.split('\n').find((line) => line.trim()) || cleanContent
    const item = createItem({
      type: 'note',
      title: firstLine.trim().slice(0, 100),
      content: cleanContent,
    })
    return response.status(201).json({ item })
  }

  if (type === 'url') {
    if (typeof url !== 'string' || !url.trim()) {
      return response.status(400).json({ error: 'Enter a web address before importing.' })
    }

    try {
      const page = await fetchPageContent(url.trim())
      const item = createItem({ type: 'url', ...page })
      return response.status(201).json({ item })
    } catch (error) {
      if (error instanceof UrlIngestionError) {
        return response.status(error.statusCode).json({ error: error.message })
      }
      console.error(JSON.stringify({ level: 'error', event: 'url_import_failed', message: error.message }))
      return response.status(502).json({ error: 'The page could not be imported.' })
    }
  }

  return response.status(400).json({ error: 'Choose note or url as the item type.' })
})

export default router
