// Native owner review only. Reads never submit payroll or contact anyone.
import {type Actor,type Context,type Row,type State,keys,need,get,exact,put,instant,text} from './model'
import {inPeriod,periodOf,signoffCurrent} from './periods'
import {templateMappingIssues,templateSnapshot} from './paytemplates'
import {payroll} from './payroll'
import {instantAt} from './settings'
import {weekOf} from './openshifts'

export function cutoffCommand(c:Context,name:string,p:Record<string,any>){
 if(name!=='cutoff.save')return
 need(c.a.role==='owner','Only the owner reviews payroll cutoffs',403)
 keys(p,['periodId','periodRevision','revision','templateId','templateRevision','cutoffAt','reason','reviewed'])
 const period=get(c.s,'periods',p.periodId);exact(period,{revision:p.periodRevision})
 const old=c.s.cutoffs.find(r=>r.periodId===period.id)
 if(old)need(p.revision===old.revision,'Cutoff configuration changed; reload before saving',409);else need(p.revision===0,'Cutoff configuration changed; reload before saving',409)
 need(p.reviewed===true||p.reviewed==='on','Explicitly review this cutoff and export template')
 const template=templateSnapshot(c,p.templateId);exact(template,{revision:p.templateRevision})
 const cutoffAt=instant(p.cutoffAt,'cutoff instant')
 return put(c,'cutoffs',{periodId:period.id,periodRevision:period.revision,templateId:template.id,templateRevision:template.revision,cutoffAt,reason:text(p.reason,'cutoff review reason',500),by:c.a.id,at:c.now,versions:old?[...(old.versions??[]),{...old,versions:undefined}]:[]},old)
}
type Issue={kind:string;message:string;source:{kind:string;id:string;revision:number};href:string;staffId?:string}
const timeHref=(s:State,r:Row,anchor='')=>`/app/time?week=${weekOf(s,r.start)}${anchor?'#'+anchor:''}`

