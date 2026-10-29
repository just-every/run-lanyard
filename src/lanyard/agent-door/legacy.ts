import type { AgentDoor } from '../../modules/agent-door/index.ts'

/** Compatibility translation only. Admission, policy, approvals, audit and
 * idempotency are implemented by the same production MCP door. */
export async function legacy(request: Request, door: AgentDoor): Promise<Response> {
 const url = new URL(request.url), headers = new Headers(request.headers)
 const reads: Record<string, string> = {'context': 'context.read', 'demand': 'demand.read', 'learning/proposals': 'learn.read', 'fairness/compare': 'tradeoff.compare'}
 const path = url.pathname.slice('/api/lanyard/agent/'.length)
 let name = reads[path], args: Record<string, unknown> = {}
 if (request.method === 'GET' && name) {
  for (const [key, value] of url.searchParams) if (['site','week','date','weeks'].includes(key)) args[key] = key === 'weeks' ? Number(value) : value
 } else if (request.method === 'POST' && path === 'command') {
  let body: any
  try {body = await request.json()} catch {return Response.json({code: 'invalid_arguments'}, {status: 400})}
  if (!body || typeof body.name !== 'string' || !body.input || typeof body.input !== 'object' || Array.isArray(body.input)) return Response.json({code: 'invalid_arguments'}, {status: 400})
  name = body.name
  if (!['roster.prepare','time.prepare','payroll.prepare','learn.propose'].includes(name)) return Response.json({code: 'native_authority_required', error: 'Agents may prepare drafts only; a human manager must approve'}, {status: 403})
  args = {...body.input, idempotency_key: request.headers.get('idempotency-key') ?? crypto.randomUUID()}
 } else return Response.json({code: 'not_found'}, {status: 404})
 headers.set('content-type','application/json');headers.set('accept','application/json')
 headers.set('mcp-protocol-version','2026-07-28');headers.set('mcp-method','tools/call');headers.set('mcp-name','lanyard.' + name);headers.delete('content-length')
 const response = await door.handle(new Request(url.origin + '/mcp', {method: 'POST', headers, body: JSON.stringify({jsonrpc: '2.0', id: 'legacy', method: 'tools/call', params: {name: 'lanyard.' + name, arguments: args, _meta: {'io.modelcontextprotocol/protocolVersion':'2026-07-28'}}})}))
 if (!response) return Response.json({code: 'door_unavailable'}, {status: 503})
 const body = await response.json() as any, result = body.result
 if (body.error || result?.isError || result?.resultType === 'input_required') {
  const meta = result?._meta?.['com.runeditrun/error'], code = body.error?.data?.code ?? meta?.code ?? (typeof meta === 'string' ? meta : result?.resultType === 'input_required' ? 'approval_required' : 'tool_refused')
  return Response.json({code, ...(result?._meta?.['com.runeditrun/approval'] ? {approval: result._meta['com.runeditrun/approval']} : {})}, {status: response.status >= 400 ? response.status : code === 'resource_unavailable' ? 404 : code === 'native_conflict' ? 409 : 403})
 }
 return Response.json(result?.structuredContent, {headers: {'cache-control':'no-store'}})
}
