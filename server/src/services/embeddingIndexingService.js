import { getPendingChunks, saveChunkEmbeddings } from '../storage/itemRepository.js'
import { createEmbeddings } from './embeddingService.js'

export async function embedPendingChunks(itemId = null) {
  const pendingChunks = getPendingChunks(itemId)
  if (pendingChunks.length === 0) {
    return { embeddedChunks: 0, model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small' }
  }

  const { model, embeddings } = await createEmbeddings(pendingChunks.map((chunk) => chunk.content))
  saveChunkEmbeddings(pendingChunks.map((chunk, index) => ({
    id: chunk.id,
    embedding: embeddings[index],
    model,
  })))

  return { embeddedChunks: pendingChunks.length, model }
}
