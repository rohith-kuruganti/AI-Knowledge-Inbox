import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const databasePath = process.env.KNOWLEDGE_INBOX_DB_PATH ||
  resolve(currentDirectory, '../../data/knowledge-inbox.sqlite')

mkdirSync(dirname(databasePath), { recursive: true })

export const database = new Database(databasePath)

database.pragma('journal_mode = WAL')
database.pragma('foreign_keys = ON')
database.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('note', 'url')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source_url TEXT,
    created_at TEXT NOT NULL
  )
`)

database.exec(`
  CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    start_char INTEGER NOT NULL,
    end_char INTEGER NOT NULL,
    embedding_json TEXT,
    embedding_model TEXT,
    embedding_status TEXT NOT NULL DEFAULT 'pending',
    UNIQUE (item_id, chunk_index)
  );

  CREATE INDEX IF NOT EXISTS idx_chunks_item_id ON chunks(item_id)
`)

const chunkColumns = new Set(database.pragma('table_info(chunks)').map((column) => column.name))
const embeddingColumns = [
  ['embedding_json', 'TEXT'],
  ['embedding_model', 'TEXT'],
  ['embedding_status', "TEXT NOT NULL DEFAULT 'pending'"],
]

for (const [columnName, columnType] of embeddingColumns) {
  if (!chunkColumns.has(columnName)) {
    database.exec(`ALTER TABLE chunks ADD COLUMN ${columnName} ${columnType}`)
  }
}
