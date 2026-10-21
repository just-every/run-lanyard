import { operatorAuth, type Bindings } from '../auth.server'
import { actor, type Actor } from './domain'

export const fail = (message: string, status = 400): never => { throw Object.assign(new Error(message), { status }) }
const hash = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2, '0')).join('')

export async function principal(request: Request, env: Bindings, agent = false): Promise<Actor> {
  if (agent) {
    const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1]
    if (!token || token.length > 200) fail('Agent credential required', 401)
    const key = await env.DB.prepare(`SELECT k.*, o.email FROM l_agent_keys k JOIN oa_operators o ON o.id=k.owner_id
      WHERE k.token_hash=? AND k.revoked_at IS NULL AND k.expires_at>? AND o.role='owner' AND o.status='active' AND o.version=k.owner_version`).bind(await hash(token!), Date.now()).first<any>()
    if (!key) fail('Agent credential expired or revoked', 401)
    return { id: key.owner_id, email: key.email, role: 'agent', isOwner: true, agentKeyId: key.id }
  }
  const session = await operatorAuth(env).getSession(request)
  if (!session) fail('Sign in to continue', 401)
  // The account's own name (set at /setup or in sign-in settings) names the top bar's avatar when no staff record does.
  return { ...await actor(env.DB, { userId: session!.operator.id, email: session!.operator.email, isOwner: session!.operator.role === 'owner' }), name: session!.operator.displayName, ownerVersion: session!.operator.version }
}

export async function agentKeys(env: Bindings, who: Actor) {
  if (who.role !== 'owner') return []
  return (await env.DB.prepare('SELECT id,label,scopes_json AS scopes,cafes_json AS cafes,created_at AS createdAt,expires_at AS expiresAt,revoked_at AS revokedAt FROM l_agent_keys WHERE owner_id=? ORDER BY created_at DESC').bind(who.id).all<any>()).results.map(k => ({ ...k, scopes: JSON.parse(k.scopes), cafes: JSON.parse(k.cafes) }))
}

export async function credentialCommand(request: Request, env: Bindings, who: Actor, name: string, input: Record<string, unknown>) {
  if (who.role !== 'owner') fail('Only the owner manages access', 403)
  if (name === 'agent.create') {
    const label = String(input.label ?? '').trim()
    if (!label || label.length > 80) fail('Enter a label of at most 80 characters')
    const scopes = input.scopes ?? [], cafes = input.cafes ?? []
    if (!Array.isArray(scopes) || scopes.some(v => v !== 'comparison.read') || scopes.length > 1) return fail('Unknown preparation key scope')
    if (!Array.isArray(cafes) || cafes.length > 100 || cafes.some(v => typeof v !== 'string' || !v.trim() || v !== v.trim() || v.length > 80 || /[\u0000-\u001f\u007f]/.test(v) || v === '*')) return fail('Choose named cafes')
    if (scopes.length) {
      if (input.comparisonConsent !== true) fail('Consent to the repeated aggregate cost disclosure before granting comparison.read')
      if (!cafes.length || new Set(cafes).size !== cafes.length) fail('Choose at least one distinct named cafe')
      const known = (await env.DB.prepare('SELECT DISTINCT site FROM l_staff WHERE erased_at IS NULL').all<any>()).results.map(p => p.site)
      if (cafes.some(v => !known.includes(v))) fail('Choose existing named cafes')
    } else if (cafes.length || input.comparisonConsent) fail('Cafe limits and consent require comparison.read')
    const requestId = input.requestId === undefined ? null : String(input.requestId)
    if (requestId !== null && !/^[A-Za-z0-9-]{8,80}$/.test(requestId)) fail('Invalid credential creation request')
    const digest = await hash(JSON.stringify({label,scopes,cafes,comparisonConsent:input.comparisonConsent===true}))
    if (requestId) {
      const previous = await env.DB.prepare('SELECT id,expires_at,create_digest FROM l_agent_keys WHERE owner_id=? AND create_request_id=?').bind(who.id,requestId).first<any>()
      if (previous) {
        if (previous.create_digest !== digest) fail('Credential creation request already used for different input',409)
        // The clear credential is never stored or returned again on a POST reload.
        return {id:previous.id,expiresAt:previous.expires_at,scopes,cafes}
      }
    }
    const id = crypto.randomUUID(), token = 'lanyard_' + crypto.randomUUID() + crypto.randomUUID(), at = Date.now()
    const created = await env.DB.prepare(`INSERT INTO l_agent_keys(id,owner_id,owner_version,label,token_hash,created_at,expires_at,scopes_json,cafes_json,create_request_id,create_digest)
      SELECT ?,id,version,?,?,?,?,?,?,?,? FROM oa_operators WHERE id=? AND role='owner' AND status='active' AND version=? ON CONFLICT(owner_id,create_request_id) DO NOTHING`).bind(id, label, await hash(token), at, at + 30 * 86400_000, JSON.stringify(scopes), JSON.stringify(cafes), requestId, digest, who.id, who.ownerVersion).run()
    if (created.meta.changes !== 1) fail('Owner authority changed; sign in again', 409)
    return { id, token, expiresAt: at + 30 * 86400_000, scopes, cafes }
  }
  if (name === 'agent.revoke') {
    await env.DB.prepare('UPDATE l_agent_keys SET revoked_at=? WHERE id=? AND owner_id=?').bind(Date.now(), String(input.id ?? ''), who.id).run()
    return { revoked: true }
  }
  if (name === 'staff.invite') {
    const staff = await env.DB.prepare('SELECT * FROM l_staff WHERE id=? AND active=1 AND erased_at IS NULL').bind(String(input.id ?? '')).first<any>()
    if (!staff) fail('Activate the staff record before inviting them', 409)
    await operatorAuth(env).invite(request, { email: staff.email, displayName: staff.name, role: 'member', returnTo: '/app' })
    return { invited: true }
  }
  fail('Unknown access command', 404)
}
