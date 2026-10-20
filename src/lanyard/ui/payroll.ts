// Payroll as a pay ledger: choose approved time, review the exact CSV, export once,
// then record the provider's acknowledgement. Corrections carry signed differences.
import {autoRulesCard} from './autorules'
import {h,rows,person,manager,owner,form,field,exact,disclosure,card,status,empty,titleRow,venue,avatar,moment} from './shared'
import {addDays,dateKey,day,hours,mondayOf,span} from './format'
import {periodsCard} from './periods'
import {acaCard} from './aca'

function batch(s:any,b:any,tz:string,canManage:boolean) {
 const lines=b.lines??[],total=lines.reduce((n:number,l:any)=>n+l.minutes,0)
 const ledger=`<table class="list stack ledger"><thead><tr><th>Person</th><th>Payroll ID</th><th>Worked</th><th class="num">Hours</th><th>Note</th></tr></thead><tbody>${lines.map((l:any)=>`<tr><td class="who">${avatar(person(s,l.staffId))}<span>${h(person(s,l.staffId))}</span></td><td class="pid" data-label="Payroll ID"><code>${h(l.payrollId)}</code></td><td class="worked" data-label="Worked">${h(day(dateKey(l.start,tz)))} · ${h(span(l.start,l.end,tz))}${l.area!==undefined?`<small>${h(rows(s,'jobs').find(j=>j.id===l.job)?.name??l.job)} · ${h(l.area)}</small>`:''}</td><td class="num hrs" data-label="Hours">${h(hours(l.minutes))}</td><td class="margin note" data-label="Note">${l.payCode?`${h(l.payCode[0].toUpperCase()+l.payCode.slice(1))} · premium pay at the regular rate, not worked time${l.minutes<0?' · reversal':''}`:l.corrects?`Correction of an exported entry · ${l.minutes<0?'−':'+'}${h(hours(Math.abs(l.minutes)))} hrs`:`Timesheet revision ${h(l.revision)}`}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="3">${h(lines.length)} entries</td><td class="num">${h(hours(total))}</td><td></td></tr></tfoot></table>`
 const exported=b.status==='exported'||b.status==='acknowledged'
 const side=`<div class="batch-side"><h3>${exported?'Exported file':'File to review'}</h3>${disclosure(`CSV · ${(b.lines??[]).length+1} lines`,`<pre class="csv">${h(b.csvPreview)}</pre>`,b.status==='draft')}${b.sha256?`<p class="note">SHA-256 <code>${h(b.sha256)}</code></p>`:''}${canManage&&b.status==='draft'?form('payroll.export','payroll',exact(b)+`<label class="check"><input type="checkbox" required> I reviewed this CSV and approve exporting this revision.</label>`,'Export reviewed CSV','','primary'):''}${exported?`<p><a class="button secondary" href="/api/lanyard/batches/${encodeURIComponent(b.id)}.csv">Download exported CSV</a></p>`:''}${canManage&&b.status==='exported'?disclosure('Record provider acknowledgement',`<p class="note">Once your payroll provider has accepted the file, record its reference here. Downloading is not an acknowledgement.</p>${form('payroll.acknowledge','payroll',exact(b)+field('reference','Provider reference','','text','required maxlength="120"'),'Record acknowledgement','','secondary')}`):''}${b.reference?`<p class="done">Acknowledged · ${h(b.reference)}</p>`:''}</div>`
 const when=b.acknowledgedAt??b.exportedAt??b.preparedAt
 return `<article class="card batch"><div class="card-head"><h2>Batch <code>${h(b.id.slice(0,8))}</code></h2>${status(b.status)}<p class="card-note">Revision ${h(b.revision)} · ${h(hours(total))} hrs${when?` · ${moment(when,tz)}`:''}</p></div><div class="batch-body">${ledger}${side}</div></article>`
}
/** Approved, unexported time as a pay-week ledger: one row per person and week, hours by day, one checkbox for the row
 (enabled by lanyard.js, which writes the checked rows' timesheets into the hidden `ids` field). */
function ledger(s:any,eligible:any[],tz:string) {
 const weeks=[...new Set(eligible.map(r=>mondayOf(dateKey(r.start,tz))))].sort()
 return `<table class="list stack pay-week"><thead><tr><th><span class="sr-only">Include</span></th><th>Person</th>${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>`<th class="num">${d}</th>`).join('')}<th class="num">Hours</th></tr></thead>${weeks.map(week=>{
  const inWeek=eligible.filter(r=>mondayOf(dateKey(r.start,tz))===week),people=[...new Set(inWeek.map(r=>r.staffId))].sort((a,b)=>person(s,a).localeCompare(person(s,b)))
  const minutes=(r:any)=>r.exportMinutes??r.minutes
  return `<tbody><tr class="band"><th colspan="10">Week of ${h(day(week))}<span>${h(hours(inWeek.reduce((n,r)=>n+minutes(r),0)))} hrs</span></th></tr>${people.map(id=>{
   const mine=inWeek.filter(r=>r.staffId===id)
   const cells=[0,1,2,3,4,5,6].map(i=>{const v=mine.filter(r=>dateKey(r.start,tz)===addDays(week,i)).reduce((n,r)=>n+minutes(r),0);const d=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i];return `<td class="num d${v?'':' quiet'}" data-label="${d}">${v?h(hours(v)):'–'}</td>`}).join('')
   return `<tr><td class="pick"><input type="checkbox" data-payroll-id="${h(mine.map(r=>r.id).join(','))}" checked disabled aria-label="Include ${h(person(s,id))}, week of ${h(day(week))}"></td><td class="who">${avatar(person(s,id))}<span>${h(person(s,id))}</span></td>${cells}<td class="num hrs" data-label="Hours"><strong>${h(hours(mine.reduce((n,r)=>n+minutes(r),0)))}</strong></td></tr>`
  }).join('')}</tbody>`}).join('')}</table>`
}
export function payroll(s:any,now:number) {
 const tz=venue(s),canManage=manager(s),claimed=(r:any)=>rows(s,'batches').some(b=>['exported','acknowledged'].includes(b.status)&&(b.lines??[]).some((l:any)=>l.timeId===r.id&&l.revision===r.revision))
 const eligible=rows(s,'timesheets').filter(r=>r.status==='approved'&&!claimed(r))
 const choose=eligible.length?form('payroll.prepare','payroll',ledger(s,eligible,tz)+`<input type="hidden" name="ids" value="${h(JSON.stringify(eligible.map(r=>r.id)))}" data-payroll-ids><noscript><p class="note">Without JavaScript the batch takes every row above.</p></noscript>`,'Prepare batch','data-payroll-form','primary'):empty('No approved time is waiting. Approve timesheets in Time, then prepare a batch here.')
 const total=eligible.reduce((n,r)=>n+(r.exportMinutes??r.minutes),0)
 const list=rows(s,'batches')
 return `${titleRow(`Payroll · ${hours(total)} hrs to export`,s,now)}${canManage?card('Prepare payroll',choose,`<p class="card-note">${h(eligible.length)} approved, not exported</p>`):''}${canManage?periodsCard(s,tz)+(owner(s)?autoRulesCard(s):''):''}${list.length?[...list].sort((a,b)=>String(b.preparedAt??'').localeCompare(String(a.preparedAt??''))).map(b=>batch(s,b,tz,canManage)).join(''):card('Batches',empty('No payroll batches yet. Prepare one from approved time.'))}${acaCard(s)}`
}
