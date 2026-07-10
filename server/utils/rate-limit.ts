// Rate limiting in-memory per IP.
// ponytail: la Map vive per istanza serverless (si azzera a ogni cold start) —
// sufficiente contro lo spam banale; passare a storage condiviso solo se servirà un limite globale rigoroso.
const buckets = new Map<string, number[]>()

export function rateLimitExceeded(key: string, max = 3, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now()
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (hits.length >= max) {
    buckets.set(key, hits)
    return true
  }
  hits.push(now)
  buckets.set(key, hits)
  return false
}
