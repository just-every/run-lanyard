import { lobbyResponse } from './base/lobby'
import { claimedWhen, setupStateResponse } from './base/setup-state'
import { runtimeBindings, type Bindings } from './auth.server'
import { identity } from './identity'

// Claiming the owner and confirming their first-run review are separate steps.
// The public Lobby reads the durable claim, as the installed-home contract requires.
const ownerClaimed = claimedWhen('SELECT 1 FROM oa_bootstrap WHERE singleton = 1')

export async function installedHomeResponse(request: Request, bindings: Bindings): Promise<Response | null> {
  const env = runtimeBindings(bindings)
  return await setupStateResponse(request, env, ownerClaimed)
    ?? await lobbyResponse(request, env, identity, ownerClaimed)
}
