import { runtimeBindings, type Bindings } from '../auth.server'
import { attendanceBoard, batchCsv, autoRulePreview, command, contactRead, dashboardRead, intervalsRead, salesRead, logbookRead, noteAttachment, overtimeAlerts, scheduleHistory, schedulePdf, snapshot, type Actor } from './domain'
import { importCommand } from './movein'
import { agentKeys, credentialCommand, fail, principal } from './credentials'
import { renderApp } from './ui'
import { clockBrowserCommand, clockBrowsers, clockCookie, networkOf } from './clockbrowsers'
import { timezone as zone } from './domain/settings'

const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin' }
const json = (value: unknown, status = 200) => Response.json(value, { status, headers })
const pages = new Set(['/app', '/app/schedule', '/app/time', '/app/payroll', '/app/people', '/app/import', '/app/agent', '/app/wall'])
// The screen a form returns to, with its own query (week, cafe, day) but never another origin or path.
function returnTo(value: string | null): string {
  if (!value?.startsWith('/app')) return '/app'
  const url = new URL(value, 'http://app.invalid')
  return pages.has(url.pathname) ? url.pathname + url.search : '/app'
}

async function state(env: Bindings, who: Actor) {
  // A new installation takes the time zone its owner gave at setup until anything is saved.
  if (env.VENUE_TIMEZONE) await env.DB.prepare('UPDATE l_meta SET timezone=? WHERE id=1 AND version=0 AND timezone<>?').bind(zone(env.VENUE_TIMEZONE), zone(env.VENUE_TIMEZONE)).run()
  // Independent reads go to D1 together, so a page waits for one round trip instead of several in a row.
  const [snap, keys, browsers, jobs] = await Promise.all([snapshot(env.DB, who, env.SESSION_SECRET), agentKeys(env, who), clockBrowsers(env, who), who.role === 'owner' ? env.DB.prepare("SELECT id,state,checkpoint,total,fingerprint,error FROM ik_jobs WHERE destination='lanyard:staff' AND namespace='lanyard.staff.csv.v1' AND mapping_version='staff-csv-v1' AND principal_id=? ORDER BY rowid DESC LIMIT 30").bind(who.id).all() : null])
  return { ...snap, agentKeys: keys, clockBrowsers: browsers, importJobs: jobs ? jobs.results : [] }
}

async function execute(request: Request, env: Bindings, who: Actor, name: string, input: Record<string, unknown>) {
  if (name.startsWith('agent.') || name === 'staff.invite') return credentialCommand(request, env, who, name, input)
  if (name.startsWith('import.')) return importCommand(env.DB, who, name, input)
  if (name.startsWith('clockbrowser.')) return clockBrowserCommand(env, who, name, input)
  // CLOCK-007: a punch carries its network identity (edge client IP and enrolled-browser cookie).
  return command(env.DB, who, name, input, env.SESSION_SECRET, name === 'clock.in' || name === 'clock.out' ? await networkOf(request, env) : undefined, env.FILES)
}

/** CLOCK-007: an enrolment's token goes only into this response's HttpOnly cookie, never into the page or JSON. */
function withClockCookie(response: Response, result: unknown) {
  const token = (result as { token?: string } | null)?.token
  if (token) response.headers.append('set-cookie', clockCookie(token))
  return response
}

