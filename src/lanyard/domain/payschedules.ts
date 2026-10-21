// PAY-009: recurring pay groups and a separate, fixed venue-calendar workweek.
// Straight-time exports stay once-only; a closed week's overtime is a half-rate
// premium input, with signed differences and the complete source-week trace.
import {type State,type Context,type Row,keys,text,need,integer,staff,put,sha,canonical} from './model'
import {date,dayAfter} from './aca'
import {localDate} from './settings'
import {priced} from './workforce'
export const groupOn=(s:State,id:string,day:string)=>s.paygroups.find(g=>g.staffIds.includes(id)&&g.from<=day)
export function workweek(s:State,id:string,day:string) {
 // A first pay period may start in the middle of its workweek: look back
 // through that whole week, including work before the schedule's first date.
 const start=s.paygroups.find(g=>g.staffIds.includes(id))?.workweekStart??1
 return dayAfter(day,-((new Date(day+'T00:00:00Z').getUTCDay()-start+7)%7))
}
export function payRange(g:Row,on:string) {
 let start:string,end:string
 if(g.cadence==='weekly'||g.cadence==='biweekly') {
  const n=g.cadence==='weekly'?7:14,offset=Math.floor((Date.parse(on)-Date.parse(g.from))/86400000/n)*n
  start=dayAfter(g.from,offset);end=dayAfter(start,n-1)
 } else {
  const month=on.slice(0,7),next=new Date(Date.UTC(Number(on.slice(0,4)),Number(on.slice(5,7)),1)).toISOString().slice(0,10)
  start=month+(g.cadence==='semimonthly'&&Number(on.slice(8))>15?'-16':'-01')
  end=g.cadence==='semimonthly'&&Number(on.slice(8))<=15?month+'-15':dayAfter(next,-1)
 }
 return {start,end,payDate:dayAfter(end,g.payDays)}
}
/** Retained payable-minute allocation by venue date, including overnight work and job transfers. */
export function payPieces(s:State,t:Row):{date:string;minutes:number}[] {
 return t.workSegments?.length?t.workSegments.flatMap((w:any)=>w.rateBasis.segments.map((p:any)=>({date:p.date,minutes:p.minutes}))):priced(s,t.staffId,t).segments.map((p:any)=>({date:p.date,minutes:p.minutes}))
}
/** Chronological whole-workweek classification, independent of pay-period boundaries. */
export function classified(s:State,id:string) {
 const parts=s.timesheets.filter(t=>t.staffId===id&&t.status==='approved').flatMap(t=>payPieces(s,t).map((p:any)=>({...p,timeId:t.id,revision:t.revision,start:t.start,week:workweek(s,id,p.date)}))).sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start)||a.timeId.localeCompare(b.timeId))
 const totals=new Map<string,number>()
 return parts.map(p=>{const before=totals.get(p.week)??0;totals.set(p.week,before+p.minutes);return {...p,overtimeMinutes:Math.max(0,before+p.minutes-2400)-Math.max(0,before-2400)}})
}
export function paySchedules(c:Context,name:string,p:Record<string,any>) {
 if(!['paygroup.save','paygroup.period'].includes(name))return undefined
 need(c.a.role==='owner','Only the payroll administrator (the owner) can do this',403)
 if(name==='paygroup.save') {
  keys(p,['name','cadence','from','payDays','workweekStart','staffIds'])
  const label=text(p.name,'pay group name',80),from=date(p.from,'first period date')
  need(['weekly','biweekly','semimonthly','monthly'].includes(p.cadence),'Choose a pay schedule')
  need(p.cadence!=='monthly'||from.endsWith('-01'),'A monthly schedule starts on the first')
  need(p.cadence!=='semimonthly'||['01','16'].includes(from.slice(8)),'A semimonthly schedule starts on the first or sixteenth')
  const payDays=integer(Number(p.payDays),'days after period end',0,31),workweekStart=integer(Number(p.workweekStart),'workweek starting weekday',0,6)
  need(Array.isArray(p.staffIds)&&p.staffIds.length>0&&p.staffIds.length<=500,'Choose 1–500 employees')
  const staffIds=[...new Set<string>(p.staffIds.map((id:unknown)=>staff(c,id).id))]
  need(!c.s.paygroups.some(g=>g.name===label||g.staffIds.some((id:string)=>staffIds.includes(id))),'Pay group name or employee already assigned',409)
  need(!c.s.periods.some(r=>!r.groupId&&r.end>=from),'Finish existing ungrouped pay periods before this schedule starts',409)
  need(!c.s.batches.some(b=>['exported','acknowledged'].includes(b.status)&&b.lines.some((l:any)=>staffIds.includes(l.staffId)&&localDate(l.start,c.s.timezone)>=from)),'Choose a first period after already exported time',409)
  return put(c,'paygroups',{name:label,cadence:p.cadence,from,payDays,workweekStart,staffIds,by:c.a.id,at:c.now})
 }
 keys(p,['groupId','date']);const g=c.s.paygroups.find(g=>g.id===p.groupId);need(g,'Pay group not found',404)
 const on=date(p.date,'period date');need(on>=g.from,'Date precedes this schedule')
 const range=payRange(g,on),old=c.s.periods.find(r=>r.groupId===g.id&&r.start===range.start)
 if(old)return old
 return put(c,'periods',{...range,groupId:g.id,groupName:g.name,status:'open',signoffs:[],reopens:[],locked:[],definedBy:c.a.id,definedAt:c.now})
}
/** Recompute a closed week's remaining premium. Export validates this exact trace again. */
export async function overtimeInputs(c:Context) {
 const result:any[]=[],today=localDate(c.now,c.s.timezone)
 for(const g of c.s.paygroups)for(const staffId of g.staffIds) {
  const parts=classified(c.s,staffId).filter(p=>p.week>=workweek(c.s,staffId,g.from)),weeks=[...new Set(parts.map(p=>p.week))]
  for(const week of weeks) {
   const end=dayAfter(week,6);if(end>=today)continue
   const source=parts.filter(p=>p.week===week)
   if(c.s.timesheets.some(t=>t.staffId===staffId&&['submitted','returned'].includes(t.status)&&payPieces(c.s,t).some(p=>workweek(c.s,staffId,p.date)===week))||c.s.clocks.some(k=>k.staffId===staffId&&k.status==='open'&&localDate(k.start,c.s.timezone)<=end))continue
   const desired=source.reduce((n,p)=>n+p.overtimeMinutes,0)
   const exported=c.s.batches.filter(b=>['exported','acknowledged'].includes(b.status)).flatMap(b=>b.lines).filter((l:any)=>l.overtimeKey===staffId+'|'+week).reduce((n:number,l:any)=>n+l.minutes,0)
   const minutes=desired-exported;if(!minutes)continue
   // The period where the week finishes receives late-known overtime, or the next
   // still-open/locked period if that destination already closed.
   const range=payRange(g,end),target=c.s.periods.filter(p=>p.groupId===g.id&&p.end>=range.end&&p.status!=='closed').sort((a,b)=>a.start.localeCompare(b.start))[0]
   if(!target||target.status!=='locked')continue
   const sourcePeriods=[...new Set(source.map(p=>payRange(g,p.date).start))]
   const trace={groupId:g.id,week,end,source,sourcePeriods,targetPeriodId:target.id,targetRevision:target.revision}
   const person=c.s.staff.find(p=>p.id===staffId)!
   result.push({overtimeKey:staffId+'|'+week,staffId,payrollId:person.payroll_id,start:week+'T00:00:00Z',end:dayAfter(end)+'T00:00:00Z',minutes,payCode:'weekly overtime premium',multiplier:0.5,label:sourcePeriods.length>1?'Cross-period overtime adjustment':'Workweek overtime premium',trace,sourceDigest:await sha(canonical(trace))})
  }
 }
 return result
}
