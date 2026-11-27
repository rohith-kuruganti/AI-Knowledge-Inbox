import { database } from './database.js'
import { chunkText } from '../services/chunkingService.js'

const insertItem = database.prepare(`
  INSERT INTO items (type, title, content, source_url, created_at)
  VALUES (@type, @title, @content, @sourceUrl, @createdAt)
`)

const insertChunk = database.prepare(`
  INSERT INTO chunks (item_id, chunk_index, content, start_char, end_char)
  VALUES (@itemId, @index, @content, @startChar, @endChar)
`)

const selectItems = database.prepare(`
  SELECT
    items.id,
    items.type,
    items.title,
    items.content,
    items.source_url AS sourceUrl,
    items.created_at AS createdAt,
    COUNT(chunks.id) AS chunkCount,
    SUM(CASE WHEN chunks.embedding_status = 'ready' THEN 1 ELSE 0 END) AS embeddedChunkCount
  FROM items
  LEFT JOIN chunks ON chunks.item_id = items.id
  GROUP BY items.id
  ORDER BY items.created_at DESC, items.id DESC
`)

const selectChunks = database.prepare(`
  SELECT
    chunk_index AS chunkIndex,
    content,
    start_char AS startChar,
    end_char AS endChar,
    embedding_status AS embeddingStatus,
    embedding_model AS embeddingModel,
    embedding_json AS embeddingJson
  FROM chunks
  WHERE item_id = ?
  ORDER BY chunk_index ASC
`)

const selectItemById = database.prepare('SELECT id FROM items WHERE id = ?')

const createItemTransaction = database.transaction(({ type, title, content, sourceUrl = null }) => {
  const createdAt = new Date().toISOString()
  const result = insertItem.run({ type, title, content, sourceUrl, createdAt })
  const itemId = Number(result.lastInsertRowid)
  const chunks = chunkText(content)

  for (const chunk of chunks) {
    insertChunk.run({ itemId, ...chunk })
  }

  return {
    id: itemId,
    type,
    title,
    content,
    sourceUrl,
    createdAt,
    chunkCount: chunks.length,
  }
})

const backfillMissingChunks = database.transaction(() => {
  const itemsWithoutChunks = database.prepare(`
    SELECT id, content
    FROM items
    WHERE NOT EXISTS (SELECT 1 FROM chunks WHERE chunks.item_id = items.id)
  `).all()

  for (const item of itemsWithoutChunks) {
    for (const chunk of chunkText(item.content)) {
      insertChunk.run({ itemId: item.id, ...chunk })
    }
  }
})

backfillMissingChunks()

export function createItem(item) {
  return createItemTransaction(item)
}

export function getItems() {
  return selectItems.all()
}

export function getItemChunks(itemId) {
  if (!selectItemById.get(itemId)) return null
  return selectChunks.all(itemId).map(({ embeddingJson, ...chunk }) => {
    const embedding = embeddingJson ? JSON.parse(embeddingJson) : null
    return {
      ...chunk,
      embeddingDimensions: embedding?.length ?? 0,
      embeddingPreview: embedding?.slice(0, 5) ?? null,
    }
  })
}

export function getPendingChunks(itemId = null) {
  const query = itemId === null
    ? database.prepare(`
        SELECT id, content
        FROM chunks
        WHERE embedding_status != 'ready'
        ORDER BY item_id ASC, chunk_index ASC
      `)
    : database.prepare(`
        SELECT id, content
        FROM chunks
        WHERE item_id = ? AND embedding_status != 'ready'
        ORDER BY chunk_index ASC
      `)

  return itemId === null ? query.all() : query.all(itemId)
}

const updateEmbedding = database.prepare(`
  UPDATE chunks
  SET embedding_json = @embeddingJson,
      embedding_model = @model,
      embedding_status = 'ready'
  WHERE id = @id
`)

const saveEmbeddingsTransaction = database.transaction((embeddings) => {
  for (const { id, embedding, model } of embeddings) {
    updateEmbedding.run({ id, embeddingJson: JSON.stringify(embedding), model })
  }
})

export function saveChunkEmbeddings(embeddings) {
  saveEmbeddingsTransaction(embeddings)
}
