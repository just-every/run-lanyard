// LEAVE-002: manager-set blackout dates and limits on how many people of a cafe or
// position may be off at once. A request that hits a refusing rule is refused; one that
// hits a routing rule waits flagged; approving any request that conflicts needs an
// explicit override reason. All dates are venue calendar dates, inclusive.
import {type Context,type Row,keys,text,integer,need,manager,put,get,exact} from './model'
import {localDate} from './settings'

type Person={id:string;site?:string|null;position?:string|null}
const KINDS=['blackout','limit'],MODES=['refuse','override']
const nextDay=(d:string)=>new Date(Date.parse(d+'T00:00:00Z')+86400000).toISOString().slice(0,10)
export const dayLabel=(d:string)=>new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric'}).format(new Date(d+'T12:00:00Z'))
/** A rule covers a person when its cafe and position are blank or equal theirs. */
export const covers=(rule:Record<string,any>,p?:Person)=>(!rule.site||(p?.site??'')===rule.site)&&(!rule.position||(p?.position??'')===rule.position)
/** The venue dates a leave window touches (its end instant is exclusive). */
export function datesOf(start:string,end:string,tz:string) {
 const out:string[]=[],last=localDate(new Date(Date.parse(end)-1).toISOString(),tz)
 for(let d=localDate(start,tz);d<=last&&out.length<=366;d=nextDay(d))out.push(d)
 return out
}
const scope=(rule:Record<string,any>)=>[rule.position,rule.site&&`at ${rule.site}`].filter(Boolean).join(' ')||'people'
/** Every live rule a leave window breaks: inside a blackout, or a date where the limit is already full of approved leave. */
export function leaveConflicts(people:Person[],leave:Record<string,any>[],rules:Record<string,any>[],tz:string,r:Record<string,any>) {
 const person=people.find(p=>p.id===r.staffId),days=datesOf(r.start,r.end,tz),out:{id:string;mode:string;text:string}[]=[]
 for(const rule of rules.filter(x=>!x.removed&&covers(x,person))) {
  if(rule.kind==='blackout') { if(days.some(d=>d>=rule.from&&d<=rule.to))out.push({id:rule.id,mode:rule.mode,text:`Inside the ${rule.label||'time-off'} blackout, ${dayLabel(rule.from)} to ${dayLabel(rule.to)}`});continue }
  const others=leave.filter(l=>l.id!==r.id&&l.staffId!==r.staffId&&l.status==='approved'&&covers(rule,people.find(p=>p.id===l.staffId))).map(l=>({staffId:l.staffId,dates:datesOf(l.start,l.end,tz)}))
  const full=days.filter(d=>new Set(others.filter(v=>v.dates.includes(d)).map(v=>v.staffId)).size>=rule.max)
  if(full.length)out.push({id:rule.id,mode:rule.mode,text:`${rule.max} ${scope(rule)} already off on ${dayLabel(full[0])}${full.length>1?` and ${full.length-1} more day${full.length>2?'s':''}`:''}`})
 }
 return out
}
/** What a person may request: blackouts covering them and dates their limits are already full, from today on. */
export function allowedDates(people:Person[],leave:Record<string,any>[],rules:Record<string,any>[],tz:string,staffId:string,today:string) {
 const me=people.find(p=>p.id===staffId),mine=rules.filter(x=>!x.removed&&covers(x,me))
 const closed=mine.filter(x=>x.kind==='blackout'&&x.to>=today).map(x=>({from:x.from,to:x.to,label:x.label,mode:x.mode}))
 const full=new Set<string>()
 for(const rule of mine.filter(x=>x.kind==='limit')) {
  const counts=new Map<string,Set<string>>()
  for(const l of leave.filter(l=>l.staffId!==staffId&&l.status==='approved'&&covers(rule,people.find(p=>p.id===l.staffId))))for(const d of datesOf(l.start,l.end,tz)){const people=counts.get(d)??new Set<string>();people.add(l.staffId);counts.set(d,people)}
  for(const [d,n] of counts)if(d>=today&&n.size>=rule.max)full.add(d)
 }
 return {closed,full:[...full].sort()}
}
const date=(v:unknown,label:string)=>{const d=text(v,label,10);need(/^\d{4}-\d{2}-\d{2}$/.test(d)&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d,`Invalid ${label}: use YYYY-MM-DD`);return d}

export function leaveRules(c:Context,name:string,p:Record<string,any>) {
 if(name!=='leaverule.save')return undefined
 manager(c.a);keys(p,['id','revision','kind','site','position','from','to','label','max','mode','removed'])
 const old=p.id?get(c.s,'leaverules',p.id):undefined;if(old)exact(old,p)
 if(p.removed===true||p.removed==='true'){need(old,'Choose a rule to remove',404);return put(c,'leaverules',{...old,removed:true,removedBy:c.a.id,removedAt:c.now},old)}
 need(KINDS.includes(p.kind),'Choose a blackout or a limit');need(!old||old.kind===p.kind,'A rule keeps its kind');need(MODES.includes(p.mode),'Choose refuse or override')
 const base={kind:p.kind,site:text(p.site,'site',80,true),position:text(p.position,'position',80,true),mode:p.mode,savedBy:c.a.id,savedAt:c.now}
 if(p.kind==='blackout'){const from=date(p.from,'from'),to=date(p.to,'to');need(from<=to,'The blackout ends before it starts');return put(c,'leaverules',{...base,from,to,label:text(p.label,'label',80,true)},old)}
 return put(c,'leaverules',{...base,max:integer(typeof p.max==='string'?Number(p.max):p.max,'limit',1,500)},old)
}
/** Request-time check: a refusing rule refuses; routing rules flag the request for an override. */
export function requestFlags(c:Context,r:Record<string,any>) {
 const found=leaveConflicts(c.s.staff,c.s.leave,c.s.leaverules,c.s.timezone,r),refused=found.filter(x=>x.mode==='refuse')
 need(!refused.length,`${refused.map(x=>x.text).join('; ')}. Choose other dates.`,409)
 return found.map(x=>x.text)
}
/** Approval-time check: any conflict needs a manager's override reason, recorded on the decision. */
export function overrideOf(c:Context,r:Row,p:Record<string,any>) {
 const found=leaveConflicts(c.s.staff,c.s.leave,c.s.leaverules,c.s.timezone,r)
 if(!found.length)return {}
 need(typeof p.override==='string'&&p.override.trim(),`${found.map(x=>x.text).join('; ')}. Approve with an override reason.`,409)
 return {override:{reason:text(p.override,'override reason',500),conflicts:found.map(x=>x.text),by:c.a.id,at:c.now}}
}
