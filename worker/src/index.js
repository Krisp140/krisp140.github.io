import { HitCounter } from './hit-counter.js'

// The Durable Object class must be exported from the Worker entry point.
export { HitCounter }

const COUNTER_PATH = '/api/hits'

// A single named instance backs the whole site.
const COUNTER_NAME = 'global'

// The count changes on every visit, so neither the browser nor the Cloudflare
// cache may hold on to a response.
const NO_STORE = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: NO_STORE })

export default {
  async fetch(request, env) {
    // The route pattern needs a trailing wildcard to survive query strings,
    // so it also catches paths like /api/hitsfoo. Match exactly here.
    const { pathname } = new URL(request.url)
    if (pathname !== COUNTER_PATH) {
      return json({ error: 'not found' }, 404)
    }

    if (request.method !== 'GET' && request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'method not allowed' }), {
        status: 405,
        headers: { ...NO_STORE, allow: 'GET, POST' },
      })
    }

    try {
      const counter = env.HIT_COUNTER.getByName(COUNTER_NAME)
      const value =
        request.method === 'POST' ? await counter.increment() : await counter.read()

      return json({ value })
    } catch (error) {
      // The page degrades to dashes on a non-OK response, so fail closed
      // rather than reporting a count we are not sure about.
      return json({ error: 'counter unavailable' }, 503)
    }
  },
}
