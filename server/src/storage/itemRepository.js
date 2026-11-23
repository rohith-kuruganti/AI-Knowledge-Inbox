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
    COUNT(chunks.id) AS chunkCount
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
    end_char AS endChar
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
  return selectChunks.all(itemId)
}