async function inputBody(request: Request): Promise<Record<string, unknown>> {
  // JOURNAL-001 keeps its 1 MB attachment; LOG-001 accepts five 10 MB files.
  if (request.headers.get('content-type')?.includes('multipart/form-data')) {
    const log = new URL(request.url).searchParams.get('name') === 'log.save', maxFile = log ? 10_000_000 : 1_000_000
    if (Number(request.headers.get('content-length') ?? 0) > (log ? 50_100_000 : 1_500_000)) fail('Request is too large', 413)
    const form = await request.formData(), input: Record<string, unknown> = {}
    for (const [key, value] of form) {
      if (typeof value === 'string') input[key] = key === 'mentions' ? [...((input[key] as string[] | undefined) ?? []), value] : value
      else if (value.size) {
        if (value.size > maxFile) fail(log ? 'Attachments are 10 MB at most' : 'Attachments are 1 MB at most', 413)
        if (log && (key !== 'attachments' || ((input.attachments as unknown[] | undefined)?.length ?? 0) >= 5)) fail('Provide at most five attachments', 400)
        if (log) { input.attachments = [...((input.attachments as unknown[] | undefined) ?? []), { name: value.name || 'attachment', type: value.type || 'application/octet-stream', blob: value }]; continue }
        const bytes = new Uint8Array(await value.arrayBuffer()), chunks: string[] = []
        for (let i = 0; i < bytes.length; i += 8192) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)))
        const file = { name: value.name || 'attachment', type: value.type || 'application/octet-stream', data: btoa(chunks.join('')) }
        input[key] = file
      }
    }
    if ('revision' in input) input.revision = Number(input.revision)
    return input
  }
  const raw = await request.text()
  if (new TextEncoder().encode(raw).length > 200_000) fail('Request is too large', 413)
  if (request.headers.get('content-type')?.includes('application/json')) {
    let input; try { input = JSON.parse(raw) } catch { fail('Invalid JSON') }
    if (!input || Array.isArray(input) || typeof input !== 'object') fail('Expected an object')
    return input
  }
  if (!request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) fail('Use JSON or a form', 415)
  const params = new URLSearchParams(raw), input: Record<string, unknown> = Object.fromEntries(params)
  if (params.has('days')) input.days = params.getAll('days')
  if (params.has('hidden')) input.hidden = params.getAll('hidden')
  if (params.has('flags')) input.flags = params.getAll('flags')
  if (params.has('pool')) input.pool = params.getAll('pool')
  if (params.has('ranking')) input.ranking = params.getAll('ranking')
  if (params.has('mentions')) input.mentions = params.getAll('mentions')
  // CONTACT-001: the form's rows of name, relationship and phone; blank rows are dropped.
  if (params.has('contactName')) {
    const names = params.getAll('contactName'), relations = params.getAll('contactRelationship'), phones = params.getAll('contactPhone')
    input.contacts = names.map((name, i) => ({ name, relationship: relations[i] ?? '', phone: phones[i] ?? '' })).filter(x => x.name || x.relationship || x.phone)
    for (const key of ['contactName', 'contactRelationship', 'contactPhone']) delete input[key]
  }
  for (const key of ['revision', 'breakMinutes']) if (key in input) input[key] = Number(input[key])
  for (const key of ['shifts', 'ids', 'items']) if (input[key]) { try { input[key] = JSON.parse(String(input[key])) } catch { fail(`Invalid ${key}`) } }
  if ('active' in input) input.active = input.active === 'on' || input.active === 'true' || input.active === '1'
  return input
}

