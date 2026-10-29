// One live grant predicate for comparison, forecast reads and evidence-bound learning proposals.
import {type Actor,need} from './domain/model'

export const comparisonGrant = `SELECT k.id FROM l_agent_keys k JOIN oa_operators o ON o.id=k.owner_id
 WHERE k.id=? AND k.owner_id=? AND k.revoked_at IS NULL AND k.expires_at>?
 AND o.role='owner' AND o.status='active' AND o.version=k.owner_version
 AND EXISTS(SELECT 1 FROM json_each(k.scopes_json) WHERE value='comparison.read')
 AND EXISTS(SELECT 1 FROM json_each(k.cafes_json) WHERE value=?)`


export async function requireComparison(db:D1Database,a:Actor,site:string) {
 need(a.role==='agent'&&a.agentKeyId,'Preparation key required',403)
 const scope=await db.prepare("SELECT 1 FROM l_agent_keys WHERE id=? AND EXISTS(SELECT 1 FROM json_each(scopes_json) WHERE value='comparison.read')").bind(a.agentKeyId).first()
 need(scope,'comparison.read required',403)
 need(await db.prepare(comparisonGrant).bind(a.agentKeyId,a.id,Date.now(),site).first(),'Not found',404)
}
export async function recordComparisonRead(db:D1Database,a:Actor,site:string,subject:Record<string,unknown>) {
 const receipt=await db.prepare(`INSERT INTO l_events(id,actor_id,actor_role,action,entity_id,at,agent_id,agent_name,sponsor_name,operation_id)
 SELECT ?,?,'agent','comparison.read',?,?,?,?,?,? WHERE EXISTS(${comparisonGrant})`)
 .bind(crypto.randomUUID(),a.id,JSON.stringify({keyId:a.agentKeyId,site,...subject}),new Date().toISOString(),a.delegation?.agentId??null,a.delegation?.agentName??null,a.delegation?.sponsorName??null,a.delegation?.operationId??null,a.agentKeyId,a.id,Date.now(),site).run()
 need(receipt.meta.changes===1,'Agent credential expired or revoked',401)
}
