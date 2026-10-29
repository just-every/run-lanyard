import {type Actor,keys,need,sha,text} from './domain/model'
import {partnerVersion,partnerScope} from './partner-scope'

const summary = (k:any) => ({id:k.id,label:k.label,site:k.site,scope:k.scope,apiVersion:k.api_version,createdAt:k.created_at,expiresAt:k.expires_at,revokedAt:k.revoked_at})
export async function partnerKeys(db:D1Database,a:Actor) {
 if(a.role!=='owner')return []
 return (await db.prepare('SELECT id,label,site,scope,api_version,created_at,expires_at,revoked_at FROM l_partner_keys WHERE owner_id=? ORDER BY created_at DESC,id').bind(a.id).all()).results.map(summary)
}

export async function partnerPrincipal(request:Request,db:D1Database,version:string):Promise<Actor> {
 need(version===partnerVersion,'Unknown partner API version',404)
 const token=request.headers.get('authorization')?.match(/^Bearer (\S{1,200})$/)?.[1]
 need(token,'Partner credential required',401)
 const k=await db.prepare(`SELECT k.*,o.email FROM l_partner_keys k JOIN oa_operators o ON o.id=k.owner_id
  WHERE k.token_hash=? AND k.api_version=? AND k.scope=? AND k.revoked_at IS NULL AND k.expires_at>?
  AND o.role='owner' AND o.status='active' AND o.version=k.owner_version`).bind(await sha(token!),version,partnerScope,Date.now()).first<any>()
 need(k,'Partner credential expired, changed or revoked',401)
 return {id:k.owner_id,email:k.email,role:'agent',isOwner:true,partner:{keyId:k.id,site:k.site,version}}
}

export async function partnerCredentialCommand(db:D1Database,a:Actor,name:string,input:Record<string,unknown>) {
 need(a.role==='owner','Only the owner manages partner access',403)
 const now=Date.now(),id=text(input.id,'id',80,true)
 if(name==='partner.revoke') {
  keys(input,['id'])
  const result=await db.batch([
   db.prepare(`UPDATE l_partner_keys SET revoked_at=COALESCE(revoked_at,?) WHERE id=? AND owner_id=?
    AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active' AND version=?)`).bind(now,id,a.id,a.id,a.ownerVersion),
   db.prepare(`INSERT INTO l_events(id,actor_id,actor_role,action,entity_id,at)
    SELECT ?,?,'owner',?,?,? WHERE changes()=1`).bind(crypto.randomUUID(),a.id,name,id,new Date(now).toISOString())
  ])
  need(result[0].meta.changes===1,'Credential or owner authority changed; reload before retrying',409)
  return {revoked:true}
 }
 need(name==='partner.create'||name==='partner.rotate','Unknown partner access command',404)
 keys(input,name==='partner.rotate'?['id','requestId']:['label','site','requestId'])
 const requestId=text(input.requestId,'requestId',80)
 need(/^[A-Za-z0-9-]{8,80}$/.test(requestId),'Invalid credential creation request')
 const old=name==='partner.rotate'?await db.prepare('SELECT * FROM l_partner_keys WHERE id=? AND owner_id=?').bind(id,a.id).first<any>():null
 if(name==='partner.rotate')need(old,'Partner credential not found',404)
 const label=old?.label??text(input.label,'label',80),site=old?.site??text(input.site,'site',80)
 const digest=await sha(JSON.stringify({name,id,label,site}))
 const previous=await db.prepare('SELECT * FROM l_partner_keys WHERE owner_id=? AND create_request_id=?').bind(a.id,requestId).first<any>()
 if(previous){need(previous.create_digest===digest,'Credential creation request already used for different input',409);return summary(previous)}
 need(!old?.revoked_at,'Credential already revoked; reload before retrying',409)
 need(await db.prepare('SELECT 1 FROM l_staff WHERE site=? AND active=1 AND erased_at IS NULL').bind(site).first(),'Choose an existing cafe with active staff')
 const next=crypto.randomUUID(),token='lanyard_partner_'+crypto.randomUUID()+crypto.randomUUID(),guard=crypto.randomUUID(),expires=now+30*86400_000
 const q=[db.prepare(`INSERT INTO l_guard(id,ok) VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active' AND version=?) THEN 1 ELSE 0 END)`).bind(guard,a.id,a.ownerVersion)]
 if(old)q.push(db.prepare(`INSERT INTO l_guard(id,ok) VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM l_partner_keys WHERE id=? AND owner_id=? AND revoked_at IS NULL) THEN 1 ELSE 0 END)`).bind(crypto.randomUUID(),old.id,a.id))
 q.push(db.prepare(`INSERT INTO l_partner_keys(id,owner_id,owner_version,label,token_hash,site,scope,api_version,created_at,expires_at,create_request_id,create_digest,rotates_id)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(next,a.id,a.ownerVersion,label,await sha(token),site,partnerScope,partnerVersion,now,expires,requestId,digest,old?.id??null))
 if(old)q.push(db.prepare('UPDATE l_partner_keys SET revoked_at=? WHERE id=? AND owner_id=? AND revoked_at IS NULL').bind(now,old.id,a.id))
 q.push(db.prepare("INSERT INTO l_events(id,actor_id,actor_role,action,entity_id,at) VALUES(?,?,'owner',?,?,?)").bind(crypto.randomUUID(),a.id,name,next,new Date(now).toISOString()),db.prepare('DELETE FROM l_guard'))
 try{await db.batch(q)}catch(error){
  const replay=await db.prepare('SELECT * FROM l_partner_keys WHERE owner_id=? AND create_request_id=?').bind(a.id,requestId).first<any>()
  if(replay){need(replay.create_digest===digest,'Credential creation request already used for different input',409);return summary(replay)}
  if(/constraint|CHECK|UNIQUE/i.test(String(error)))need(false,'Credential or owner authority changed; reload before retrying',409)
  throw error
 }
 return {id:next,label,site,scope:partnerScope,apiVersion:partnerVersion,createdAt:now,expiresAt:expires,revokedAt:null,token}
}
