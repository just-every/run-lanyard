import {h,card,field,titleRow,empty} from './shared'
import {reportKinds,type operationalReport,type ReportRow} from '../domain/reports'

const labels:Record<string,string>={schedule:'Published schedules',attendance:'Attendance',breaks:'Breaks and exceptions',PTO:'Paid non-work',worked:'Approved worked time',labor:'Labor against budget and sales',tips:'Tips',payroll:'Payroll export records'}
const minutes=(v:number|null)=>v===null?'Unknown':v+' min'
const money=(v:number|null)=>v===null?'Unknown':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(v/100)
function details(row:ReportRow) {
 if(row.kind==='labor'){
  const d=JSON.parse(row.detail)
  return `Budget: ${money(d.budgetCents)} · Sales: ${money(d.salesCents)} (Manual) · Provider reconciliation: Unknown. Time sources: ${d.sources.map((v:any)=>v.id+' · revision '+v.revision).join('; ')||'None'}. Sales sources: ${d.salesSources.map((v:any)=>v.id+' · revision '+v.revision).join('; ')||'None'}.`
 }
 if(row.kind==='attendance'&&row.detail.startsWith('{')){
  const d=JSON.parse(row.detail)
  return `Late: ${minutes(d.lateMinutes)} · Alert: ${d.alert??'None'} · Clock source: ${d.clockId??'Unknown'}`
 }
 if(row.kind==='payroll'){
  const d=JSON.parse(row.detail)
  return `${d.label} Time source: ${d.timeId??'None'} · source revision ${d.sourceRevision??'Unknown'} · pay input: ${d.payInputId??'None'}`
 }
 return row.detail||'No additional source details.'
}
export function reportsPage(s:any,r:ReturnType<typeof operationalReport>,now:number) {
 const query=new URLSearchParams({site:r.site??'',from:r.from,through:r.through,kind:r.kind,job:r.job??'',person:r.person??''})
 const select=(name:string,label:string,chosen:string,options:{id:string;name:string}[])=>`<label>${h(label)}<select name="${name}" aria-label="${h(label)}">${options.map(v=>`<option value="${h(v.id)}"${v.id===chosen?' selected':''}>${h(v.name)}</option>`).join('')}</select></label>`
 const filter=`<form method="get" action="/app/reports" class="report-filters">${select('site','Cafe',r.site??'',r.choices.sites.map(id=>({id,name:id||'Unassigned cafe'})))}${field('from','From',r.from,'date','required')}${field('through','Through (inclusive)',r.through,'date','required')}${select('kind','Report kind',r.kind,[{id:'all',name:'All report kinds'},...reportKinds.map(id=>({id,name:labels[id]}))])}${select('job','Job',r.job??'',[{id:'',name:'All jobs'},...r.choices.jobs])}${select('person','Person',r.person??'',[{id:'',name:'All permitted people'},...r.choices.people])}<button class="button secondary">Show report</button></form><p>Choose up to 93 inclusive dates in ${h(r.timezone)}. Job and person filters exclude whole-cafe labor summaries because those budgets and sales are not allocated to a person or job.</p>`
 const kinds=reportKinds.filter(kind=>r.kind==='all'||r.kind===kind)
 const totals=kinds.map(kind=>{
  const t=r.totals.find(t=>t.kind===kind)!,own=r.rows.filter(row=>row.kind===kind)
  const amount=['worked','labor','PTO','tips','payroll'].includes(kind)
  return `<tr data-total-kind="${kind}"><th scope="row">${h(labels[kind])}</th><td data-label="Records">${t.rows}</td><td data-label="Known minutes">${own.some(row=>row.minutes!==null)?minutes(t.minutes):'Unknown'}</td><td data-label="Overtime">${kind==='worked'||kind==='labor'?own.some(row=>row.overtimeMinutes!==null)?minutes(t.overtimeMinutes):'Unknown':'Not applicable'}</td><td data-label="Known source amount">${amount?own.some(row=>row.status!=='declared'&&row.amountCents!==null)?money(t.knownAmountCents):'Unknown':'Not applicable'}${kind==='tips'?`<p>Declared separately: ${money(own.some(row=>row.status==='declared')?t.declaredAmountCents??0:null)}</p>`:''}</td><td data-label="Coverage">${!t.rows?'Unknown · no matching sources':t.incomplete?'Incomplete · inspect sources':'Recorded sources available'}</td></tr>`
 }).join('')
 const summary=`<p>Rows from different report kinds are not additive. Known subtotals do not fill missing values or establish wages paid. Declared tips are separate from employer-approved tip inputs; approved pool allocations are unavailable.</p><table class="list stack report-totals"><thead><tr><th>Report kind</th><th>Records</th><th>Known minutes</th><th>Overtime</th><th>Known source amount</th><th>Coverage</th></tr></thead><tbody>${totals}</tbody></table>`
 const sources=r.rows.length?`<table class="list stack report-sources"><thead><tr><th>Date and report</th><th>Person and job</th><th>Source and revision</th><th>Reported values</th><th>Coverage and details</th></tr></thead><tbody>${r.rows.map(row=>{
  const person=r.choices.people.find(p=>p.id===row.staffId)?.name??row.staffId
  const job=r.choices.jobs.find(j=>j.id===row.job)?.name??row.job
  return `<tr data-source="${h(row.sourceId)}" data-kind="${h(row.kind)}"><td data-label="Date and report">${h(row.date)}<p>${h(labels[row.kind])}</p><p>${h(row.site||'Unassigned cafe')}</p></td><td data-label="Person and job">${h(person||'Whole cafe')}<p>${h(job||'No assigned job')}</p></td><td data-label="Source and revision"><code>${h(row.sourceId||'Unknown source')}</code><p>Revision ${row.revision||'Unknown'}</p><p>${h(row.status)}</p></td><td data-label="Reported values"><p>Time: ${minutes(row.minutes)}</p><p>Overtime: ${minutes(row.overtimeMinutes)}</p><p>Source amount: ${money(row.amountCents)}</p></td><td data-label="Coverage and details"><strong>${row.incomplete?'Incomplete':'Recorded source'}</strong><p>${h(details(row))}</p></td></tr>`
 }).join('')}</tbody></table>`:empty('No source records match these filters. This is unknown coverage, not proof of zero activity.')
 return `${titleRow('Operational reports',s,now)}${card('Choose records',filter,`<a class="button secondary" href="/api/lanyard/reports.csv?${h(query)}">Download matching CSV</a>`)}${card('Report totals',summary)}${card(`Source records · ${r.rows.length}`,sources)}${card('Coverage and limits',`<p>Current installation revision ${r.stateRevision}. Approved corrections replace their prior approved sources here; pending corrections do not change approved totals. The CSV is generated from current authorized sources when downloaded.</p><ul>${r.limitations.map(v=>`<li>${h(v)}</li>`).join('')}</ul>`)}`
}
