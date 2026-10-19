// SCHEDULE-006: shift change history and week revision compare. Every published shift row carries
// a lineage: the shift it continues across week revisions. A manager's move, reassignment or
// cancellation of one shift publishes a new revision of the week with a reason; swaps, call-out
// cover and overtime substitutes change the published row in place. A shift's history is read from
// its rows across revisions; two revisions compare by lineage; the week's change log exports as CSV.
import {type Actor,type Context,type Row,type State,keys,text,need,manager,get,exact,put,work,staff,fail} from './model'
import {conflicts} from './roster'
import {siteOf} from './team'
import {localDate} from './settings'

export const lineageOf=(x:Row)=>x.lineage??x.id
/** Who made a decision, by name: the staff record behind the session, else the owner. */
export const actorName=(c:Context)=>c.a.staffId?c.s.staff.find(p=>p.id===c.a.staffId)?.name??'Former staff':'Owner'
const NOTICE='not sent: in-app schedule only until NOTICE-001'

/** On publish: each draft row continues an unclaimed row of the week's current published revision with the same person, times and cafe; otherwise it starts a new line. */
export function link(s:State,week:string,rows:Row[]) {
 const current=s.shifts.filter(x=>x.status==='published'&&s.rosters.find(r=>r.id===x.rosterId)?.week===week),claimed=new Set<string>()
 return rows.map(x=>{const same=current.find(o=>!claimed.has(o.id)&&o.staffId===x.staffId&&o.start===x.start&&o.end===x.end&&siteOf(s,o)===siteOf(s,x));if(same)claimed.add(same.id);return same?lineageOf(same):x.id})
}
/** A new published revision of the shift's week with one shift changed (or removed, when `apply` returns null); open swaps and call-out offers follow the unchanged shifts. */
function revise(c:Context,r:Row,action:string,reason:string,apply:(x:Row)=>Row|null) {
 const roster=c.s.rosters.find(x=>x.id===r.rosterId);need(roster&&roster.status==='published'&&r.status==='published','Only a shift in the published week can be changed',409)
 need(r.start>c.now,'This shift has already started',409);need(!r.callout||r.callout.coveredBy,'This shift is called out; resolve its cover first',409)
 const rows=c.s.shifts.filter(x=>x.rosterId===roster.id&&x.status==='published')
 put(c,'rosters',{...roster,status:'superseded'},roster)
 const next=put(c,'rosters',{week:roster.week,timezone:roster.timezone,status:'published',preparedBy:c.a.id,preparedAt:c.now,publishedBy:c.a.id,publishedByName:actorName(c),publishedAt:c.now,change:{lineage:lineageOf(r),action,reason,by:c.a.id,byName:actorName(c),at:c.now}})
 const moved=new Map<string,Row>();let changed:Row|null=null
 for(const x of rows) {
  put(c,'shifts',{...x,status:'superseded'},x)
  const y=x.id===r.id?apply(x):x;if(!y)continue
  const {id,revision,...rest}=y,clone=put(c,'shifts',{...rest,rosterId:next.id,lineage:lineageOf(x),status:'published'})
  if(x.id===r.id)changed=clone;else moved.set(x.id,clone)
 }
 if(changed){const issues=conflicts(c,c.s.shifts.filter(x=>x.rosterId===next.id),roster.week).filter(e=>e.shiftId===changed!.id);need(!issues.length,issues.map(e=>e.reason).join('; '),409)}
 for(const w of c.s.swaps.filter(w=>['proposed','accepted'].includes(w.status))) {
  const pin=(p:any)=>p&&moved.has(p.shiftId)?{...p,shiftId:moved.get(p.shiftId)!.id,revision:moved.get(p.shiftId)!.revision}:p
  if(moved.has(w.give.shiftId)||(w.take&&moved.has(w.take.shiftId)))put(c,'swaps',{...w,give:pin(w.give),take:pin(w.take)},w)
 }
 for(const o of c.s.offers.filter(o=>moved.has(o.shiftId)))put(c,'offers',{...o,shiftId:moved.get(o.shiftId)!.id},o)
 c.entity=changed?.id??next.id;return {roster:next,shift:changed}
}
export function history(c:Context,name:string,p:Record<string,any>) {
 if(name==='shift.change') {
  manager(c.a);keys(p,['id','revision','start','end','staffId','reason']);const r=get(c.s,'shifts',p.id);exact(r,p);const reason=text(p.reason,'reason',280)
  const w=p.start===undefined&&p.end===undefined?{start:r.start,end:r.end,breakMinutes:r.breakMinutes,minutes:r.minutes}:work({start:p.start,end:p.end,breakMinutes:r.breakMinutes})
  const to=p.staffId===undefined||p.staffId===''?r.staffId:staff(c,p.staffId).id,week=c.s.rosters.find(x=>x.id===r.rosterId)?.week??''
  need(w.start!==r.start||w.end!==r.end||to!==r.staffId,'Change the time or the person',400);need(w.start>c.now,'Move a shift to a time that has not started')
  const date=localDate(w.start,c.s.timezone),end=new Date(Date.parse(week+'T00:00:00Z')+7*86400000).toISOString().slice(0,10);need(date>=week&&date<end,'A moved shift stays in its week')
  const action=w.start!==r.start||w.end!==r.end?'moved':'reassigned'
  return revise(c,r,action,reason,x=>{const {confirmedAt,confirmedBy,swap,substitute,callout,...rest}=x;return {...rest,...w,staffId:to}})
 }
 if(name==='shift.cancel') {
  manager(c.a);keys(p,['id','revision','reason']);const r=get(c.s,'shifts',p.id);exact(r,p)
  return revise(c,r,'canceled',text(p.reason,'reason',280),()=>null)
 }
 return undefined
}
type Event={action:string;at:string;by:string;reason:string;staffId:string|null;start:string|null;end:string|null;site:string;revisionId:string;notice:string;from?:Record<string,any>}
/** A shift line's events across the week's published revisions, oldest first, with the in-place swaps, covers, substitutes and acknowledgments on its rows. */
function events(s:State,week:string,lineage:string):Event[] {
 const revisions=s.rosters.filter(r=>r.week===week&&r.publishedAt).sort((a,b)=>a.publishedAt.localeCompare(b.publishedAt)||a.revision-b.revision)
 const out:Event[]=[],seen=new Set<string>();let prev:Row|null=null
 const add=(key:string,e:Event)=>{if(!seen.has(key)){seen.add(key);out.push(e)}}
 for(const R of revisions) {
  const row=s.shifts.find(y=>y.rosterId===R.id&&lineageOf(y)===lineage&&['published','superseded'].includes(y.status))??null
  const mine=R.change?.lineage===lineage,why=mine?R.change.reason:R.reason??'',by=(mine?R.change.byName:R.publishedByName)??'A manager'
  const base=(x:Row)=>({by,reason:why,staffId:x.staffId,start:x.start,end:x.end,site:siteOf(s,x),revisionId:R.id,notice:NOTICE,at:R.publishedAt})
  const staffNow=row?asPublished(row,R):null
  if(row&&!prev)add('c'+R.id,{action:'created',...base(row),staffId:staffNow})
  else if(row&&prev)add('r'+R.id,{action:mine?R.change.action:row.start!==prev.start||row.end!==prev.end?'moved':staffNow!==prev.staffId?'reassigned':'republished',...base(row),staffId:staffNow,from:{staffId:prev.staffId,start:prev.start,end:prev.end}})
  else if(!row&&prev)add('x'+R.id,{action:'canceled',...base(prev),staffId:null,from:{staffId:prev.staffId,start:prev.start,end:prev.end}})
  if(row) {
   if(row.swap)add('s'+row.swap.id,{action:'swapped',at:row.swap.at,by:row.swap.approvedByName??'A manager',reason:'',staffId:row.staffId,start:row.start,end:row.end,site:siteOf(s,row),revisionId:R.id,notice:NOTICE,from:{staffId:row.swap.from}})
   if(row.callout?.coveredBy)add('o'+row.callout.approvedAt,{action:'covered',at:row.callout.approvedAt,by:'A manager',reason:row.callout.note??'',staffId:row.staffId,start:row.start,end:row.end,site:siteOf(s,row),revisionId:R.id,notice:NOTICE,from:{staffId:row.callout.staffId}})
   if(row.substitute)add('u'+row.substitute.at,{action:'reassigned',at:row.substitute.at,by:'A manager',reason:row.substitute.reason,staffId:row.staffId,start:row.start,end:row.end,site:siteOf(s,row),revisionId:R.id,notice:NOTICE,from:{staffId:row.substitute.from}})
   // ROSTER-003: only the assignee confirms their own shift, so the acknowledgment is theirs.
   if(row.confirmedAt)add('a'+row.confirmedBy+row.confirmedAt,{action:'acknowledged',at:row.confirmedAt,by:s.staff.find(p=>p.id===row.staffId)?.name??'The employee',reason:'',staffId:row.staffId,start:row.start,end:row.end,site:siteOf(s,row),revisionId:R.id,notice:''})
  }
  prev=row
 }
 return out.sort((a,b)=>a.at.localeCompare(b.at))
}
/** Who a row was assigned to when revision R published it: a swap, cover or substitute made on the row after that moment names the earlier person. */
function asPublished(row:Row,R:Row) {
 const later=[row.swap&&{at:row.swap.at,from:row.swap.from},row.callout?.coveredBy&&{at:row.callout.approvedAt,from:row.callout.staffId},row.substitute&&{at:row.substitute.at,from:row.substitute.from}].filter((x:any)=>x&&x.at>R.publishedAt).sort((a:any,b:any)=>a.at.localeCompare(b.at))
 return later.length?later[0].from:row.staffId
}
const involved=(list:Event[],id:string)=>list.some(e=>e.staffId===id||e.from?.staffId===id)
/** One shift's history: managers read any; an employee reads a shift they were ever assigned. */
export function shiftHistory(s:State,a:Actor,id:string) {
 const x=get(s,'shifts',id),week=s.rosters.find(r=>r.id===x.rosterId)?.week??'',list=events(s,week,lineageOf(x))
 need(a.role==='owner'||a.role==='manager'||(a.role==='staff'&&a.staffId&&involved(list,a.staffId)),'Not found',404)
 return {shiftId:id,lineage:lineageOf(x),week,events:list}
}
/** Two published revisions of a week compared by shift line: added, removed and changed shifts, and the hours each person and cafe gain or lose. */
export function compare(s:State,a:Actor,week:string,from:string,to:string) {
 need(a.role==='owner'||a.role==='manager','Manager required',403)
 const rev=(id:string)=>{const r=s.rosters.find(x=>x.id===id&&x.week===week&&x.publishedAt);if(!r)fail('Choose two published revisions of this week',404);return s.shifts.filter(x=>x.rosterId===r.id&&['published','superseded'].includes(x.status))}
 const A=new Map(rev(from).map(x=>[lineageOf(x),x])),B=new Map(rev(to).map(x=>[lineageOf(x),x])),view=(x:Row)=>({staffId:x.staffId,start:x.start,end:x.end,minutes:x.minutes,site:siteOf(s,x)})
 const people:Record<string,number>={},sites:Record<string,number>={},move=(x:Row,sign:number)=>{people[x.staffId]=(people[x.staffId]??0)+sign*x.minutes;const k=siteOf(s,x);sites[k]=(sites[k]??0)+sign*x.minutes}
 const added=[],removed=[],changed=[]
 for(const [k,x] of B)if(!A.has(k)){added.push({lineage:k,...view(x)});move(x,1)}
 for(const [k,x] of A)if(!B.has(k)){removed.push({lineage:k,...view(x)});move(x,-1)}
 for(const [k,x] of A){const y=B.get(k);if(y&&(y.staffId!==x.staffId||y.start!==x.start||y.end!==x.end||siteOf(s,y)!==siteOf(s,x))){changed.push({lineage:k,before:view(x),after:view(y)});move(x,-1);move(y,1)}}
 const nz=(o:Record<string,number>)=>Object.fromEntries(Object.entries(o).filter(([,v])=>v!==0))
 return {week,from,to,added,removed,changed,minutesByPerson:nz(people),minutesBySite:nz(sites)}
}
/** Events in weeks from last week on, for the screens: managers read every shift line, an employee the lines they were ever assigned. */
export function recentChanges(s:State,a:Actor,since:string) {
 const weeks=[...new Set(s.rosters.filter(r=>r.publishedAt&&r.week>=since).map(r=>r.week))]
 return weeks.flatMap(week=>[...new Set(s.shifts.filter(x=>s.rosters.find(r=>r.id===x.rosterId&&r.week===week&&r.publishedAt)).map(lineageOf))].flatMap(l=>{const list=events(s,week,l);return a.role==='owner'||a.role==='manager'||(a.staffId&&involved(list,a.staffId))?list.map(e=>({...e,week,lineage:l})):[]}))
}
const cell=(v:unknown)=>{let t=String(v??'');if(/^[\s]*[=+\-@\t\r]/.test(t))t="'"+t;return /[",\r\n]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t}
/** The week's change log for managers as CSV: every event of every shift line, with its reason and notice state. */
export function changeLog(s:State,a:Actor,week:string) {
 need(a.role==='owner'||a.role==='manager','Manager required',403)
 const lines=new Set(s.shifts.filter(x=>s.rosters.find(r=>r.id===x.rosterId&&r.week===week&&r.publishedAt)).map(lineageOf))
 const name=(id:string|null|undefined)=>id?s.staff.find(p=>p.id===id)?.name??'Former staff':''
 const rows=[...lines].flatMap(l=>events(s,week,l).map(e=>({...e,lineage:l}))).sort((x,y)=>x.at.localeCompare(y.at)||x.lineage.localeCompare(y.lineage))
 return 'at_utc,shift_line,action,employee,previous_employee,start_utc,end_utc,site,by,reason,notice\r\n'+rows.map(e=>[e.at,e.lineage,e.action,name(e.staffId),name(e.from?.staffId),e.start,e.end,e.site,e.by,e.reason,e.notice].map(cell).join(',')).join('\r\n')+'\r\n'
}
