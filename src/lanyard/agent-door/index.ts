import { createAgentDoor, type Trust, type AgentDoor } from '../../modules/agent-door/index.ts'
import { businessSettings, runtimeBindings, type Bindings } from '../../auth.server'
import { people, localCredentials, LOCAL_KEY_SCOPE } from './people.ts'
import { tools } from './tools.ts'
import { resources } from './records.ts'
import { legacy } from './legacy.ts'
import { capabilities, discoveryInstructions, limits, prompts, specialist } from './catalogue.ts'

export function agentDoor(env: Bindings): AgentDoor {
 const keys = env.RER_OWNER_CLAIM_PUBLIC_KEYS
 let trust: Trust | null = null
 if (keys || env.RER_OWNER_CLAIM_ISSUER || env.RER_OWNER_CLAIM_INSTALLATION_ID) {
  if (!keys || !env.RER_OWNER_CLAIM_ISSUER || !env.RER_OWNER_CLAIM_INSTALLATION_ID) throw new Error('Incomplete installation trust')
  trust = {issuer: env.RER_OWNER_CLAIM_ISSUER, installationId: env.RER_OWNER_CLAIM_INSTALLATION_ID, appOrigin: env.AUTH_ORIGIN, publicKeys: JSON.parse(keys)}
 }
 return createAgentDoor({
  seed: 'lanyard', name: 'Lanyard', specialist, db: env.DB, origin: env.AUTH_ORIGIN, trust,
  capabilities, limits,
  people: people(env), tools: tools(env), resources,
  localCredentials: request => localCredentials(request, env),
  async currentScopes(principal) {
   if (principal.consent) return principal.scopes.filter(scope => scope !== LOCAL_KEY_SCOPE)
   const k = await env.DB.prepare(`SELECT k.scopes_json FROM l_agent_keys k JOIN oa_operators o ON o.id=k.owner_id
    WHERE k.id=? AND k.owner_id=? AND k.revoked_at IS NULL AND k.expires_at>? AND o.role='owner' AND o.status='active' AND o.version=k.owner_version`).bind(principal.clientId ?? '', principal.person.id, Date.now()).first<{scopes_json: string}>()
   return k && principal.agent.id === 'lanyard-key:' + principal.clientId ? [LOCAL_KEY_SCOPE,'workforce:read','workforce:prepare',...JSON.parse(k.scopes_json)] : []
  },
  notTools: [
   {clauses: ['ACCESS-001','TIME-001','CLOCK-001','CLOCK-002','CLOCK-003','CLOCK-005','CLOCK-007','MOBILE-001','MOBILE-002'], reason: 'device'},
   {clauses: ['MOVE-001','MIGRATE-001'], reason: 'import-door'},
   {clauses: ['ARCHIVE-001','PUBLIC-001','BASE-001'], reason: 'installation'},
   {clauses: ['GUSTO-001','ADP-001','PAYCHEX-001','QB-001','HR-001','POS-001','POS-002','POS-003','POS-004'], reason: 'connector'},
  ],
  prompts,
 })
}

export async function agentResponse(request: Request, original: Bindings): Promise<Response | null> {
 const env = runtimeBindings(original), path = new URL(request.url).pathname
 if (!path.startsWith('/agents') && path !== '/mcp' && !path.startsWith('/api/rer/') && !path.startsWith('/api/lanyard/agent/') && !path.startsWith('/.well-known/oauth-protected-resource') && !['/rer-business-logo','/rer-business.css'].includes(path)) return null
 const settings = await businessSettings(env).handle(request)
 if (settings) return settings
 const door = agentDoor(env)
 if (path.startsWith('/api/lanyard/agent/')) return legacy(request, door, env.AUTH_ORIGIN)
 const response = await door.handle(request)
 const method = request.headers.get('mcp-method')
 if (path !== '/mcp' || (method && ![["server","discover"].join('/'),'initialize'].includes(method)) || !response?.ok || !response.headers.get('content-type')?.includes('application/json')) return response
 const envelope = await response.clone().json<{result?: {instructions?: string}}>()
 if (typeof envelope.result?.instructions !== 'string') return response
 envelope.result.instructions += '\n\n' + discoveryInstructions()
 const headers = new Headers(response.headers)
 headers.delete('content-length')
 return new Response(JSON.stringify(envelope), {status: response.status, statusText: response.statusText, headers})
}
