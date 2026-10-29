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
  const dir = options.root ? join(options.root, '.wrangler/state/v3') : await mkdtemp(join(tmpdir(), 'lanyard-test-')), origin = `${options.secure ? "https" : "http"}://127.0.0.1:${port}`, setup = randomBytes(32).toString('hex')
  const auth = { AUTH_LOCAL: 'true', OWNER_EMAIL: 'owner@venue.example', SESSION_SECRET: randomBytes(32).toString('hex'), SETUP_TOKEN: setup, MAIL_PROVIDER: 'resend', MAIL_API_KEY: 'synthetic-test-network-edge', MAIL_FROM: 'auth@venue.example', ...options.auth, AUTH_ORIGIN: origin }
  const mailbox = []
  // Fake only the paid mail provider; native invitation and session routes stay real.
  const outboundService = async request => {
    options.observeOutbound?.(request)
    if(new URL(request.url).hostname==='api.openai.com'&&options.modelOutbound)return options.modelOutbound(request)
    if(request.url==='https://api.sendgrid.com/v3/mail/send'){
      const message=await request.json()
      mailbox.push({to:message.personalizations.flatMap(p=>p.to.map(r=>r.email)),subject:message.subject,text:message.content.find(c=>c.type==='text/plain')?.value??''})
      return options.sendgridOutbound?options.sendgridOutbound(message):new Response(null,{status:202,headers:{'x-message-id':'synthetic-lanyard-1'}})
    }
    assert.equal(request.url, 'https://api.resend.com/emails')
    assert.equal(request.method, 'POST')
    mailbox.push(await request.json())
    return Response.json({ id: randomBytes(16).toString('hex') })
  }
  const mfOptions = { ...convertV4MiniflareOptions({ host: '127.0.0.1', port, https:Boolean(options.secure), modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-09-08', compatibilityFlags: ['nodejs_compat'], d1Databases: { DB: 'local-foundation-only' }, r2Buckets: { FILES: 'lanyard-files' }, bindings: auth, outboundService }), resourcePersistencePath: dir }
  const mf = new Miniflare(mfOptions)
  try {
    let db = await mf.getD1Database('DB')
    if (!options.root) for (const file of (await readdir('migrations/core')).filter(f => f.endsWith('.sql')).sort()) await db.batch(unstable_splitSqlQuery(await readFile('migrations/core/' + file, 'utf8')).map(sql => db.prepare(sql)))
    const send = async (path, body, cookie = '', headers = {}) => {
      const response = await mf.dispatchFetch(origin + path, { method: body === undefined ? 'GET' : 'POST', headers: { host: new URL(origin).host, origin, 'content-type': 'application/json', cookie, ...(options.now?{'x-test-now':String(Date.parse(options.now))}:{}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'manual' })
      const text = await response.text(); let value
      try { value = JSON.parse(text) } catch { value = text }
      return { status: response.status, value, text, headers: response.headers, cookie: response.headers.get('set-cookie')?.split(';')[0] }
    }
    const bootstrap = options.owner || options.unclaimed ? null : await send('/auth/bootstrap', { token: auth.SETUP_TOKEN, displayName: 'Jordan Venue' })
    if (bootstrap) assert.equal(bootstrap.status, 303, bootstrap.text)
    const owner = options.owner ?? bootstrap?.cookie
    if (bootstrap && !auth.RER_OWNER_CLAIM_PUBLIC_KEYS) {
      // The fixture owner explicitly chooses autonomous preparation. Native
      // human approval requirements remain in the application services.
      const policy = await mf.dispatchFetch(origin + '/agents/api/policy', {method:'PUT', headers:{origin,cookie:owner,'content-type':'application/json'}, body:JSON.stringify({document:{schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',rules:[{id:'preparation',class:'*',do:'autonomous'}],spend:{none:true}}})})
      assert.equal(policy.status,200,await policy.text())
    }
    const cmd = async (name, input, cookie = owner, status = 200, headers = {}) => {
      const r = await send('/api/lanyard/command', { name, input }, cookie, headers)
      assert.equal(r.status, status, `${name}: ${JSON.stringify(r.value)}`)
      return r.value.result ?? r.value
    }
    const state = async (cookie = owner, status = 200) => { const r = await send('/api/lanyard/state', undefined, cookie); assert.equal(r.status, status, JSON.stringify(r.value)); return r.value }
    const confirmMail = async (email, headers = {}) => {
      const message = mailbox.findLast(m => m.to.includes(email))
      assert.ok(message, 'invitation accepted by the mail provider')
      const token = new URL(message.text.match(/https?:\/\/[^\s]+\/auth\/confirm\?token=[^\s]+/)[0]).searchParams.get('token')
      const r = await send('/auth/confirm', { token }, '', headers)
      assert.equal(r.status, 303, JSON.stringify(r.value)); return r.cookie
    }
    const person = async (name, role = 'staff') => {
      const email = `${name.toLowerCase()}@venue.example`, staff = await cmd('staff.save', { name, email, payrollId: name.toUpperCase(), role, active: true })
      await cmd('staff.invite', { id: staff.id })
      return { ...staff, cookie: await confirmMail(email) }
    }
    const signIn = async (email, headers = {}) => { const response = await send('/auth/magic-link', {email}, '', headers); assert.equal(response.status,202,response.text); return confirmMail(email, headers) }
    return { get db(){return db}, mf, origin, owner, auth, mailbox, send, cmd, state, person, signIn, confirmMail, restart:async()=>{await mf.setOptions(mfOptions);db=await mf.getD1Database('DB')}, close: async () => { await mf.dispose(); if (!options.root) await rm(dir, { recursive: true, force: true }) } }
  } catch (error) {
    const collision=error?.code === 'ERR_ADDRESS_IN_USE'
    try { await mf.dispose() } catch (cleanupError) { if(!collision)throw cleanupError }
    if (!options.root) await rm(dir, { recursive: true, force: true })
    // The probe releases its port before workerd can bind it. Another listener
    // can win that race; retry only a failed startup bind, never a test assertion.
    if (collision && (options.portAttempts ?? 0) < 2) {
      console.warn('Harness startup port collision; allocating a fresh listener')
      return harness({...options,portAttempts:(options.portAttempts ?? 0)+1})
    }
    throw error
  }
}

export async function run(fn, options = {}) { const h = await harness(options); try { await fn(h) } finally { await h.close() } }
