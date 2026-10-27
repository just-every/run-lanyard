// ACA-001: service, projections and source-backed reporting; never a filing or provider send.
import {type Actor,type Row,type State,instant} from './model'
import {dayAfter,monthsAfter,daysBetween,plansFor} from './aca'
import {instantAt,localDate} from './settings'

/** Allocate payable minutes across venue dates by elapsed time, preserving their exact total.
 * Unlocated meal deductions/rounding are proportional; largest remainders go to earlier dates. */
function daily(s:State,r:Row) {
 const start=Date.parse(r.start),end=Date.parse(r.end),parts:{date:string;weight:number;minutes:number}[]=[]
 let at=start
 while(at<end) {
  const date=localDate(new Date(at).toISOString(),s.timezone),next=Math.min(end,Date.parse(instantAt(dayAfter(date),'00:00',s.timezone)))
  const weight=next-at;parts.push({date,weight,minutes:Math.floor(r.minutes*weight/(end-start))});at=next
 }
 let left=r.minutes-parts.reduce((n,p)=>n+p.minutes,0)
 for(const p of [...parts].sort((a,b)=>(r.minutes*b.weight/(end-start)-b.minutes)-(r.minutes*a.weight/(end-start)-a.minutes)||a.date.localeCompare(b.date)))if(left-->0)p.minutes++
 return parts
}
const round=(n:number)=>Math.round(n*10000)/10000
type Draft={week:string;shifts:Row[]}
export function acaReports(s:State,a:Actor,at:string,draft?:Draft) {
 const asOf=instant(at,'asOf'),today=localDate(asOf,s.timezone)
 return plansFor(s,a).map(plan=>{
  const rows=plan.staffIds.map((staffId:string)=>{
   const person=s.staff.find(p=>p.id===staffId)!,sources:Record<string,any>[]=[]
   const relevant=(d:string)=>d>=plan.start&&d<=plan.end
   for(const t of s.timesheets.filter(t=>t.staffId===staffId&&t.status==='approved'))for(const p of daily(s,t))if(relevant(p.date)&&p.date<=today&&p.minutes) {
    sources.push({kind:'approved time',id:t.id,revision:t.revision,date:p.date,minutes:p.minutes})
   }
   for(const c of [...s.acaCredits.filter(c=>!s.holidaypay.some(h=>h.reference===c.reference)&&!s.sickuses.some(u=>u.status==='approved'&&u.paid!==false&&u.reference===c.reference)),...s.holidaypay,...s.sickuses.filter(u=>u.status==='approved'&&u.paid!==false)].filter(c=>c.staffId===staffId&&relevant(c.date)&&c.date<=today&&c.minutes))sources.push({kind:'paid non-work',id:c.id,revision:c.revision,date:c.date,minutes:c.minutes,category:c.category,reference:c.reference,source:c.source})
   const workedMinutes=sources.filter(x=>x.kind==='approved time').reduce((n,x)=>n+x.minutes,0),paidLeaveMinutes=sources.filter(x=>x.kind==='paid non-work').reduce((n,x)=>n+x.minutes,0),totalMinutes=workedMinutes+paidLeaveMinutes
   const rosterWeek=(r:Row)=>s.rosters.find(p=>p.id===r.rosterId)?.week
   const scheduled=[...s.shifts.filter(r=>r.staffId===staffId&&r.status==='published'&&(!draft||rosterWeek(r)!==draft.week)),...(draft?.shifts.filter(r=>r.staffId===staffId)??[])]
   const observed=(r:Row)=>s.clocks.some(k=>k.staffId===staffId&&k.shiftId===r.id)||s.timesheets.some(t=>t.staffId===staffId&&t.status!=='superseded'&&t.start<r.end&&t.end>r.start)
   const planned:Record<string,any>[]=scheduled.filter(r=>r.start>=asOf&&!observed(r)).flatMap(r=>daily(s,r).filter(p=>relevant(p.date)).map(p=>({kind:'planned shift',id:r.id,revision:r.revision,date:p.date,minutes:p.minutes})))
   const plannedMinutes=planned.reduce((n,p)=>n+p.minutes,0),projectedMinutes=totalMinutes+plannedMinutes,days=daysBetween(plan.start,dayAfter(plan.end))
   const fullTime=totalMinutes*7>=30*60*days,status=today<=plan.end?'pending':fullTime?'full-time':'not-full-time'
   const stabilityStart=dayAfter(plan.adminEnd),stabilityEnd=fullTime?plan.stabilityEnd:[plan.stabilityEnd,dayAfter(monthsAfter(stabilityStart,plan.months),-1)].sort()[0]
   const monthly=Array.from({length:plan.months},(_,i)=>{const month=monthsAfter(plan.start,i).slice(0,7),total=sources.filter(p=>p.date.startsWith(month)).reduce((n,p)=>n+p.minutes,0),scheduled=planned.filter(p=>p.date.startsWith(month)).reduce((n,p)=>n+p.minutes,0);return {month,totalMinutes:total,plannedMinutes:scheduled,fullTime:total>=130*60,projectedFullTime:total+scheduled>=130*60,status:month>=today.slice(0,7)?'pending':total>=130*60?'full-time':'not-full-time'}})
   const incomplete=s.timesheets.filter(t=>t.staffId===staffId&&['submitted','returned'].includes(t.status)&&relevant(localDate(t.start,s.timezone))).map(t=>({id:t.id,revision:t.revision,reason:t.corrects?'correction awaiting approval':'time awaiting approval'}))
   return {staffId,name:person.name,payrollId:person.payroll_id??'',workedMinutes,paidLeaveMinutes,totalMinutes,plannedMinutes,projectedMinutes,averageWeeklyHours:round(totalMinutes/60*7/days),projectedAverageWeeklyHours:round(projectedMinutes/60*7/days),status,stabilityStart,stabilityEnd,warning:today<=plan.end&&plannedMinutes>0&&((!fullTime&&projectedMinutes*7>=30*60*days)||monthly.some(m=>!m.fullTime&&m.projectedFullTime)),monthly,sources:[...sources,...planned],incomplete}
  })
  return {plan,asOf,rows}
 })
}
const cell=(v:unknown)=>{let s=String(v??'');if(/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
export function acaCsv(report:ReturnType<typeof acaReports>[number]) {
 const header=['record_type','employee','payroll_id','measurement_start','measurement_end','administrative_end','stability_start','stability_end','month_or_date','worked_minutes','paid_nonwork_minutes','total_service_minutes','planned_minutes','worked_hours','paid_nonwork_hours','total_service_hours','planned_hours','status','source_id','source_revision','source_reference','as_of']
 const rows=report.rows.flatMap(r=>{
  const base=[r.name,r.payrollId,report.plan.start,report.plan.end,report.plan.adminEnd,r.stabilityStart,r.stabilityEnd]
  return [['measurement',...base,'',r.workedMinutes,r.paidLeaveMinutes,r.totalMinutes,r.plannedMinutes,r.status,'','','',report.asOf],...r.monthly.map(m=>['monthly',...base,m.month,'','',m.totalMinutes,m.plannedMinutes,m.status,'','','',report.asOf]),...r.sources.map(p=>['source: '+p.kind,...base,p.date,p.kind==='approved time'?p.minutes:0,p.kind==='paid non-work'?p.minutes:0,p.kind==='planned shift'?0:p.minutes,p.kind==='planned shift'?p.minutes:0,'',p.id,p.revision,p.reference??'',report.asOf])]
 })
 const withHours=rows.map(r=>[...r.slice(0,13),...r.slice(9,13).map(v=>v===''?'':(Number(v)/60).toFixed(4)),...r.slice(13)])
 return [header,...withHours].map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n'
}
