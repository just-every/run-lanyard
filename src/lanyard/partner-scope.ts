import {type Actor,need} from './domain/model'

export const partnerVersion = 'v1'
export const partnerScope = 'roster.prepare'
export const partnerGrant = `SELECT 1 FROM l_partner_keys k JOIN oa_operators o ON o.id=k.owner_id
 WHERE k.id=? AND k.owner_id=? AND k.site=? AND k.api_version=? AND k.scope='roster.prepare'
 AND k.revoked_at IS NULL AND k.expires_at>? AND o.role='owner' AND o.status='active' AND o.version=k.owner_version`

/** Recheck before any saved response, and again inside the draft's atomic commit. */
export async function currentPartner(db:D1Database,a:Actor) {
 const p=a.partner
 need(p&&await db.prepare(partnerGrant).bind(p.keyId,a.id,p.site,p.version,Date.now()).first(),'Partner credential expired, changed or revoked',401)
}
