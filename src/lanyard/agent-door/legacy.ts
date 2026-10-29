import type { AgentDoor } from '../../modules/agent-door/index.ts'

/** Compatibility translation only. Admission, policy, approvals, audit and
 * idempotency are implemented by the same production MCP door. */
export async function legacy(request: Request, door: AgentDoor, origin: string): Promise<Response> {
 const url = new URL(request.url), headers = new Headers(request.headers)
 if (url.origin !== origin || (headers.has('host') && headers.get('host') !== url.host)) return Response.json({code:'origin_refused'},{status:403})
 const reads: Record<string, string> = {'context': 'context.read', 'demand': 'demand.read', 'learning/proposals': 'learn.read', 'fairness/compare': 'tradeoff.compare'}
 const path = url.pathname.slice('/api/lanyard/agent/'.length)
 let unsupported = false
 let name = reads[path], args: Record<string, unknown> = {}
 if (request.method === 'GET' && name) {
  for (const [key, value] of url.searchParams) if (['site','week','date','weeks'].includes(key)) args[key] = key === 'weeks' ? Number(value) : value
 } else if (request.method === 'POST' && path === 'command') {
  let body: any
  if (Number(headers.get('content-length')) > 200000) return Response.json({code:'body_too_large'},{status:413})
  const reader=request.body?.getReader(),chunks:Uint8Array[]=[];let size=0
  if(reader)for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>200000){await reader.cancel();return Response.json({code:'body_too_large'},{status:413})}chunks.push(chunk.value)}
  const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.byteLength}
  try {body = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))} catch {return Response.json({code: 'invalid_arguments'}, {status: 400})}
  if (!body || typeof body.name !== 'string' || !body.input || typeof body.input !== 'object' || Array.isArray(body.input)) return Response.json({code: 'invalid_arguments'}, {status: 400})
  name = /^[a-z][a-z0-9_]*(?:\.[a-z][a-zA-Z0-9_]*)+$/.test(body.name) ? body.name : 'native.unsupported'
  unsupported = !['roster.prepare','time.prepare','payroll.prepare','learn.propose'].includes(name)
  args = {...body.input, idempotency_key: request.headers.get('idempotency-key') ?? crypto.randomUUID()}
 } else return Response.json({code: 'not_found'}, {status: 404})
 headers.set('content-type','application/json');headers.set('accept','application/json')
 headers.set('mcp-protocol-version','2026-07-28');headers.set('mcp-method','tools/call');headers.set('mcp-name','lanyard.' + name);headers.delete('content-length')
 const response = await door.handle(new Request(url.origin + '/mcp', {method: 'POST', headers, body: JSON.stringify({jsonrpc: '2.0', id: 'legacy', method: 'tools/call', params: {name: 'lanyard.' + name, arguments: args, _meta: {'io.modelcontextprotocol/protocolVersion':'2026-07-28'}}})}))
 if (!response) return Response.json({code: 'door_unavailable'}, {status: 503})
 const body = await response.json() as any, result = body.result
 if (body.error || result?.isError || result?.resultType === 'input_required') {
  if (unsupported && response.status === 400) return Response.json({code:'native_authority_required',error:'Agents may prepare drafts only; a human manager must approve'},{status:403})
  const meta = result?._meta?.['com.runeditrun/error'], rawCode = body.error?.data?.code ?? meta?.code ?? (typeof meta === 'string' ? meta : result?.resultType === 'input_required' ? 'approval_required' : 'tool_refused')
  const hiddenScope = path === 'fairness/compare' && rawCode === 'insufficient_scope', code = hiddenScope ? 'resource_unavailable' : rawCode
  return Response.json({code, ...(result?._meta?.['com.runeditrun/approval'] ? {approval: result._meta['com.runeditrun/approval']} : {})}, {status: hiddenScope ? 404 : response.status >= 400 ? response.status : code === 'resource_unavailable' ? 404 : ['native_conflict','idempotency_conflict','revision_conflict'].includes(code) ? 409 : ['invalid_arguments','idempotency_key_required'].includes(code) ? 400 : 403})
 }
 return Response.json(result?.structuredContent, {headers: {'cache-control':'no-store'}})
}
