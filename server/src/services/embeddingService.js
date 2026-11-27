import OpenAI from 'openai'

const DEFAULT_MODEL = 'text-embedding-3-small'
const MAX_INPUTS_PER_REQUEST = 64

let openaiClient
let configuredApiKey

export class EmbeddingConfigurationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'EmbeddingConfigurationError'
  }
}

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new EmbeddingConfigurationError(
      'Set OPENAI_API_KEY in server/.env, then restart the backend.',
    )
  }

  if (!openaiClient || configuredApiKey !== apiKey) {
    configuredApiKey = apiKey
    openaiClient = new OpenAI({ apiKey })
  }

  return openaiClient
}

export async function createEmbeddings(texts) {
  if (texts.length === 0) return { model: process.env.OPENAI_EMBEDDING_MODEL || DEFAULT_MODEL, embeddings: [] }

  const client = getClient()
  const model = process.env.OPENAI_EMBEDDING_MODEL || DEFAULT_MODEL
  const embeddings = []

  for (let offset = 0; offset < texts.length; offset += MAX_INPUTS_PER_REQUEST) {
    const batch = texts.slice(offset, offset + MAX_INPUTS_PER_REQUEST)
    const response = await client.embeddings.create({
      model,
      input: batch,
      encoding_format: 'float',
    })

    const batchEmbeddings = new Array(batch.length)
    for (const result of response.data) {
      batchEmbeddings[result.index] = result.embedding
    }

    if (batchEmbeddings.some((embedding) => !embedding)) {
      throw new Error('The embedding service returned an incomplete batch.')
    }

    embeddings.push(...batchEmbeddings)
  }

  return { model, embeddings }
}
