import {type Actor,type Context,need,keys,text,integer,put,get,sha,canonical} from './model'
import {live,load} from './storage'
import {auditReport,auditCsv} from './audit-report'

/** Owner-authorized preservation floor: no automatic expiry or erasure. */
export async function retainAudit(c:Context,name:string,p:Record<string,any>){
 if(name!=='audit.retain')return undefined
 need(c.a.role==='owner','Only the owner retains audit copies',403)
 keys(p,['site','from','through','jurisdiction','sourceVersion','reason','consent'])
 need(p.consent===true,'Explicit reviewed owner authorization is required',403)
 need(integer(p.sourceVersion,'reviewed source version',0,Number.MAX_SAFE_INTEGER)===c.s.version,'Audit sources changed; review the report again',409)
 const reason=text(p.reason,'retention reason',500)
 const report=JSON.parse(JSON.stringify(auditReport(c.s,c.a,text(p.site,'cafe',80,true),p.from,p.through,p.jurisdiction??'all'))) as ReturnType<typeof auditReport>
 const csv=auditCsv(report)
 const packet={format:'lanyard.audit.v1',createdAt:c.now,createdBy:c.a.id,reason,authorization:{ownerId:c.a.id,at:c.now,reason,affirmative:true,sourceVersion:report.sourceVersion},sourceVersion:report.sourceVersion,filter:{site:report.site,from:report.from,through:report.through,jurisdiction:report.jurisdiction},report,csv,reportSha256:await sha(canonical(report)),csvSha256:await sha(csv),retention:{mode:'indefinite',expiresAt:null,boundary:'Owner-only retained copy. No automatic expiration or erasure. Maintained minimums are review inputs; complete retention and employee-rights disposition remain open. This is not legal compliance proof.'}}
 need(new TextEncoder().encode(JSON.stringify(packet)).length<=1500000,'Audit copy is too large for one retained record; choose a shorter date range',413)
 return put(c,'auditpackets',{...packet,packetSha256:await sha(canonical(packet))})
}
export async function retainedAuditRead(db:D1Database,identity:Actor,id:string,csv=false){
 const a=await live(db,identity)
 need(a.role==='owner','Only the owner reads retained audit copies',403)
 const packet=get(await load(db),'auditpackets',id)
 if(packet.packetSha256){const {id,revision,packetSha256,...content}=packet;need(packetSha256===await sha(canonical(content)),'Retained audit authorization integrity check failed',409)}
 need(packet.reportSha256===await sha(canonical(packet.report))&&packet.csvSha256===await sha(packet.csv),'Retained audit integrity check failed',409)
 if(!csv)return packet
 await db.prepare('INSERT INTO l_events(id,actor_id,actor_role,action,entity_id,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),a.id,a.role,'audit.retained.download',packet.id,new Date().toISOString()).run()
 return packet.csv as string
}
