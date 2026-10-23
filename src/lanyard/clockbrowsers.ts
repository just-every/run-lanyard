// CLOCK-007 enrolled browsers: the owner enrols the store computer's browser as a cafe's web
// time clock. Its token lives only in an HttpOnly cookie; D1 keeps the SHA-256, the table is
// excluded from archives, and enrolment and revocation are recorded as activity.
import { type Bindings } from '../auth.server'
import { type Actor } from './domain'
import { type Net } from './domain/clocknets'
import { fail } from './credentials'

export const COOKIE = '__Host-lanyard-clock'
const hash = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2, '0')).join('')
const tokenOf = (request: Request) => request.headers.get('cookie')?.split(/;\s*/).find(v => v.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1) ?? ''
const audit = (env: Bindings, who: Actor, action: string, id: string) => env.DB.prepare('INSERT INTO l_events(id,actor_id,actor_role,action,entity_id,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(), who.id, who.role, action, id, new Date().toISOString())

/** The punch's network identity: the edge-reported client IP and the cafes this browser is enrolled for. */
export async function networkOf(request: Request, env: Bindings): Promise<Net> {
  const token = tokenOf(request), ip = request.headers.get('CF-Connecting-IP') ?? ''
  const browsers = token && token.length <= 200 ? (await env.DB.prepare('SELECT id,site,device_type AS type FROM l_clock_browsers WHERE token_hash=? AND revoked_at IS NULL').bind(await hash(token)).all<{ id: string; site: string; type: string }>()).results : []
  return { ip, browsers }
}
export async function clockBrowsers(env: Bindings, who: Actor) {
  if (who.role !== 'owner') return []
  return (await env.DB.prepare('SELECT id,site,label,device_type AS type,created_at AS createdAt,revoked_at AS revokedAt FROM l_clock_browsers ORDER BY created_at DESC').all()).results
}
/** Owner only. Enrol returns the token once, for the response's cookie; it is never stored or shown. */
export async function clockBrowserCommand(env: Bindings, who: Actor, name: string, input: Record<string, unknown>): Promise<{ id: string; token?: string }> {
  if (who.role !== 'owner') fail('Owner required', 403)
  if (name === 'clockbrowser.enroll') {
    const site = String(input.site ?? '').trim(), label = String(input.label ?? '').trim()
    if (site.length > 80 || !label || label.length > 80) fail('Enter a label of at most 80 characters for this browser')
    const type=input.type??'browser'
    if(!['phone','browser'].includes(String(type)))fail('Choose an owner-classified phone or browser clock')
    const id = crypto.randomUUID(), bytes = crypto.getRandomValues(new Uint8Array(32)), token = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
    await env.DB.batch([env.DB.prepare('INSERT INTO l_clock_browsers(id,site,label,token_hash,enrolled_by,created_at,device_type) VALUES(?,?,?,?,?,?,?)').bind(id, site, label, await hash(token), who.id, new Date().toISOString(),type), audit(env, who, name, id)])
    return { id, token }
  }
  if (name === 'clockbrowser.revoke') {
    const id = String(input.id ?? ''), r = await env.DB.prepare('UPDATE l_clock_browsers SET revoked_at=? WHERE id=? AND revoked_at IS NULL').bind(new Date().toISOString(), id).run()
    if (!r.meta.changes) fail('Browser not found or already revoked', 404)
    await audit(env, who, name, id).run()
    return { id }
  }
  return fail('Unknown command', 404)
}
export const clockCookie = (token: string) => `${COOKIE}=${token}; Path=/; Max-Age=34560000; HttpOnly; Secure; SameSite=Strict`