export async function lanyardResponse(request: Request, original: Bindings): Promise<Response | null> {
  const url = new URL(request.url), path = url.pathname
  if (!path.startsWith('/api/lanyard/') && path !== '/app' && !path.startsWith('/app/')) return null
  const env = runtimeBindings(original), isAgent = path.startsWith('/api/lanyard/agent/')
  let who: Actor | undefined
  const back = returnTo(url.searchParams.get('returnTo'))
  try {
    if (url.origin !== env.AUTH_ORIGIN || (request.headers.has('host') && request.headers.get('host') !== url.host)) fail('Wrong application origin', 403)
    if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed' }, 405)
    // Bearer-only agent routes have no ambient browser authority. Human mutations require Origin.
    if (request.method === 'POST' && !isAgent && (request.headers.get('origin') !== env.AUTH_ORIGIN || request.headers.get('sec-fetch-site') === 'cross-site')) fail('Cross-site request refused', 403)
    // The schedule was called the roster; old links keep working.
    if (path === '/app/roster' && request.method === 'GET') return new Response(null, { status: 301, headers: { ...headers, location: '/app/schedule' + url.search } })
    who = await principal(request, env, isAgent)
    if (request.method === 'GET') {
      if (pages.has(path)) return renderApp(await state(env, who), path + url.search)
      // CONTACT-001: the audited emergency contact card, as a screen and as JSON.
      const card = path.match(/^\/(app|api\/lanyard)\/contacts\/([\w-]+)$/)
      if (card?.[1] === 'app') { const contactCard = await contactRead(env.DB, who, card[2]); return renderApp(await state(env, who), path, { result: { contactCard } }) }
      if (card) return json(await contactRead(env.DB, who, card[2]))
      if (path === '/api/lanyard/state' || path === '/api/lanyard/agent/context') return json(await state(env, who))
      const file = path.match(/^\/api\/lanyard\/batches\/([\w-]+)\.csv$/)
      if (file) return new Response(await batchCsv(env.DB, who, file[1]), { headers: { ...headers, 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="lanyard-${file[1]}.csv"` } })
      if (path === '/api/lanyard/intervals' || path === '/app/intervals') {
        const report = await intervalsRead(env.DB, who, url.searchParams.get('site') ?? '', url.searchParams.get('date') ?? '', Number(url.searchParams.get('size') ?? 60))
        return path === '/app/intervals' ? renderApp(await state(env, who), path + url.search, { result: { report } }) : json(report)
      }
      const ruled = path.match(/^\/api\/lanyard\/autorules\/([\w-]+)\/preview$/)
      if (ruled) return json(await autoRulePreview(env.DB, who, ruled[1]))
      if (path === '/api/lanyard/sales') return json(await salesRead(env.DB, who, url.searchParams.get('week') ?? '', url.searchParams.get('site') ?? ''))
      if (path === '/api/lanyard/dashboard') return json(await dashboardRead(env.DB, who, url.searchParams.get('asOf') ?? new Date().toISOString().replace(/\.\d+Z$/, 'Z'), url.searchParams.get('site') ?? ''))
      if (path === '/api/lanyard/logbook') return json(await logbookRead(env.DB, who, 'search', '', { site: url.searchParams.get('site') ?? '', category: url.searchParams.get('category') ?? '', month: url.searchParams.get('month') ?? '' }))
      const logged = path.match(/^\/api\/lanyard\/logbook\/([\w-]+)\/(export|files\/([\w-]+))$/)
      if (logged && logged[2] === 'export') { const { name, body } = await logbookRead(env.DB, who, 'export', logged[1]) as { name: string; body: string }; return new Response(body, { headers: { ...headers, 'content-type': 'text/plain; charset=utf-8', 'content-disposition': `attachment; filename="${name}"` } }) }
      if (logged) { const { bytes, name, type } = await logbookRead(env.DB, who, 'file', logged[1], { fileId: logged[3] }, env.FILES) as { bytes: Uint8Array<ArrayBuffer>; name: string; type: string }; return new Response(bytes, { headers: { ...headers, 'content-type': type, 'content-disposition': `attachment; filename="${name.replace(/[^\w. -]/g, '_')}"`, 'x-content-type-options': 'nosniff' } }) }
      const attached = path.match(/^\/api\/lanyard\/notes\/([\w-]+)\/files\/([\w-]+)$/)
      if (attached) { const { bytes, name, type } = await noteAttachment(env.DB, who, attached[1], attached[2]); return new Response(bytes, { headers: { ...headers, 'content-type': type, 'content-disposition': `attachment; filename="${name.replace(/[^\w. -]/g, '_')}"`, 'x-content-type-options': 'nosniff' } }) }
      if (path === '/api/lanyard/overtime') return json(await overtimeAlerts(env.DB, who, url.searchParams.get('week') ?? '', url.searchParams.get('asOf') ?? new Date().toISOString().replace(/\.\d+Z$/, 'Z')))
      if (path === '/api/lanyard/attendance') return json(await attendanceBoard(env.DB, who, url.searchParams.get('asOf') ?? new Date().toISOString().replace(/\.\d+Z$/, 'Z'), url.searchParams.get('site') ?? ''))
      const story = path.match(/^\/api\/lanyard\/shifts\/([\w-]+)\/history$/)
      if (story) return json(await scheduleHistory(env.DB, who, 'shift', story[1]))
      const weekly = path.match(/^\/api\/lanyard\/weeks\/(\d{4}-\d{2}-\d{2})\/(compare|changes\.csv)$/)
      if (weekly?.[2] === 'compare') return json(await scheduleHistory(env.DB, who, 'compare', weekly[1], url.searchParams.get('from') ?? '', url.searchParams.get('to') ?? ''))
      if (weekly) return new Response(await scheduleHistory(env.DB, who, 'log', weekly[1]) as string, { headers: { ...headers, 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="lanyard-changes-${weekly[1]}.csv"` } })
      const printed = path.match(/^\/api\/lanyard\/postings\/([\w-]+)\.pdf$/)
      if (printed) { const { bytes, name } = await schedulePdf(env.DB, who, printed[1]); return new Response(bytes, { headers: { ...headers, 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${name}"` } }) }
    } else {
      if (path === '/app/action') {
        const input = await inputBody(request), name = url.searchParams.get('name') ?? ''
        if (name === 'staff.save' && !('active' in input)) input.active = false
        const result = await execute(request, env, who, name, input), { token, ...shown } = result as Record<string, unknown>
        return withClockCookie(await renderApp(await state(env, who), back, { message: 'Saved.', result: name === 'import.preview' || name === 'sales.preview' ? { ...shown, csv: input.csv, mapping: input.mapping, site: input.site } : name.startsWith('clockbrowser.') ? shown : result }), name.startsWith('clockbrowser.') ? result : null)
      }
      if (path === '/api/lanyard/command' || path === '/api/lanyard/agent/command') {
        const body = await inputBody(request)
        if (typeof body.name !== 'string' || !body.input || typeof body.input !== 'object' || Array.isArray(body.input)) fail('Provide a command name and input object')
        if (isAgent && !['roster.prepare', 'time.prepare', 'payroll.prepare'].includes(String(body.name))) fail('Agents can only prepare drafts', 403)
        const result = await execute(request, env, who, String(body.name), body.input as Record<string, unknown>)
        if (String(body.name).startsWith('clockbrowser.')) { const { token, ...shown } = result as Record<string, unknown>; return withClockCookie(json(shown), result) }
        return json(result)
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
