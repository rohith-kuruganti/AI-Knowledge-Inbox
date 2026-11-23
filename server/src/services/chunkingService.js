const TARGET_CHARS = 1_600
const OVERLAP_CHARS = 240
const MIN_BOUNDARY_POSITION = 0.65

function findChunkEnd(text, start, limit) {
  const minimumEnd = start + Math.floor(TARGET_CHARS * MIN_BOUNDARY_POSITION)
  const paragraphEnd = text.lastIndexOf('\n\n', limit)
  if (paragraphEnd >= minimumEnd) return paragraphEnd

  const window = text.slice(start, limit)
  const sentenceEnds = ['. ', '? ', '! ']
    .map((delimiter) => window.lastIndexOf(delimiter))
    .filter((position) => position >= minimumEnd - start)

  if (sentenceEnds.length > 0) return start + Math.max(...sentenceEnds) + 1

  const wordEnd = text.lastIndexOf(' ', limit)
  if (wordEnd >= minimumEnd) return wordEnd
  return limit
}

export function chunkText(input) {
  const text = input
    .replace(/\r\n?/g, '\n')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!text) return []

  const chunks = []
  let start = 0

  while (start < text.length) {
    const limit = Math.min(start + TARGET_CHARS, text.length)
    const end = limit === text.length ? limit : findChunkEnd(text, start, limit)
    const content = text.slice(start, end).trim()

    if (content) {
      chunks.push({
        index: chunks.length,
        startChar: start,
        endChar: end,
        content,
      })
    }

    if (end >= text.length) break
    start = Math.max(start + 1, end - OVERLAP_CHARS)
  }

  return chunks
}

export const chunkingStrategy = {
  targetChars: TARGET_CHARS,
  overlapChars: OVERLAP_CHARS,
}
