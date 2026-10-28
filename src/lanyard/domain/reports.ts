import {approvedTipPools} from './tip-pools'
// Operational reads use current source revisions and never imply provider settlement.
import {type Actor,type State,manager,need,instant} from './model'
import {date,dayAfter,mayReadPerson} from './aca'
import {localDate} from './settings'
import {siteOf} from './team'
import {attendanceFact} from './attendance'
import {laborCosts} from './labor-cost'

export const reportKinds=['schedule','attendance','breaks','PTO','worked','labor','tips','payroll'] as const
export function reportSites(s:State,a:Actor) {
 manager(a)
 return a.role==='owner'?[...new Set([...s.locations.map(l=>l.site),...s.staff.map(p=>p.site??''),...s.shifts.map(x=>siteOf(s,x)),...s.forecasts.map(f=>f.site??''),...s.sales.map(r=>r.site)])].sort():[s.staff.find(p=>p.id===a.staffId)?.site??'']
}
export type ReportRow={kind:string;date:string;site:string;job:string;staffId:string;sourceId:string;revision:number;status:string;minutes:number|null;overtimeMinutes:number|null;amountCents:number|null;incomplete:boolean;detail:string}
export function operationalReport(s:State,a:Actor,q:URLSearchParams,now:string) {
 manager(a)
 const from=date(q.get('from'),'period start'),through=date(q.get('through'),'period end'),asOf=instant(now)
 need(from<=through&&Date.parse(through)-Date.parse(from)<=92*86400000,'Choose a period of at most 93 days')
 const home=s.staff.find(p=>p.id===a.staffId)?.site??'',site=q.get('scope')==='all'?null:q.has('site')?q.get('site')!:a.role==='owner'?null:home,job=q.get('job'),staffId=q.get('person'),kind=q.get('kind')??'all'
 need(a.role==='owner'||site===home,'Not found',404)
 need(!staffId||mayReadPerson(s,a,staffId),'Not found',404)
 need(kind==='all'||reportKinds.some(k=>k===kind),'Unknown report kind')
 const rows:ReportRow[]=[],within=(d:string)=>d>=from&&d<=through
 const visible=(r:{site:string;staffId:string;job:string})=>(site===null||r.site===site)&&(!job||r.job===job)&&(!staffId||r.staffId===staffId)&&(!r.staffId||mayReadPerson(s,a,r.staffId))
 const add=(r:ReportRow)=>{if(within(r.date)&&visible(r)&&(kind==='all'||kind===r.kind))rows.push(r)}
 const row=(type:string,t:any,on:string,extra:Partial<ReportRow>={}):ReportRow=>({kind:type,date:on,site:siteOf(s,t),job:t.job??'',staffId:t.staffId??'',sourceId:t.id,revision:t.revision,status:t.status??'recorded',minutes:null,overtimeMinutes:null,amountCents:null,incomplete:false,detail:'',...extra})
 for(const x of s.shifts.filter(x=>x.status==='published')) {
  const on=localDate(x.start,s.timezone);if(!within(on))continue
  add(row('schedule',x,on,{minutes:x.minutes}))
  const attendance=attendanceFact(s,x,asOf)
  if(attendance)add(row('attendance',x,on,{status:attendance.status,incomplete:!attendance.punch&&attendance.status!=='approved time'||Boolean(attendance.punch&&!attendance.punch.end)||attendance.conflicts.length>0,detail:JSON.stringify({lateMinutes:attendance.lateMinutes,alert:attendance.alert?.kind??null,clockId:attendance.punch?.clockId??null})}))
 }
 for(const k of s.clocks)for(const b of k.breaks??[])add(row('breaks',k,localDate(b.start,s.timezone),{status:b.end?'closed':'open',minutes:b.end?Math.floor((Date.parse(b.end)-Date.parse(b.start))/60000):null,incomplete:!b.end,detail:b.kind}))
 for(const t of s.timesheets.filter(t=>['submitted','approved','returned'].includes(t.status)&&!s.timesheets.some(x=>x.corrects===t.id&&['submitted','approved','returned'].includes(x.status)))) {
  if((t.exceptions??[]).length||t.breakMinutes)add(row('breaks',t,localDate(t.start,s.timezone),{minutes:s.clocks.some(k=>k.id===t.clockId&&(k.breaks??[]).length)?0:t.breakMinutes??0,incomplete:t.status!=='approved',detail:JSON.stringify(t.exceptions??[])}))
 }
 for(const issue of s.clockissues.filter(i=>i.status==='unresolved')) {
  const captured=issue.capture?.input?.capturedAt??issue.receivedAt
  add(row('attendance',issue,localDate(captured,s.timezone),{status:'unresolved offline punch',incomplete:true,detail:'Device capture requires manager reconciliation; excluded from approved totals.'}))
 }
 const start=new Date(from+'T00:00:00Z'),day=start.getUTCDay();start.setUTCDate(start.getUTCDate()-((day+6)%7))
 const sites=reportSites(s,a).filter(v=>site===null||v===site)
 for(let week=start.toISOString().slice(0,10);week<=through;week=dayAfter(week,7))for(const cafe of sites) {
  const cost=laborCosts(s,week,cafe,asOf,false,a)
  for(const f of cost.facts.approved) {
   const values=[f.wageCents,f.overtimeCents,f.holidayCents,f.differentialCents,f.otherPremiumCents],amountCents=values.some(v=>v===null)?null:values.reduce<number>((n,v)=>n+v!,0)
   add({kind:'worked',date:f.date,site:f.site,job:f.job,staffId:f.staffId,sourceId:f.sourceId,revision:f.revision,status:f.status,minutes:f.minutes,overtimeMinutes:f.overtimeMinutes+f.doubleMinutes,amountCents,incomplete:amountCents===null,detail:'Approved-time estimate; excludes employer burdens and provider reconciliation.'})
  }
  for(const d of cost.days) {
   const sales=s.sales.filter(v=>v.site===cafe&&v.date===d.date&&v.metric==='sales'),daily=sales.find(v=>v.hour===null),completeSales=Boolean(daily)||new Set(sales.map(v=>v.hour)).size===24
   add({kind:'labor',date:d.date,site:cafe,job:'',staffId:'',sourceId:cost.burden.forecastId??'',revision:cost.burden.forecastRevision??0,status:'estimate',minutes:d.approved.minutes,overtimeMinutes:d.approved.overtimeMinutes+d.approved.doubleMinutes,amountCents:d.approved.totalCents,incomplete:d.approved.totalCents===null||!completeSales||d.budgetCents===null,detail:JSON.stringify({budgetCents:d.budgetCents,salesCents:completeSales?sales.reduce((n,v)=>n+v.value,0):null,salesBasis:'Manual',sources:cost.facts.approved.filter(f=>f.date===d.date).map(f=>({id:f.sourceId,revision:f.revision})),salesSources:sales.map(v=>({id:v.id,revision:v.revision})),providerReconciled:null})})
  }
  for(const t of cost.tips.approved.sources) {
   const time=s.timesheets.find(v=>v.id===t.sourceId)!
   add(row('tips',time,t.date,{sourceId:t.sourceId,revision:t.revision,amountCents:t.cents,status:'declared',detail:'Declared at clock-out; not an approved pool allocation.'}))
  }
 }
 for(const pool of approvedTipPools(s))for(const a of pool.allocations)add(row('tips',{...pool,staffId:a.staffId,job:a.job},pool.date,{status:'pool approved',amountCents:a.cents,detail:JSON.stringify({label:'Owner-approved native pool allocation; employer-reviewed eligibility, no POS or provider readback.',poolId:pool.id,rootId:pool.rootId,corrects:pool.corrects,totalCents:pool.participants.every((id:string)=>mayReadPerson(s,a,id))?pool.totalCents:null,minutes:a.minutes,approvedAt:pool.approvedAt,sources:pool.sources.filter((v:any)=>v.staffId===a.staffId&&v.job===a.job).map((v:any)=>({id:v.timeId,revision:v.revision,minutes:v.minutes}))})}))
 // Existing payroll inputs and paid-leave purposes are owner-only. Reports keep that boundary.
 if(a.role==='owner') {
  for(const r of s.payinputs.filter(r=>!r.tipPoolId))add(row(r.kind==='tips'?'tips':'PTO',r,r.date,{status:'employer approved',minutes:r.minutes,amountCents:r.amountCents,detail:'Employer-approved source; no provider readback.'}))
  for(const r of [...s.sickuses.filter(r=>r.status==='approved'),...s.holidaypay])add(row('PTO',r,r.date,{minutes:r.minutes,amountCents:r.costCents??null,incomplete:r.costCents==null,detail:'Approved paid non-work source; no private purpose disclosed.'}))
  for(const b of s.batches.filter(b=>['exported','acknowledged'].includes(b.status)))for(const l of b.classificationLines??b.lines??[]) {
   const on=l.date??(l.start?localDate(l.start,s.timezone):'')
   add(row('payroll',{...l,id:b.id,revision:b.revision},on,{status:b.status,minutes:l.minutes??0,amountCents:l.costCents??null,incomplete:true,detail:JSON.stringify({timeId:l.timeId??null,sourceRevision:l.revision??null,payInputId:l.payInputId??null,providerReconciled:null,label:'Native export record; employer acknowledgement does not establish provider-applied payroll.'})}))
  }
 }
 rows.sort((x,y)=>x.date.localeCompare(y.date)||x.kind.localeCompare(y.kind)||x.sourceId.localeCompare(y.sourceId))
 const totals=reportKinds.map(kind=>{const own=rows.filter(r=>r.kind===kind);return {kind,rows:own.length,minutes:own.reduce((n,r)=>n+(r.minutes??0),0),overtimeMinutes:own.reduce((n,r)=>n+(r.overtimeMinutes??0),0),knownAmountCents:own.filter(r=>r.status!=='declared').reduce((n,r)=>n+(r.amountCents??0),0),...(kind==='tips'?{declaredAmountCents:own.filter(r=>r.status==='declared').reduce((n,r)=>n+(r.amountCents??0),0)}:{}),incomplete:!own.length||own.some(r=>r.incomplete)}})
 return {from,through,site,job,person:staffId,kind,asOf,timezone:s.timezone,stateRevision:s.version,rows,totals,choices:{sites:reportSites(s,a),jobs:s.jobs.map(j=>({id:j.id,name:j.name})),people:s.staff.filter(p=>mayReadPerson(s,a,p.id)).map(p=>({id:p.id,name:p.name}))},limitations:['POS and provider-applied payroll reconciliation are unavailable.','Scheduled report links require explicit owner approval and configured SendGrid; provider acceptance is not mailbox delivery.','PTO and payroll-input reports retain owner-only authority.','Device captures not yet received by this installation cannot be observed.','Rows from different report kinds are not additive.']}
}
export function operationalCsv(report:ReturnType<typeof operationalReport>) {
 const columns=['kind','date','site','job','staffId','sourceId','revision','status','minutes','overtimeMinutes','amountCents','incomplete','detail'] as const
 const cell=(value:unknown)=>{let v=value==null?'':String(value);if(typeof value==='string'&&/^\s*[=+\-@]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"'}
 return [columns.map(cell).join(','),...report.rows.map(r=>columns.map(k=>cell(r[k])).join(','))].join('\r\n')+'\r\n'
}
