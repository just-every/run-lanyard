import {type Actor,type Context,need,keys,text,integer,put,get,sha,canonical} from './model'
import {live,load} from './storage'
import {auditReport,auditCsv} from './audit-report'
import {auditReferences} from './record-retention'

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
 if(new TextEncoder().encode(JSON.stringify(packet)).length<=1500000)return put(c,'auditpackets',{...packet,packetSha256:await sha(canonical(packet))})
 // Keep each D1 value bounded without narrowing the reviewed period. The
 // manifest, payload parts, authorization and command receipt commit together.
 const payload=JSON.stringify({report,csv}),parts=[]
 for(let offset=0;offset<payload.length;offset+=100000){
  const data=payload.slice(offset,offset+100000)
  parts.push({id:crypto.randomUUID(),sha256:await sha(data),data})
 }
 const {report:originalReport,csv:originalCsv,...metadata}=packet
 const manifest={...metadata,sourceRefs:auditReferences({...packet,id:'',revision:1}),storage:{format:'lanyard.audit.chunks.v1',parts:parts.map(({id,sha256})=>({id,sha256})),bytes:new TextEncoder().encode(payload).length}}
 const stored=put(c,'auditpackets',{...manifest,packetSha256:await sha(canonical(manifest))})
 for(const part of parts)c.sql.push(c.db.prepare('INSERT INTO l_records(kind,id,revision,data) VALUES(?,?,?,?)').bind('auditpayloads',part.id,1,JSON.stringify({packetId:stored.id,data:part.data})))
 return stored
}
export async function retainedAuditRead(db:D1Database,identity:Actor,id:string,csv=false){
 const a=await live(db,identity)
 need(a.role==='owner','Only the owner reads retained audit copies',403)
 let packet=get(await load(db),'auditpackets',id)
 if(packet.packetSha256){const {id,revision,packetSha256,...content}=packet;need(packetSha256===await sha(canonical(content)),'Retained audit authorization integrity check failed',409)}
 if(packet.storage){
  need(packet.storage.format==='lanyard.audit.chunks.v1'&&Array.isArray(packet.storage.parts)&&packet.storage.parts.length>0,'Retained audit payload manifest is invalid',409)
  const parts=[]
  for(const part of packet.storage.parts){
   const row=await db.prepare("SELECT data FROM l_records WHERE kind='auditpayloads' AND id=?").bind(part.id).first<{data:string}>()
   need(row,'Retained audit payload is incomplete',409)
   const value=JSON.parse(row.data)
   need(value.packetId===packet.id&&typeof value.data==='string'&&await sha(value.data)===part.sha256,'Retained audit payload integrity check failed',409)
   parts.push(value.data)
  }
  const payload=parts.join('')
  need(new TextEncoder().encode(payload).length===packet.storage.bytes,'Retained audit payload length changed',409)
  packet={...packet,...JSON.parse(payload)}
 }
 need(packet.reportSha256===await sha(canonical(packet.report))&&packet.csvSha256===await sha(packet.csv),'Retained audit integrity check failed',409)
 if(!csv)return packet
 await db.prepare('INSERT INTO l_events(id,actor_id,actor_role,action,entity_id,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),a.id,a.role,'audit.retained.download',packet.id,new Date().toISOString()).run()
 return packet.csv as string
}
