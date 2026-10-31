// NOTICE-001's native event outbox shares its source transaction. No provider
// attempt, delivery receipt, contact consent or workflow approval is inferred.
import {type Actor,type Context,type Row,type State,canonical,exact,get,keys,need,put,sha} from './model'
import {eventNoticeSubjects,type EventNoticeSubject} from './event-notice-subjects'

const recipient=(a:Actor)=>a.role==='owner'?a.id:a.staffId
const purpose=(x:EventNoticeSubject)=>canonical([x.topic,x.source.kind,x.source.id,x.basis])
function visible(s:State,a:Actor,n:Row,now:string){
 if(a.role==='agent'||n.recipient!==recipient(a)||n.status!=='current')return undefined
 return eventNoticeSubjects(s,a,now).find(x=>purpose(x)===n.purpose)
}
const safe=(n:Row,x:EventNoticeSubject)=>({id:n.id,revision:n.revision,topic:n.topic,source:n.source,sourceAt:n.sourceAt,label:x.label,href:x.href,
 ...(x.assignment?{assignment:x.assignment}:{}),createdAt:n.createdAt,delivery:n.delivery,acknowledgedAt:n.acknowledgedAt,actionable:!n.acknowledgedAt})
export function eventNoticesFor(s:State,a:Actor,now:string){
 const subjects=new Map(eventNoticeSubjects(s,a,now).map(x=>[purpose(x),x])),id=recipient(a)
 return s.eventnotices.filter(n=>a.role!=='agent'&&n.recipient===id&&n.status==='current'&&subjects.has(n.purpose))
  .map(n=>safe(n,subjects.get(n.purpose)!)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id))
}
export async function reconcileEventNotices(c:Context,owner:Actor,name='',input:Record<string,any>={}){
 const entity=c.entity,desired=new Map<string,{recipient:string;x:EventNoticeSubject}>()
 const actors:Actor[]=[owner,...c.s.staff.filter(p=>p.active&&!p.erased_at&&p.id!==owner.staffId).map(p=>({id:p.id,email:p.email,role:p.role,staffId:p.id} as Actor))]
 for(const a of actors){
  if(name==='staff.erase'&&input.id===a.staffId||name==='staff.save'&&input.id===a.staffId&&input.active===false)continue
  for(const x of eventNoticeSubjects(c.s,a,c.now)){
   const id=await sha(canonical([recipient(a),purpose(x)]))
   desired.set(id,{recipient:recipient(a)!,x})
  }
 }
 for(const n of c.s.eventnotices)if(n.status==='current'&&!desired.has(n.id))
  put(c,'eventnotices',{...n,status:'superseded',supersededAt:c.now},n)
 for(const [id,{recipient,x}] of desired){
  // A withdrawn purpose never comes back when access returns or cron replays.
  if(c.s.eventnotices.some(n=>n.id===id))continue
  const n=put(c,'eventnotices',{recipient,topic:x.topic,purpose:purpose(x),source:x.source,sourceAt:x.at??null,status:'current',createdAt:c.now,
   delivery:{channel:'in-app',state:'available',availableAt:c.now},acknowledgedAt:null})
  n.id=id
 }
 c.entity=entity
}
export function eventNoticeCommand(c:Context,name:string,input:Record<string,any>){
 if(name!=='notice.acknowledge')return undefined
 keys(input,['id','revision']);const n=get(c.s,'eventnotices',input.id),x=visible(c.s,c.a,n,c.now)
 need(x,'This notice is no longer available to you',404)
 if(n.acknowledgedAt){need(input.revision===n.revision||input.revision===n.revision-1,'Revision changed; reload before deciding',409);return safe(n,x)}
 exact(n,input)
 const acknowledged=put(c,'eventnotices',{...n,acknowledgedAt:c.now,acknowledgedBy:c.a.id},n)
 return safe(acknowledged,x)
}
