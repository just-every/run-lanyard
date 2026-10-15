import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
import { unstable_splitSqlQuery } from 'wrangler'

let bundle
export async function harness(options = {}) {
  bundle ??= await build({ entryPoints: ['tests/worker.ts'], bundle: true, write: false, format: 'esm', platform: 'neutral', conditions: ['workerd', 'worker', 'browser'], external: ['node:*'], target: 'es2023' })
  const socket = createServer(); await new Promise(r => socket.listen(0, '127.0.0.1', r)); const port = socket.address().port; await new Promise(r => socket.close(r))
  const dir = options.root ? join(options.root, '.wrangler/state/v3') : await mkdtemp(join(tmpdir(), 'lanyard-test-')), origin = `http://127.0.0.1:${port}`, setup = randomBytes(32).toString('hex')
  const auth = { AUTH_LOCAL: 'true', OWNER_EMAIL: 'owner@venue.example', SESSION_SECRET: randomBytes(32).toString('hex'), SETUP_TOKEN: setup, MAIL_PROVIDER: 'resend', MAIL_API_KEY: 'test-network-edge', MAIL_FROM: 'auth@venue.example', ...options.auth, AUTH_ORIGIN: origin }
  const mailbox = []
  // Fake only the paid mail provider; native invitation and session routes stay real.
  const outboundService = async request => {
    assert.equal(request.url, 'https://api.resend.com/emails')
    assert.equal(request.method, 'POST')
    mailbox.push(await request.json())
    return Response.json({ id: randomBytes(16).toString('hex') })
  }
  const mf = new Miniflare({ ...convertV4MiniflareOptions({ host: '127.0.0.1', port, modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-09-08', compatibilityFlags: ['nodejs_compat'], d1Databases: { DB: 'local-foundation-only' }, bindings: auth, outboundService }), resourcePersistencePath: dir })
  try {
    const db = await mf.getD1Database('DB')
    if (!options.root) for (const file of (await readdir('migrations/core')).filter(f => f.endsWith('.sql')).sort()) await db.batch(unstable_splitSqlQuery(await readFile('migrations/core/' + file, 'utf8')).map(sql => db.prepare(sql)))
    const send = async (path, body, cookie = '', headers = {}) => {
      const response = await mf.dispatchFetch(origin + path, { method: body === undefined ? 'GET' : 'POST', headers: { host: new URL(origin).host, origin, 'content-type': 'application/json', cookie, ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'manual' })
      const text = await response.text(); let value
      try { value = JSON.parse(text) } catch { value = text }
      return { status: response.status, value, text, headers: response.headers, cookie: response.headers.get('set-cookie')?.split(';')[0] }
    }
    const bootstrap = options.owner || options.unclaimed ? null : await send('/auth/bootstrap', { token: auth.SETUP_TOKEN, displayName: 'Jordan Venue' })
    if (bootstrap) assert.equal(bootstrap.status, 303, bootstrap.text)
    const owner = options.owner ?? bootstrap?.cookie
    const cmd = async (name, input, cookie = owner, status = 200, headers = {}) => {
      const r = await send('/api/lanyard/command', { name, input }, cookie, headers)
      assert.equal(r.status, status, `${name}: ${JSON.stringify(r.value)}`)
      return r.value.result ?? r.value
    }
    const state = async (cookie = owner, status = 200) => { const r = await send('/api/lanyard/state', undefined, cookie); assert.equal(r.status, status, JSON.stringify(r.value)); return r.value }
    const confirmMail = async email => {
      const message = mailbox.findLast(m => m.to.includes(email))
      assert.ok(message, 'invitation accepted by the mail provider')
      const token = new URL(message.text.match(/http:\/\/[^\s]+\/auth\/confirm\?token=[^\s]+/)[0]).searchParams.get('token')
      const r = await send('/auth/confirm', { token })
      assert.equal(r.status, 303, JSON.stringify(r.value)); return r.cookie
    }
    const person = async (name, role = 'staff') => {
      const email = `${name.toLowerCase()}@venue.example`, staff = await cmd('staff.save', { name, email, payrollId: name.toUpperCase(), role, active: true })
      await cmd('staff.invite', { id: staff.id })
      return { ...staff, cookie: await confirmMail(email) }
    }
    const signIn = async email => { const response = await send('/auth/magic-link', {email}); assert.equal(response.status,202,response.text); return confirmMail(email) }
    return { db, mf, origin, owner, auth, send, cmd, state, person, signIn, close: async () => { await mf.dispose(); if (!options.root) await rm(dir, { recursive: true, force: true }) } }
  } catch (error) { await mf.dispose(); if (!options.root) await rm(dir, { recursive: true, force: true }); throw error }
}

export async function run(fn) { const h = await harness(); try { await fn(h) } finally { await h.close() } }
