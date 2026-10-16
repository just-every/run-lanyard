import { runtimeBindings, type Bindings } from '../auth.server'
import { batchCsv, command, snapshot, type Actor } from './domain'
import { importCommand } from './movein'
import { agentKeys, credentialCommand, fail, principal } from './credentials'
import { renderApp } from './ui'

const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin' }
const json = (value: unknown, status = 200) => Response.json(value, { status, headers })
const pages = new Set(['/app', '/app/roster', '/app/time', '/app/payroll', '/app/people', '/app/import', '/app/agent'])

async function state(env: Bindings, who: Actor) {
  // Independent reads go to D1 together, so a page waits for one round trip instead of several in a row.
  const [snap, keys, jobs] = await Promise.all([snapshot(env.DB, who), agentKeys(env, who), who.role === 'owner' ? env.DB.prepare("SELECT id,state,checkpoint,total,fingerprint,error FROM ik_jobs WHERE destination='lanyard:staff' AND namespace='lanyard.staff.csv.v1' AND mapping_version='staff-csv-v1' AND principal_id=? ORDER BY rowid DESC LIMIT 30").bind(who.id).all() : null])
  return { ...snap, agentKeys: keys, importJobs: jobs ? jobs.results : [] }
}

async function execute(request: Request, env: Bindings, who: Actor, name: string, input: Record<string, unknown>) {
  if (name.startsWith('agent.') || name === 'staff.invite') return credentialCommand(request, env, who, name, input)
  if (name.startsWith('import.')) return importCommand(env.DB, who, name, input)
  return command(env.DB, who, name, input)
}

async function inputBody(request: Request): Promise<Record<string, unknown>> {
  const raw = await request.text()
  if (new TextEncoder().encode(raw).length > 200_000) fail('Request is too large', 413)
  if (request.headers.get('content-type')?.includes('application/json')) {
    let input; try { input = JSON.parse(raw) } catch { fail('Invalid JSON') }
    if (!input || Array.isArray(input) || typeof input !== 'object') fail('Expected an object')
    return input
  }
  if (!request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) fail('Use JSON or a form', 415)
  const input: Record<string, unknown> = Object.fromEntries(new URLSearchParams(raw))
  for (const key of ['revision', 'breakMinutes']) if (key in input) input[key] = Number(input[key])
  for (const key of ['shifts', 'ids']) if (input[key]) { try { input[key] = JSON.parse(String(input[key])) } catch { fail(`Invalid ${key}`) } }
  if ('active' in input) input.active = input.active === 'on' || input.active === 'true' || input.active === '1'
  return input
}

export async function lanyardResponse(request: Request, original: Bindings): Promise<Response | null> {
  const url = new URL(request.url), path = url.pathname
  if (!path.startsWith('/api/lanyard/') && path !== '/app' && !path.startsWith('/app/')) return null
  const env = runtimeBindings(original), isAgent = path.startsWith('/api/lanyard/agent/')
  let who: Actor | undefined
  const back = pages.has(url.searchParams.get('returnTo') ?? '') ? url.searchParams.get('returnTo')! : '/app'
  try {
    if (url.origin !== env.AUTH_ORIGIN || (request.headers.has('host') && request.headers.get('host') !== url.host)) fail('Wrong application origin', 403)
    if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed' }, 405)
    // Bearer-only agent routes have no ambient browser authority. Human mutations require Origin.
    if (request.method === 'POST' && !isAgent && (request.headers.get('origin') !== env.AUTH_ORIGIN || request.headers.get('sec-fetch-site') === 'cross-site')) fail('Cross-site request refused', 403)
    who = await principal(request, env, isAgent)
    if (request.method === 'GET') {
      if (pages.has(path)) return renderApp(await state(env, who), path)
      if (path === '/api/lanyard/state' || path === '/api/lanyard/agent/context') return json(await state(env, who))
      const file = path.match(/^\/api\/lanyard\/batches\/([\w-]+)\.csv$/)
      if (file) return new Response(await batchCsv(env.DB, who, file[1]), { headers: { ...headers, 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="lanyard-${file[1]}.csv"` } })
    } else {
      if (path === '/app/action') {
        const input = await inputBody(request), name = url.searchParams.get('name') ?? ''
        if (name === 'staff.save' && !('active' in input)) input.active = false
        const result = await execute(request, env, who, name, input)
        return renderApp(await state(env, who), back, { message: 'Saved.', result: name === 'import.preview' ? { ...(result as object), csv: input.csv } : result })
      }
      if (path === '/api/lanyard/command' || path === '/api/lanyard/agent/command') {
        const body = await inputBody(request)
        if (typeof body.name !== 'string' || !body.input || typeof body.input !== 'object' || Array.isArray(body.input)) fail('Provide a command name and input object')
        if (isAgent && !['roster.prepare', 'time.prepare', 'payroll.prepare'].includes(String(body.name))) fail('Agents can only prepare drafts', 403)
        return json(await execute(request, env, who, String(body.name), body.input as Record<string, unknown>))
      }
    }
    return json({ error: 'Not found' }, 404)
  } catch (error) {
    const status = Number((error as any)?.status) || 500
    const message = status < 500 ? (error as Error).message : 'Could not save this change. Refresh and try again.'
    if (path === '/app/action' && who) return renderApp(await state(env, who), back, { error: message })
    if (pages.has(path) && status === 401) return new Response(null, { status: 303, headers: { ...headers, location: '/signin?returnTo=' + encodeURIComponent(path) } })
    return json({ error: message }, status)
  }
}
