import {type Actor,type State,type Row,need,manager} from './model'
import {live,load} from './storage'
import {restricted} from './access'
import {localDate} from './settings'
import {date,dayAfter} from './aca'
import {siteOf} from './team'
import {tipChecks} from './tipcredit'
import {workweek} from './payschedules'
import {sickReports} from './sick'

const categories=['schedule','policy-preview','breaks','rounding','tip-credit','punch-edit','minor-exception','sick-leave']
type Entry={category:string;sourceKind:string;sourceId:string;sourceRevision:number;date:string;staffId:string|null;jurisdiction:string;sourceUrl:string;facts:Record<string,any>}
const week=(on:string)=>dayAfter(on,-((new Date(on+'T00:00:00Z').getUTCDay()+6)%7))
const cell=(v:unknown)=>{let t=String(v??'');if(/^[\s]*[=+\-@\t\r]/.test(t))t="'"+t;return '"'+t.replaceAll('"','""')+'"'}

/** Read-only projections of retained facts. An unassigned jurisdiction is never inferred from a cafe name. */
export function auditReport(s:State,a:Actor,site:string,from:string,through:string,jurisdiction='all') {
 manager(a);need(!restricted(s,a),'Audit reports are unavailable to custom levels',403)
 need(a.role==='owner'||s.staff.some(p=>p.id===a.staffId&&p.site===site),'Not found',404)
 from=date(from,'start date');through=date(through,'end date')
 need(through>=from&&Date.parse(through)-Date.parse(from)<=366*86400000,'Choose at most one year')
 need(['all','CA','IL','CHICAGO'].includes(jurisdiction),'Choose all recorded jurisdictions, California, Illinois or Chicago')
 const rows:Entry[]=[],inside=(on:string)=>on>=from&&on<=through
 const add=(category:string,kind:string,r:Row,on:string,facts:Record<string,any>,scope='unassigned',url='/app/time')=>{
  if(!inside(on)||jurisdiction!=='all'&&scope!=='unassigned'&&!scope.split(' and ').includes(jurisdiction))return
  rows.push({category,sourceKind:kind,sourceId:r.id,sourceRevision:r.revision,date:on,staffId:r.staffId??null,jurisdiction:scope,sourceUrl:url,facts})
 }
 const times=s.timesheets.filter(t=>siteOf(s,t)===site&&(a.role==='owner'||s.staff.some(p=>p.id===t.staffId&&p.site===site)))
 for(const t of times){
  const on=localDate(t.start,s.timezone),url=`/app/time?week=${week(on)}`,base={status:t.status,start:t.start,end:t.end,minutes:t.minutes,breakMinutes:t.breakMinutes}
  if(t.rounding)add('rounding','timesheets',t,on,{...base,capturedMinutes:t.rounding.capturedMinutes,payableStart:t.payable?.start??null,payableEnd:t.payable?.end??null,netMinutes:t.payable?t.minutes-t.rounding.capturedMinutes:null,ruleId:t.rounding.ruleId,ruleRevision:t.rounding.ruleRevision},'unassigned',url)
  add('breaks','timesheets',t,on,{...base,timedBreaks:(t.breaks??[]).map((b:any)=>({kind:b.kind,start:b.start,end:b.end})),restEvidence:t.breaks?'recorded':'unknown',exceptions:(t.exceptions??[]).filter((e:string)=>/meal|rest break/.test(e)),premiums:(t.premiums??[]).map((p:any)=>({code:p.code,minutes:p.minutes}))},'unassigned',url)
  const latestEdit=t.editHistory?.at(-1)
  if(t.edited||t.corrects||latestEdit)add('punch-edit','timesheets',t,on,{...base,reason:latestEdit?.reason??t.edited?.reason??t.reason,editedAt:latestEdit?.at??t.edited?.at??t.submittedAt,editedBy:latestEdit?.by??t.edited?.by??t.submittedBy,corrects:t.corrects,editHistory:t.editHistory??[],editHistoryComplete:t.editHistoryComplete??false,captured:t.captured?{start:t.captured.start,end:t.captured.end,minutes:t.captured.minutes,breakMinutes:t.captured.breakMinutes}:null},'unassigned',url)
  const exceptions=(t.exceptions??[]).filter((e:string)=>e.startsWith('Minor work rule'))
  if(exceptions.length)add('minor-exception','timesheets',t,on,{status:t.status,exceptions,coverage:'Recorded exceptions only; passing checks and private permit evidence are not recorded here.'},exceptions[0].match(/^Minor work rule ([A-Z]+) /)?.[1]??'unassigned',url)
 }
 for(const shift of s.shifts.filter(x=>siteOf(s,x)===site&&['published','superseded'].includes(x.status))){
  const roster=s.rosters.find(r=>r.id===shift.rosterId);if(!roster)continue
  add('schedule','shifts',shift,localDate(shift.start,s.timezone),{start:shift.start,end:shift.end,minutes:shift.minutes,status:shift.status,rosterId:roster.id,rosterRevision:roster.revision,publishedAt:roster.publishedAt,reason:roster.change?.reason??roster.reason??'',postings:s.postings.filter(p=>p.rosterId===roster.id&&(!p.filter.site||p.filter.site===site)&&(!p.filter.staffId||p.filter.staffId===shift.staffId)&&p.rows.some((r:any)=>r.start===shift.start&&r.end===shift.end)).map(p=>({id:p.id,revision:p.revision,postedAt:p.postedAt})),notice:'Posting records do not prove notice delivery or consent.'},'unassigned',`/app/schedule?week=${roster.week}&site=${encodeURIComponent(site)}`)
 }
 if(a.role==='owner'){
  for(const r of s.fairworkreviews.filter(r=>r.site===site))add('policy-preview','fairworkreviews',r,localDate(r.before.start,s.timezone),{status:r.status,shiftId:r.shiftId,shiftRevision:r.shiftRevision,policyId:r.policyId,policyRevision:r.policyRevision,action:r.action,noticeMinutes:r.noticeMinutes,consentRequired:r.consentRequired,premiumInputs:r.premiumInputs,reason:r.reason,boundary:r.boundary},r.policy?.preset==='San-Jose'?'CA':r.policy?.preset??'unassigned','/app/settings')
  const scoped={...s,sickpolicies:s.sickpolicies.filter(p=>p.site===site)}
  for(const balance of sickReports(scoped,through)){
   const policy=s.sickpolicies.find(p=>p.id===balance.policyId)!
   for(const e of balance.sources.filter(e=>inside(e.date)&&(e.kind!=='carry'||e.balanceMinutes!==0)))add('sick-leave',e.kind==='work'?'timesheets':e.kind==='use'?'sickuses':e.kind.startsWith('donation')?'sicktransfers':'sickpolicies',{id:e.id??policy.id,revision:e.revision??policy.revision,staffId:balance.staffId},e.date,{kind:e.kind,policyId:policy.id,policyRevision:e.policyRevision??policy.revision,presetVersion:e.presetVersion??null,minutes:e.minutes??null,creditedMinutes:e.creditedMinutes??null,balanceMinutes:e.balanceMinutes??null,...(e.kind==='use'?{status:e.status,decidedAt:e.decidedAt,decidedBy:e.decidedBy}:{} )},balance.preset??'unassigned','/app/payroll')
  }
 }
 const starts=new Set<string>(),people=[...new Set(s.timesheets.filter(t=>t.status==='approved'&&(siteOf(s,t)===site||t.workSegments?.some((w:any)=>w.site===site))).map(t=>t.staffId))]
 for(let on=from;on<=through;on=dayAfter(on))for(const id of people)starts.add(workweek(s,id,on))
 const checks=tipChecks(s,a,[...starts]).filter(r=>r.sites.some((x:any)=>x.site===site)&&r.week<=through&&dayAfter(r.week,6)>=from)
 for(const r of checks){
  // A native manager's site report never reveals a different cafe's work or wages.
  if(a.role!=='owner'&&r.sites.some((x:any)=>x.site!==site))continue
  const setup=s.tipcredits.find(x=>x.site===site)!,states=[...new Set<string>(r.sites.map((x:any)=>x.state))]
  const scope=states.sort().join(' and ')
  add('tip-credit','tipcredits',{...setup,staffId:r.staffId},r.week<from?from:r.week,{week:r.week,weekThrough:dayAfter(r.week,6),reportFrom:from,reportThrough:through,context:r.sites.length>1?'Whole workweek across cafes':'Whole workweek at this cafe',boundaryWeek:r.week<from||dayAfter(r.week,6)>through,sites:r.sites.map((x:any)=>({site:x.site,state:x.state,from:x.from,minimumWageCents:x.minimumWageCents,setupId:s.tipcredits.find(v=>v.site===x.site)?.id,setupRevision:s.tipcredits.find(v=>v.site===x.site)?.revision})),tippedMinutes:r.tippedMinutes,requiredCents:r.requiredCents,cashWageCents:r.rateMissing?null:r.cashWageCents,rateMissing:r.rateMissing,tipsCents:r.tipsCents,makeUpCents:r.makeUpCents,nonTippedMinutes:r.nonTippedMinutes,sources:r.sources.map((x:any)=>({id:x.timesheetId,revision:x.revision})),coverage:'Whole-workweek context may include dates outside the filter. Shared totals are not additive across cafe reports; make-up is an input, not payment.'},scope,`/app/payroll`)
 }
 rows.sort((x,y)=>x.date.localeCompare(y.date)||x.category.localeCompare(y.category)||x.sourceId.localeCompare(y.sourceId))
 const limitations:Record<string,string>={schedule:'Notice delivery and employee consent are not proven by schedule publication.', 'policy-preview':'Owner-only retained previews; enforcement, consent and payroll transfer remain incomplete.',breaks:'Retained exceptions and premium inputs; untimed rest is unknown. No statutory jurisdiction is inferred.',rounding:'Retained rule snapshots; approval-pending payable time remains unknown. No statutory jurisdiction is inferred.','tip-credit':'Whole-workweek totals include boundary dates; owners also see mixed-cafe context. Shared totals are not additive across cafe reports. Managers exclude mixed-cafe weeks. No provider payment proof.','punch-edit':'Each new edit retains prior and resulting facts, actor, reason and revisions. Earlier edits without retained history remain explicitly incomplete; correction lineage is retained.','minor-exception':'Only retained exception decisions; complete minor checks and jurisdiction coverage remain incomplete.','sick-leave':a.role==='owner'?'Recorded accrual and use sources; private purposes excluded. Full statutory eligibility remains incomplete.':'Private leave records require the owner and are excluded.'}
 const coverage=categories.map(category=>({category,count:rows.filter(r=>r.category===category).length,status:'partial',limitation:limitations[category]}))
 return {site,from,through,jurisdiction,timezone:s.timezone,sourceVersion:s.version,rows,coverage,retention:'Preset-required retention is not enforced. This report does not certify legal compliance.',auditorAccess:'No auditor grant is created; existing native readers only.'}
}
export function auditCsv(report:ReturnType<typeof auditReport>){
 const lines=[['record','category','source_kind','source_id','source_revision','date','staff_id','jurisdiction','source_url','facts']]
 lines.push(['report','','','','','','','','',JSON.stringify({site:report.site,from:report.from,through:report.through,jurisdiction:report.jurisdiction,timezone:report.timezone,sourceVersion:report.sourceVersion,auditorAccess:report.auditorAccess})])
 for(const r of report.rows)lines.push(['source',r.category,r.sourceKind,r.sourceId,String(r.sourceRevision),r.date,r.staffId??'',r.jurisdiction,r.sourceUrl,JSON.stringify(r.facts)])
 for(const c of report.coverage)lines.push(['coverage',c.category,'','','','','','','',JSON.stringify(c)])
 lines.push(['boundary','','','','','','','','',report.retention])
 return lines.map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n'
}
export async function auditRead(db:D1Database,identity:Actor,site:string,from:string,through:string,jurisdiction:string,format:'json'|'csv'='json'){
 const a=await live(db,identity),s=await load(db),report=auditReport(s,a,site,from,through,jurisdiction)
 if(format==='json')return report
 await db.prepare('INSERT INTO l_events(id,actor_id,actor_role,action,entity_id,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),a.id,a.role,'audit.download',JSON.stringify({site,from,through,jurisdiction}),new Date().toISOString()).run()
 return auditCsv(report)
}
