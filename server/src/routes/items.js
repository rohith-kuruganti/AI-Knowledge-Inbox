import { Router } from 'express'
import { createItem, getItemChunks, getItems } from '../storage/itemRepository.js'
import { EmbeddingConfigurationError } from '../services/embeddingService.js'
import { embedPendingChunks } from '../services/embeddingIndexingService.js'
import { fetchPageContent, UrlIngestionError } from '../services/urlContentService.js'

const router = Router()
const MAX_NOTE_LENGTH = 50_000

async function saveItemAndMaybeEmbed(itemData) {
  const item = createItem(itemData)
  let embeddedChunkCount = 0
  let embeddingWarning = 'Saved locally. Add your OpenAI API key to generate embeddings.'

  if (process.env.OPENAI_API_KEY) {
    embeddingWarning = ''
    try {
      const result = await embedPendingChunks(item.id)
      embeddedChunkCount = result.embeddedChunks
    } catch (error) {
      embeddingWarning = 'Saved, but embeddings could not be generated. You can retry from the library.'
      console.error(JSON.stringify({
        level: 'error',
        event: 'item_embedding_failed',
        itemId: item.id,
        errorName: error.name,
      }))
    }
  }

  return {
    item: { ...item, embeddedChunkCount },
    embeddingWarning,
  }
}

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

router.post('/embeddings/generate', async (_request, response) => {
  try {
    const result = await embedPendingChunks()
    return response.json(result)
  } catch (error) {
    if (error instanceof EmbeddingConfigurationError) {
      return response.status(503).json({ error: error.message })
    }

    console.error(JSON.stringify({
      level: 'error',
      event: 'embedding_generation_failed',
      errorName: error.name,
    }))
    return response.status(502).json({ error: 'Embedding generation failed. Check the API key and server logs.' })
  }
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
    const result = await saveItemAndMaybeEmbed({
      type: 'note',
      title: firstLine.trim().slice(0, 100),
      content: cleanContent,
    })
    return response.status(201).json(result)
  }

  if (type === 'url') {
    if (typeof url !== 'string' || !url.trim()) {
      return response.status(400).json({ error: 'Enter a web address before importing.' })
    }

    try {
      const page = await fetchPageContent(url.trim())
      const result = await saveItemAndMaybeEmbed({ type: 'url', ...page })
      return response.status(201).json(result)
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
