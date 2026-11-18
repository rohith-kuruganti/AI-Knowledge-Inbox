import { isIP } from 'node:net'
import { load } from 'cheerio'

const MAX_PAGE_BYTES = 2_000_000
const MAX_REDIRECTS = 3
const FETCH_TIMEOUT_MS = 10_000

export class UrlIngestionError extends Error {
  constructor(message, statusCode = 422) {
    super(message)
    this.name = 'UrlIngestionError'
    this.statusCode = statusCode
  }
}

function isPrivateIpv4(hostname) {
  const octets = hostname.split('.').map(Number)
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false
  }

  const [first, second] = octets
  return first === 0 || first === 10 || first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) || first >= 224
}

function validateUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new UrlIngestionError('Enter a valid web address.')
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new UrlIngestionError('Only HTTP and HTTPS web addresses are supported.')
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  const privateIpv6 = isIP(hostname) === 6 && (
    hostname === '::1' || hostname === '::' || hostname.startsWith('fc') ||
    hostname.startsWith('fd') || hostname.startsWith('fe80:') ||
    (hostname.startsWith('::ffff:') && isPrivateIpv4(hostname.slice('::ffff:'.length)))
  )

  if (
    hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') ||
    privateIpv6 || (isIP(hostname) === 4 && isPrivateIpv4(hostname))
  ) {
    throw new UrlIngestionError('Local network addresses cannot be imported.')
  }

  return url
}

async function readLimitedBody(response) {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_PAGE_BYTES) {
    await response.body?.cancel()
    throw new UrlIngestionError('That page is larger than the 2 MB import limit.', 413)
  }

  if (!response.body) return ''

  const reader = response.body.getReader()
  const chunks = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > MAX_PAGE_BYTES) {
        await reader.cancel()
        throw new UrlIngestionError('That page is larger than the 2 MB import limit.', 413)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

export async function fetchPageContent(inputUrl) {
  let currentUrl = validateUrl(inputUrl)

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    let response
    try {
      response = await fetch(currentUrl, {
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { 'user-agent': 'KnowledgeInbox/1.0' },
      })
    } catch {
      throw new UrlIngestionError('Could not fetch that page. Check the address and try again.', 502)
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      await response.body?.cancel()
      if (!location || redirectCount === MAX_REDIRECTS) {
        throw new UrlIngestionError('That page redirected too many times.', 422)
      }
      currentUrl = validateUrl(new URL(location, currentUrl).href)
      continue
    }

    if (!response.ok) {
      await response.body?.cancel()
      throw new UrlIngestionError(`The page returned HTTP ${response.status}.`, 422)
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.toLowerCase().includes('text/html')) {
      await response.body?.cancel()
      throw new UrlIngestionError('That address did not return an HTML page.')
    }

    const html = await readLimitedBody(response)
    const $ = load(html)
    const title = $('title').first().text().trim() || currentUrl.hostname
    $('script, style, noscript, svg, header, footer, nav, aside, form').remove()
    const content = $('body').text().replace(/\s+/g, ' ').trim()

    if (!content) {
      throw new UrlIngestionError('No readable page text was found at that address.')
    }

    return {
      title: title.slice(0, 200),
      content: content.slice(0, 100_000),
      sourceUrl: inputUrl,
    }
  }

  throw new UrlIngestionError('Could not import that page.')
}
