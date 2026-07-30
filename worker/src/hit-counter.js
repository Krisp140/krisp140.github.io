import { DurableObject } from 'cloudflare:workers'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS hits (
    id INTEGER PRIMARY KEY,
    total INTEGER NOT NULL
  )
`

const SELECT_TOTAL = 'SELECT total FROM hits WHERE id = 1'

// Single-row upsert. SQLite in a Durable Object is strongly consistent and
// single-threaded per object, so concurrent visitors cannot lose an increment
// the way a read-modify-write against eventually-consistent KV would.
const INCREMENT = `
  INSERT INTO hits (id, total) VALUES (1, 1)
  ON CONFLICT(id) DO UPDATE SET total = total + 1
`

/**
 * Durable Object holding the site-wide visitor count.
 *
 * One instance backs the whole site (addressed by a fixed name), so every
 * request serializes through the same object and the total stays exact.
 */
export class HitCounter extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env)
    this.ctx.storage.sql.exec(SCHEMA)
  }

  /** Current total without recording a visit. */
  read() {
    const [row] = this.ctx.storage.sql.exec(SELECT_TOTAL).toArray()
    return row ? Number(row.total) : 0
  }

  /** Record one visit and return the new total. */
  increment() {
    this.ctx.storage.sql.exec(INCREMENT)
    return this.read()
  }
}
