// Native schedule events are distinct from NOTICE-002's timed reminders.
// Source decisions and their recipient records use the same guarded D1 batch.
import {type Actor,type Context,type Row,type State,canonical,exact,get,keys,need,put,self,sha} from './model'
import {lineageOf} from './history'
import {siteOf} from './team'

const active=(s:State,id:string)=>s.staff.some(p=>p.id===id&&p.active&&!p.erased_at)
const published=(s:State)=>new Map(s.shifts.filter(x=>x.status==='published').map(x=>[lineageOf(x),x]))
// Copy only facts available on the recipient's personal schedule. Never copy
// rates, another assignee, manager reasons, call-out details or consent records.
function facts(s:State,x:Row){return {start:x.start,end:x.end,site:siteOf(s,x),job:x.job??'',label:x.label??'',breakMinutes:x.breakMinutes,minutes:x.minutes}}
const ownFacts=(s:State,x:Row|undefined,recipient:string)=>x?.staffId===recipient?facts(s,x):null
function source(s:State,x:Row|undefined,recipient:string){
 if(x?.staffId!==recipient)return null
 const r=s.rosters.find(r=>r.id===x.rosterId)
 return {shiftId:x.id,shiftRevision:x.revision,rosterId:x.rosterId,rosterRevision:r?.revision??null}
}
function current(s:State,n:Row){return ownFacts(s,published(s).get(n.lineage),n.recipient)}
function available(s:State,n:Row){return active(s,n.recipient)&&n.status==='current'&&canonical(current(s,n))===canonical(n.assignment)}

/** Diff actual assignments, rather than command names or incidental revisions. */
export async function reconcileScheduleNotices(c:Context,before:State,name:string,p:Record<string,any>){
 const entity=c.entity,A=published(before),B=published(c.s)
 const decisionSource=(['shifts','rosters','swaps','pickups','openshifts'] as const).flatMap(kind=>c.s[kind].filter(r=>r.id===entity).map(r=>({kind,id:r.id,revision:r.revision})))[0]??null
 const revoked=(id:string)=>!active(c.s,id)||(name==='staff.save'&&p.id===id&&p.active===false)
 for(const n of c.s.schedulenotices)if(n.status==='current'&&(revoked(n.recipient)||canonical(current(c.s,n))!==canonical(n.assignment)))
  put(c,'schedulenotices',{...n,status:'superseded',supersededAt:c.now,supersededReason:revoked(n.recipient)?'Recipient access revoked':'Assignment changed'},n)
 for(const lineage of new Set([...A.keys(),...B.keys()])){
  const a=A.get(lineage),b=B.get(lineage)
  for(const recipient of new Set([a?.staffId,b?.staffId].filter(Boolean) as string[])){
   const previous=ownFacts(before,a,recipient),assignment=ownFacts(c.s,b,recipient)
   if(revoked(recipient)||canonical(previous)===canonical(assignment))continue
   // Exact source pins distinguish later repeated changes while an unchanged
   // publication, confirmation or retry creates no assignment event.
   const priorSource=source(before,a,recipient),assignmentSource=source(c.s,b,recipient)
   const id=await sha(canonical({lineage,recipient,priorSource,assignmentSource,decision:name}))
   if(c.s.schedulenotices.some(n=>n.id===id))continue
   const kind=!assignment?'cancellation':name==='swap.decide'?'swap':b?.openShiftId&&!a?'pickup':previous?'change':'publication'
   const n=put(c,'schedulenotices',{recipient,staffId:recipient,lineage,kind,previous,assignment,priorSource,assignmentSource,
    decision:{command:name,entityId:entity,source:decisionSource,at:c.now},status:'current',createdAt:c.now,
    delivery:{channel:'in-app',state:'available',availableAt:c.now},acknowledgedAt:null,acknowledgedBy:null})
   // Stable identity for one recipient of one exact assignment transition.
   n.id=id;c.entity=entity
  }
 }
 c.entity=entity
}

/** Every read rechecks native staff eligibility; managers receive only their own. */
export function scheduleNoticesFor(s:State,a:Actor){
 if(a.role==='agent'||!a.staffId||!active(s,a.staffId))return []
 return s.schedulenotices.filter(n=>n.recipient===a.staffId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id)).map(n=>{
  const {decision,recipient,staffId,...safe}=n
  return {...safe,actionable:available(s,n)&&!n.acknowledgedAt}
 })
}

export function scheduleNoticeCommand(c:Context,name:string,p:Record<string,any>){
 if(name!=='schedule.notice.acknowledge')return undefined
 keys(p,['id','revision']);const recipient=self(c.a),n=get(c.s,'schedulenotices',p.id)
 need(n.recipient===recipient&&active(c.s,recipient!),'Not found',404)
 need(available(c.s,n),'This notice is superseded; review your current schedule',409)
 // A retry retains the first explicit acknowledgment and writes no second audit.
 if(n.acknowledgedAt){need(p.revision===n.revision||p.revision===n.revision-1,'Revision changed; reload before deciding',409);return scheduleNoticesFor(c.s,c.a).find(r=>r.id===n.id)}
 exact(n,p)
 put(c,'schedulenotices',{...n,acknowledgedAt:c.now,acknowledgedBy:c.a.id},n)
 return scheduleNoticesFor(c.s,c.a).find(r=>r.id===n.id)
}

/** History reports native availability and explicit receipt, never provider delivery. */
export function historyNoticeState(s:State,a:Actor,lineage:string,at:string){
 const list=s.schedulenotices.filter(n=>n.lineage===lineage&&n.createdAt===at&&(a.role==='owner'||a.role==='manager'||n.recipient===a.staffId))
 return list.length?list.map(n=>`In Lanyard: ${n.status==='superseded'?'superseded':n.acknowledgedAt?'employee acknowledged':'available; not acknowledged'}; external delivery not attempted`).join('; '):'not sent: in-app schedule only until NOTICE-001'
}
