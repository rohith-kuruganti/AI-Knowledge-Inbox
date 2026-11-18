import { database } from './database.js'

const insertItem = database.prepare(`
  INSERT INTO items (type, title, content, source_url, created_at)
  VALUES (@type, @title, @content, @sourceUrl, @createdAt)
`)

const selectItems = database.prepare(`
  SELECT
    id,
    type,
    title,
    content,
    source_url AS sourceUrl,
    created_at AS createdAt
  FROM items
  ORDER BY created_at DESC, id DESC
`)

export function createItem({ type, title, content, sourceUrl = null }) {
  const createdAt = new Date().toISOString()
  const result = insertItem.run({ type, title, content, sourceUrl, createdAt })

  return database.prepare(`
    SELECT
      id,
      type,
      title,
      content,
      source_url AS sourceUrl,
      created_at AS createdAt
    FROM items
    WHERE id = ?
  `).get(result.lastInsertRowid)
}

export function getItems() {
  return selectItems.all()
}
