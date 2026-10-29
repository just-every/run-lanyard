import { operatorAuthPeople, ToolRefusal, type PeopleAdapter, type Person, type ToolContext, type ResourceContext } from '../../modules/agent-door/index.ts'
import { operatorAuth, type Bindings } from '../../auth.server'
import { actor, type Actor } from '../domain'
import { localAgentKey } from '../credentials'

export function people(env: Bindings): PeopleAdapter {
 const operators = operatorAuthPeople({db: env.DB, session: request => operatorAuth(env).getSession(request)})
 const current = async (id: string): Promise<Person | null> => {
  const p = await operators.person(id)
  if (!p?.active) return null
  try {
   const a = await actor(env.DB, {userId: p.id, email: p.email, isOwner: p.role === 'owner'})
   return {...p, role: a.role}
  } catch { return null }
 }
 return {
  person: current,
  async sponsor(claims) { const p = await operators.sponsor(claims); return p ? current(p.id) : null },
  async session(request) { const p = await operators.session(request); return p ? current(p.id) : null },
  businessMember: p => operators.businessMember!(p),
 }
}

export async function localCredentials(request: Request, env: Bindings) {
 const k = await localAgentKey(request, env)
 if (!k) return null
 return {sponsor: {id: k.owner_id}, agent: {id: 'lanyard-key:' + k.id, name: k.label, specialist: 'workforce coordinator'}, clientId: k.id,
  scopes: ['workforce:read', 'workforce:prepare', ...JSON.parse(k.scopes_json)]}
}

export async function preparationActor(ctx: ToolContext | ResourceContext): Promise<Actor> {
 const p = ctx.person
 const row = await ctx.db.prepare("SELECT id,email,version FROM oa_operators WHERE id=? AND role='owner' AND status='active'").bind(p.id).first<{id: string; email: string; version: number}>()
 if (!row || p.role !== 'owner') throw new ToolRefusal('native_authority_required')
 return {id: row.id, email: row.email, role: 'agent', isOwner: true, ownerVersion: row.version, ...(!ctx.consent && ctx.clientId ? {agentKeyId:ctx.clientId}:{}),
  ...('approvers' in ctx ? {delegation: {agentId: ctx.agent.id, agentName: ctx.agent.name, sponsorName: p.name, operationId: ctx.operationId, approvers: ctx.approvers.map(a => ({...a}))}} : {})}
}

export async function comparisonActor(ctx: ToolContext | ResourceContext, site: string): Promise<Actor> {
 const a = await preparationActor(ctx)
 // A signed Business consent cannot borrow a local key's private grant. It
 // needs an additional, explicit owner consent to company-agent use.
 const key = await ctx.db.prepare(`SELECT k.id FROM l_agent_keys k JOIN oa_operators o ON o.id=k.owner_id
  WHERE k.owner_id=? AND k.revoked_at IS NULL AND k.expires_at>? AND o.status='active' AND o.role='owner' AND o.version=k.owner_version
  AND EXISTS(SELECT 1 FROM json_each(k.scopes_json) WHERE value='comparison.read')
  AND EXISTS(SELECT 1 FROM json_each(k.cafes_json) WHERE value=?)
  AND ${ctx.consent ? 'k.company_agents=1' : 'k.id=?'} ORDER BY k.id LIMIT 1`).bind(a.id, Date.now(), site, ...(ctx.consent ? [] : [ctx.clientId ?? ''])).first<{id: string}>()
 if (!key) throw new ToolRefusal('resource_unavailable')
 return {...a, agentKeyId: key.id}
}
