// The production HTTP/auth handlers, exercised on real workerd + D1.
import { authResponse, type Bindings } from '../src/auth.server'
import { lanyardResponse } from '../src/lanyard/http'
export default { async fetch(request: Request, env: Bindings) {
  return await authResponse(request, env) ?? await lanyardResponse(request, env) ?? new Response('Not found', { status: 404 })
} }
