import {laborCosts} from './labor-cost'
// DASH-001: one manager view of today and this week, scoped to the manager's home cafe (the
// owner's: every cafe, or one chosen): who is on now and late (CLOCK-004), open and unconfirmed
// shifts, pending approvals, overtime risk (COST-002), scheduled labor against the forecast sales,
// entered sales (SALES-001) and budget, unresolved time exceptions and the days left to the open pay period's cutoff (TIME-004).
// Each item is read from its own record and links to the card that resolves it; each count is its list's length.
import {type Actor,type State} from './model'
import {localDate} from './settings'
import {siteOf} from './team'
import {board} from './attendance'
import {alertsFor} from './overtime'
import {weekOf} from './openshifts'
import {salesWeek} from './sales'

const days=(a:string,b:string)=>Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000)
export function dashboard(s:State,a:Actor,asOf:string,site='') {
 const home=s.staff.find(p=>p.id===a.staffId)?.site??'',scope=a.role==='owner'?site:home
 const here=(cafe:string)=>a.role==='owner'?!scope||cafe===scope:cafe===home
 const personSite=(id:string)=>s.staff.find(p=>p.id===id)?.site??''
 const today=localDate(asOf,s.timezone),week=weekOf(s,asOf),inWeek=(at:string)=>weekOf(s,at)===week
 const plan=`/app/schedule?week=${week}${scope?`&site=${encodeURIComponent(scope)}`:''}`
 const links={now:'/app/time#attendance',late:'/app/time#attendance',openShifts:`${plan}#open-shifts`,unconfirmed:plan,time:'/app/time#approve',leave:`${plan}#time-off`,swaps:`${plan}#swaps`,availability:`${plan}#availability`,overtime:`${plan}#overtime`,exceptions:'/app/time#exceptions',labor:plan,cutoff:'/app/payroll#pay-periods'}
 const rows=board(s,a,asOf,a.role==='owner'?scope:'')
 const now=rows.filter(r=>r.status==='present'||r.status==='on break').map(r=>({shiftId:r.shiftId,staffId:r.staffId,site:r.site,status:r.status,link:links.now}))
 // Late: clocked in after the cafe's grace, or not clocked in once the shift is under way.
 const late=rows.filter(r=>(r.lateMinutes??0)>0||r.status==='missing'||r.status==='no-show').map(r=>({shiftId:r.shiftId,staffId:r.staffId,site:r.site,status:r.status,lateMinutes:r.lateMinutes,start:r.start,link:links.late}))
 const openShifts=s.openshifts.filter(o=>o.status==='open'&&o.end>asOf&&inWeek(o.start)&&here(o.site)).map(o=>({id:o.id,site:o.site,start:o.start,link:links.openShifts}))
 const unconfirmed=s.shifts.filter(x=>x.status==='published'&&!x.confirmedAt&&x.end>asOf&&inWeek(x.start)&&here(siteOf(s,x))).map(x=>({id:x.id,staffId:x.staffId,site:siteOf(s,x),start:x.start,link:links.unconfirmed}))
 const approvals={
  time:s.timesheets.filter(t=>t.status==='submitted'&&here(personSite(t.staffId))).map(t=>({id:t.id,staffId:t.staffId,link:links.time})),
  leave:s.leave.filter(r=>r.status==='pending'&&here(personSite(r.staffId))).map(r=>({id:r.id,staffId:r.staffId,link:links.leave})),
  swaps:s.swaps.filter(w=>w.status==='accepted'&&here(siteOf(s,s.shifts.find(x=>x.id===w.give.shiftId)??{staffId:w.fromId}))).map(w=>({id:w.id,link:links.swaps})),
  availability:s.patterns.filter(p=>p.status==='pending'&&here(personSite(p.staffId))).map(p=>({id:p.id,staffId:p.staffId,link:links.availability}))}
 const overtime=alertsFor(s,a,week,asOf).filter((x:any)=>here(x.site)).map((x:any)=>({staffId:x.staffId,site:x.site,overtimeMinutes:x.overtimeMinutes,link:links.overtime}))
 const exceptions=s.timesheets.filter(t=>t.status!=='superseded'&&t.exceptions?.length&&!t.resolution&&here(personSite(t.staffId))).map(t=>({id:t.id,staffId:t.staffId,exceptions:t.exceptions,link:links.exceptions}))
 // Scheduled labor: this week's published shifts at each person's hourly rate (per shift, to the cent), against the cafe's forecast sales and budget.
 const cafes=[...new Set([...s.shifts.filter(x=>x.status==='published'&&inWeek(x.start)).map(x=>siteOf(s,x)),...s.forecasts.filter(f=>f.week===week).map(f=>f.site??'')])].filter(here).sort()
 const labor=cafes.map(cafe=>{
  const costs=laborCosts(s,week,cafe,asOf,false,a),cents=costs.scheduled.totalCents
  const f=s.forecasts.find(v=>v.week===week&&(v.site??'')===cafe),sales=f?f.days.reduce((n:number,v:number)=>n+v,0)*100:null
  const percent=sales&&cents!==null?Math.round(cents/sales*1000)/10:null,e=salesWeek(s,week,cafe).entered
  // SALES-001: on the days with entered sales, their scheduled labor over those sales.
  const actual=e.days?{days:e.days,basis:e.laborBasis,salesCents:e.salesCents,laborCents:e.laborCents,percent:e.laborPercent,salesPerLaborHour:e.salesPerLaborHour}:null
  return {site:cafe,scheduledCents:cents,forecastCents:sales,percent,budgetPercent:f?.budgetPercent??null,overBudget:percent!==null&&f?.budgetPercent!=null&&percent>f.budgetPercent,actual,link:`/app/schedule?week=${week}${cafe?`&site=${encodeURIComponent(cafe)}`:''}`}})
 const period=s.periods.filter(p=>p.status==='open'&&p.end>=today).sort((x,y)=>x.end.localeCompare(y.end))[0]
 const cutoff=period?{periodId:period.id,end:period.end,daysLeft:days(today,period.end),link:links.cutoff}:null
 return {asOf,today,week,site:scope,links,now,late,openShifts,unconfirmed,approvals,overtime,labor,exceptions,cutoff}
}
