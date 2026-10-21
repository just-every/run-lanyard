// The production HTTP/auth handlers, exercised on real workerd + D1.
import { authResponse, type Bindings } from '../src/auth.server'
import { installedHomeResponse } from '../src/installed-home'
import { lanyardResponse } from '../src/lanyard/http'
export default { async fetch(request: Request, env: Bindings) {
  // Test clock edge only: exercise the production credential expiry without database edits.
  const now=Date.now, testTime=request.headers.get('x-test-now')
  if(testTime!==null)Date.now=()=>Number(testTime)
  try { return await authResponse(request, env) ?? await lanyardResponse(request, env) ?? await installedHomeResponse(request, env) ?? new Response('Not found', { status: 404 }) } finally { if(testTime!==null)Date.now=now }
} }
