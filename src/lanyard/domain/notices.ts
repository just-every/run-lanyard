// NOTICE-002: durable in-app work. The same reconciliation runs in every command's
// transaction and from cron, so a decision cannot leave an obsolete follow-up live.
import {type Actor,type Context,type Row,type State,canonical,keys,text,integer,need,manager,put,sha} from './model'
import {noticeSubjects} from './notice-subjects'
import {salesSite} from './sales'

export const noticeFields=['shiftLeadMinutes','ackMinutes','offerLeadMinutes','exceptionMinutes','reviewMinutes','payrollLeadMinutes','escalationMinutes'] as const
export function noticeCommand(c:Context,name:string,p:Record<string,any>) {
 if(name!=='noticerule.save')return undefined
 manager(c.a);keys(p,['site','revision',...noticeFields])
 const site=text(p.site,'site',80,true);need(salesSite(c.s,c.a,site),'Only a manager of this cafe',403)
 const old=c.s.noticerules.find(r=>r.site===site)
 if(old)need(Number(p.revision)===old.revision,'Reminder settings changed; reload before saving',409)
 const settings=Object.fromEntries(noticeFields.map(k=>[k,p[k]===undefined||p[k]===null||p[k]===''?null:integer(Number(p[k]),k,0,44640)]))
 return put(c,'noticerules',{site,...settings,savedBy:c.a.id,savedAt:c.now},old)
}
function managers(s:State,site:string,employee:string|undefined,owner:Actor) {
 return [...s.staff.filter(p=>p.active&&!p.erased_at&&p.role==='manager'&&(p.site??'')===site&&p.id!==employee&&p.id!==owner.staffId).map(p=>p.id),...(owner.staffId!==employee||!employee?[owner.id]:[])]
}
function withdrawal(s:State,r:Row,now:string) {
 if(r.expires&&r.expires<=now)return 'shift started or offer expired'
 if(['shift','acknowledgment','late','no-show'].includes(r.kind)) {
  const x=s.shifts.find(x=>x.id===r.subject)
  if(!x||x.status!=='published')return 'shift closed or superseded'
  if(r.kind==='acknowledgment'&&x.confirmedAt)return 'current revision confirmed'
  if(!noticeSubjects(s,now).some(x=>x.kind===r.kind&&x.subject===r.subject&&x.basis===r.basis))return 'revision superseded or item resolved'
  return 'received punch or approved time'
 }
 if(r.kind==='timesheet-review'||r.kind==='payroll-review')return s.periods.find(p=>p.id===r.subject)?.status!=='open'?'period locked':'period or settings changed'
 if(r.kind==='offer-expiry')return 'offer closed or expired'
 return 'item resolved or settings changed'
}
export async function reconcileNotices(c:Context,owner:Actor) {
 const desired=new Map<string,Record<string,any>>()
 for(const x of noticeSubjects(c.s,c.now)) {
  const people=x.employee?(c.s.staff.some(p=>p.id===x.staffId&&p.active&&!p.erased_at)?[x.staffId!]:[]):managers(c.s,x.site,x.staffId,owner)
  const rule=c.s.noticerules.find(r=>r.site===x.site),higher=people.some(id=>id!==owner.id)
  const add=async(recipient:string,due:string,escalation=false)=>{
   const id=await sha(JSON.stringify([x.kind,x.subject,x.basis,recipient,due]))
   desired.set(id,{...x,recipient,due,escalation,escalationState:!higher&&!x.employee?'no higher manager':null})
  }
  for(const recipient of people)await add(recipient,x.due)
  // One escalation per item, irrespective of how many cafe managers received it.
  if(rule?.escalationMinutes!==null&&rule?.escalationMinutes!==undefined&&(x.employee||higher)&&(!x.staffId||owner.staffId!==x.staffId))
   await add(owner.id,new Date(Date.parse(x.due)+rule.escalationMinutes*60000).toISOString(),true)
 }
 for(const r of c.s.notices)if(r.status!=='withdrawn'&&!desired.has(r.id))put(c,'notices',{...r,status:'withdrawn',withdrawnAt:c.now,withdrawalReason:withdrawal(c.s,r,c.now)},r)
 for(const [id,x] of desired) {
  const old=c.s.notices.find(r=>r.id===id)
  if(old?.status==='withdrawn')continue // A completed purpose never resurrects on replay.
  const status=x.due<=c.now?'active':'pending'
  if(old&&old.status===status&&Object.entries(x).every(([k,v])=>canonical(old[k])===canonical(v)))continue
  const r={...x,id,revision:(old?.revision??0)+1,status,createdAt:old?.createdAt??c.now,...(status==='active'?{shownAt:old?.shownAt??c.now}:{})} as Row
  if(old)c.s.notices=c.s.notices.map(v=>v.id===id?r:v);else c.s.notices.push(r)
  if(x.escalation&&status==='active'&&old?.status!=='active')c.sql.push(c.db.prepare('INSERT INTO l_events(id,actor_id,actor_role,action,entity_id,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),owner.id,'owner','notice.escalate',id,c.now))
 }
}
export function noticesFor(s:State,a:Actor,now:string) {
 if(a.role==='agent')return []
 return s.notices.filter(r=>(r.recipient===a.id||r.recipient===a.staffId)&&r.status==='active'&&r.due<=now&&(!r.expires||r.expires>now)).sort((a,b)=>a.due.localeCompare(b.due))
}