export async function cutoffReports(s:State,a:Actor,now:string,db:D1Database,periodId?:string){
 need(a.role==='owner','Only the owner monitors payroll cutoffs',403)
 const periods=periodId?[get(s,'periods',periodId)]:s.periods
 return Promise.all(periods.map(async p=>{
  const config=s.cutoffs.find(x=>x.periodId===p.id),template=config?s.paytemplates.find(x=>x.id===config.templateId):undefined
  const times=inPeriod(s,p),issues:Issue[]=[]
  const add=(kind:string,message:string,source:Row,sourceKind:string,href:string,staffId?:string)=>issues.push({kind,message,source:{kind:sourceKind,id:source.id,revision:source.revision},href,...(staffId?{staffId}:{})})
  const periodHref=`/app/payroll#period-${p.id}`
  if(!config)add('configuration','No reviewed cutoff or export template is configured.',p,'periods','/app/settings#pay-cutoffs')
  else if(!template||template.approved!==true||template.revision!==config.templateRevision)add('configuration','The selected export template changed. Review its current revision and the cutoff again.',config,'cutoffs','/app/settings#pay-cutoffs')
  for(const k of s.clocks.filter(k=>k.status==='open'&&periodOf(s,k)?.id===p.id))add('open_punch','This punch has no confirmed end. Confirm or correct it through Time; monitoring cannot invent an end.',k,'clocks',timeHref(s,k),k.staffId)
  for(const k of s.clockissues.filter(k=>k.status!=='resolved'&&k.capture?.input?.capturedAt&&periodOf(s,{...k,start:k.capture.input.capturedAt})?.id===p.id))add('capture','An original offline capture still needs reconciliation in Time.',k,'clockissues',timeHref(s,{...k,start:k.capture.input.capturedAt}),k.staffId)
  for(const t of times){
   const href=timeHref(s,t,`time-${t.id}`)
   if(t.status!=='approved')add('approval',t.status==='returned'?'The employee must answer the returned time before independent approval.':'This exact time revision awaits independent approval.',t,'timesheets',timeHref(s,t,'approve'),t.staffId)
   if(t.exceptions?.length&&!t.resolution)add('exception',`Unresolved time or break case: ${t.exceptions.join(', ')}. A manager must record a reasoned resolution.`,t,'timesheets',timeHref(s,t,'exceptions'),t.staffId)
   if(!t.clockId&&!t.requested&&!t.employeeConfirmed)add('confirmation','The employee has not confirmed these manually entered facts.',t,'timesheets',href,t.staffId)
  }
  for(const shift of s.shifts.filter(x=>x.status==='published'&&x.end<=now&&periodOf(s,x)?.id===p.id)){
   if(!times.some(t=>t.staffId===shift.staffId&&t.start<shift.end&&t.end>shift.start)&&!s.clocks.some(k=>k.staffId===shift.staffId&&k.start<shift.end&&(!k.end||k.end>shift.start)))add('missing_punch','This completed assignment has no recorded work facts. Request factual time or resolve attendance through the existing doors; scheduled hours are not worked hours.',shift,'shifts',timeHref(s,shift,'time-requests'),shift.staffId)
  }
  const dated=(r:Row)=>periodOf(s,{...r,start:r.start??instantAt(r.date,'12:00',s.timezone)})?.id===p.id
  const nativeInputs=[...s.payinputs.filter(dated).map(r=>({...r,payCode:r.kind})),...s.sickuses.filter(r=>r.paid!==false&&r.status==='approved'&&dated(r)).map(r=>({...r,payCode:r.code})),...s.holidaypay.filter(r=>r.status==='approved'&&dated(r)).map(r=>({...r,payCode:r.code}))]
  const participants=[...new Set(times.map(t=>t.staffId))]
  if(p.status==='open'){
   for(const id of participants)if(!p.signoffs.some((x:any)=>x.role==='employee'&&x.staffId===id&&signoffCurrent(s,p,x)))add('employee_signoff','The employee must sign off the current time revisions.',p,'periods',periodHref,id)
   if(!p.signoffs.some((x:any)=>x.role==='manager'&&signoffCurrent(s,p,x)))add('manager_signoff','A manager must sign off the current time revisions.',p,'periods',periodHref)
   add('period_lock','The pay period is open. Complete native review and explicitly lock it before payroll.',p,'periods',periodHref)
  }
  // Retained native segments identify the required mappings even before locking.
  if(template){
   const lines=times.flatMap(t=>(t.workSegments?.length?t.workSegments:[t]).flatMap((segment:any)=>[{...segment,staffId:t.staffId,timeId:t.id},...(t.premiums??[]).map((v:any)=>({...segment,staffId:t.staffId,timeId:t.id,payCode:v.code}))]))
   for(const issue of templateMappingIssues(template,[...lines,...nativeInputs]))add('mapping',issue.message,template,'paytemplates',`/app/settings#template-${template.id}`,issue.staffId)
  }
  // Execute the actual preparation checks on an isolated state copy. No D1 write,
  // source claim, saved batch, audit mutation or outbound request is performed.
  const pending=times.filter(t=>t.status==='approved'&&!s.claims.some(x=>x.time_id===t.id&&x.time_revision===t.revision))
  if(config&&template&&!issues.length&&pending.length){
   const copy=structuredClone(s),c:Context={a,s:copy,now,db,sql:[],entity:''}
   try{await payroll(c,'payroll.prepare',{ids:pending.map(t=>t.id),templateId:template.id})}
   catch(error){
    const status=Number((error as any).status);if(!status)throw error
    const message=(error as Error).message
    if(message.startsWith('Unmapped earning code: '))add('mapping',message,template,'paytemplates',`/app/settings#template-${template.id}`)
    else add('payroll_review',message,p,'periods',periodHref)
   }
  }
  const difference=config?Date.parse(config.cutoffAt)-Date.parse(now):null
  return {period:{id:p.id,revision:p.revision,start:p.start,end:p.end,status:p.status},configuration:config??null,template:template?{id:template.id,revision:template.revision,name:template.name,approved:template.approved}:null,observedAt:now,stateVersion:s.version,timing:difference===null?'no_cutoff':difference>0?'before':difference===0?'at':'after',remainingMilliseconds:difference,nativeReadiness:!config?'no_cutoff':issues.length?'needs_attention':'ready',providerState:'unknown',providerExplanation:'Provider acceptance, application and partial rejection are unknown. A native review, download or manually recorded reference is not proof of paid payroll.',issues}
 }))
}
