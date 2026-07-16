/** Compact share payload in the URL hash: #s=<base64url json> */

export type SharePayload = {
  v: 1
  pgn?: string
  fen?: string
  mode?: 'analyze' | 'play'
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeShare(payload: SharePayload): string {
  return toBase64Url(JSON.stringify(payload))
}

export function decodeShare(raw: string): SharePayload | null {
  try {
    const parsed = JSON.parse(fromBase64Url(raw)) as SharePayload
    if (parsed.v !== 1) return null
    return parsed
  } catch {
    return null
  }
}

export function readShareFromLocation(): SharePayload | null {
  const hash = window.location.hash
  if (!hash.startsWith('#s=')) return null
  return decodeShare(hash.slice(3))
}

export function writeShareToLocation(payload: SharePayload): string {
  const encoded = encodeShare(payload)
  const url = `${window.location.origin}${window.location.pathname}${window.location.search}#s=${encoded}`
  window.history.replaceState(null, '', `#s=${encoded}`)
  return url
}
