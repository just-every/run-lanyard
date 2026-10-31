// Native workflow notices contain references, never copied conversation, leave,
// logbook, pay or call-out text. Resolve each reference under current authority.
import {type Actor,type Row,type State} from './model'
import {restricted} from './access'
import {chatMayRead} from './chat'
import {pickupFit} from './openshifts'
import {opensFor} from './offerorder'
import {coverageCase,coverageOffers} from './coverage'
import {fit} from './cover'
import {siteOf} from './team'
import {provisional} from './closerules'

export type EventNoticeSubject={topic:string;source:{kind:string;id:string;revision:number};basis:string;label:string;href:string;at:string;assignment?:{start:string;end:string;site:string}}
const person=(s:State,a:Actor)=>s.staff.find(p=>p.id===a.staffId&&p.active&&!p.erased_at)
const manages=(s:State,a:Actor,site:string)=>a.role==='owner'||a.role==='manager'&&!restricted(s,a)&&(person(s,a)?.site??'')===site
const pin=(kind:string,r:Row)=>({kind,id:r.id,revision:r.revision})
const assignment=(s:State,r:Row)=>({start:r.start,end:r.end,site:siteOf(s,r)})

/** Mirrors existing personal, logbook and conversation doors; creates no grant. */
export function eventNoticeSubjects(s:State,a:Actor,now:string):EventNoticeSubject[]{
 if(a.role==='agent'||a.role!=='owner'&&!person(s,a))return []
 const out:EventNoticeSubject[]=[],me=a.staffId
 const add=(topic:string,kind:string,r:Row,basis:string,label:string,href:string,at:string,shift?:Row)=>out.push({topic,source:pin(kind,r),basis,label,href,at,...(shift?{assignment:assignment(s,shift)}:{})})
 for(const w of s.swaps){
  if(['proposed','accepted'].includes(w.status)&&![w.give,w.take].every(p=>!p||s.shifts.some(x=>x.id===p.shiftId&&x.status==='published'&&x.revision===p.revision&&!x.callout&&x.start>now)))continue
  const participant=w.fromId===me||w.toId===me,reviewer=[w.give,w.take].every(x=>!x||manages(s,a,x.site))
  if(!participant&&!(reviewer&&w.status==='accepted'))continue
  if(w.status==='proposed'&&w.toId!==me)continue
  const label=w.status==='proposed'?'Swap proposed':w.status==='accepted'?'Swap consent recorded':`Swap ${w.status}`
  add('swap','swaps',w,w.status,label,'/app/schedule',w.decidedAt??w.closedAt??w.withdrawnAt??w.respondedAt??w.proposedAt)
 }
 for(const o of s.openshifts){
  if(!me||o.status!=='open'||o.start<=now||opensFor(o,me)>now||pickupFit(s,me,o).block)continue
  if(s.pickups.some(p=>p.openShiftId===o.id&&p.staffId===me&&['requested','declined','approved'].includes(p.status)))continue
  add('open-offer','openshifts',o,opensFor(o,me)||o.postedAt,'Open shift offered','/app/schedule',opensFor(o,me)||o.postedAt,o)
 }
 for(const p of s.pickups){
  const o=s.openshifts.find(o=>o.id===p.openShiftId)
  if(!o||p.staffId!==me&&!(p.status==='requested'&&manages(s,a,o.site)))continue
  add('pickup','pickups',p,p.status,`Pickup ${p.status}`,'/app/schedule',p.approvedAt??p.closedAt??p.declinedAt??p.withdrawnAt??p.requestedAt)
 }
 for(const x of s.shifts){
  if(x.status!=='published'||!x.callout)continue
  const c=coverageCase(s,x,now),reviewer=manages(s,a,c.site)
  if((reviewer||x.callout.staffId===me&&c.status!=='reopened')&&['waiting','assigned','reopened'].includes(c.status)){
   add('coverage','shifts',x,`${c.status}:${x.callout.approvedAt??x.callout.at}:${x.callout.reoffers?.length??0}`,
    c.status==='reopened'?'Replacement missed clock-in':c.status==='assigned'?'Replacement approved':'Call-out needs cover','/app/schedule',c.reopenedAt??c.assignedAt??c.calledOutAt)
  }
  for(const o of coverageOffers(s,x,now)){
   if(o.staffId!==me&&!(reviewer&&o.status==='accepted'))continue
   if(o.legacy||o.status==='expired'||o.status==='closed'||o.status==='sent'&&(o.shiftRevision!==x.revision||o.opensAt>now||fit(s,o.staffId,x).reason))continue
   add('cover-offer','offers',o,o.status,o.status==='sent'?'Replacement shift offered':`Replacement offer ${o.status}`,'/app/schedule',o.approvedAt??o.respondedAt??o.opensAt??o.sentAt,x)
  }
 }
 for(const r of s.logbook){
  if(!me||!r.mentions?.includes(me)||!manages(s,a,r.site))continue
  // A read receipt changes the record revision but not its content purpose.
  add('log-mention','logbook',r,String(r.contentRevision??r.revision),'Mentioned in the manager logbook','/app/time',r.at)
 }
 for(const m of s.chatmessages){
  const t=s.chatthreads.find(t=>t.id===m.threadId)
  if(!t||m.by===a.id||m.staffId===me||!chatMayRead(s,a,t))continue
  add('chat-message','chatmessages',m,String(m.revision),'New conversation message','/app/chat',m.at)
 }
 for(const k of s.clocks){
  const close=k.staffId===me?provisional(s,k,now):null
  if(close)add('clock-out','clocks',k,close.due,'Confirm your forgotten clock-out','/app/time',close.due)
 }
 return out
}
