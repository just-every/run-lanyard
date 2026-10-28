// Owner-approved notifications carry no report data. Links require the named
// native reader's current session and authority; they never grant authority.
import {type Actor,type Context,type Row,type State,exact,get,instant,integer,keyed,keys,need,put,text,canonical} from './model'
import {restricted} from './access'
import {auditRestricted} from './audit-access'
import {actor} from './storage'
import {dayAfter} from './aca'
import {localDate} from './settings'
import {operationalReport,reportSites} from './reports'

export function deliveryPeriod(s:State,due:string,days:number) {
 const through=dayAfter(localDate(due,s.timezone),-1)
 return {from:dayAfter(through,1-days),through}
}
export async function reportRecipient(db:D1Database,s:State,owner:Actor,recipient:string,site:string) {
 const person=recipient==='owner'?null:s.staff.find(p=>p.id===recipient&&p.active&&!p.erased_at&&p.role==='manager'&&(p.site??'')===site)
 need(recipient==='owner'||person,'Recipient must be the owner or an active native manager of this cafe',403)
 const row=await db.prepare("SELECT id,email FROM oa_operators WHERE email=? COLLATE NOCASE AND status='active'").bind(person?.email??owner.email).first<{id:string;email:string}>()
 need(row,'Recipient must have an active native account',403)
 const reader=await actor(db,{userId:row.id,email:row.email,isOwner:row.id===owner.id})
 need(!restricted(s,reader)&&!auditRestricted(s,reader),'Custom and auditor report delivery is not available',403)
 return reader
}
export const recipientBinding=(secret:string,s:State,a:Actor,site:string)=>keyed(secret,canonical({id:a.id,email:a.email,role:a.role,staffId:a.staffId??null,staffRevision:s.staff.find(p=>p.id===a.staffId)?.version??null,grants:s.accessgrants.filter(g=>g.staffId===a.staffId),auditGrants:s.auditgrants.filter(g=>g.staffId===a.staffId),site}))
export async function reportScheduleCommand(c:Context,name:string,p:Record<string,any>) {
 if(!name.startsWith('report.schedule.')&&name!=='report.delivery.revoke')return undefined
 need(c.a.role==='owner','Only the owner approves report delivery',403)
 if(name==='report.delivery.revoke'){
  keys(p,['id','revision']);const old=get(c.s,'reportdeliveries',p.id);exact(old,p)
  return put(c,'reportdeliveries',{...old,revokedAt:c.now,revokedBy:c.a.id},old)
 }
 if(name==='report.schedule.pause'){
  keys(p,['id','revision']);const old=get(c.s,'reportschedules',p.id);exact(old,p)
  return put(c,'reportschedules',{...old,enabled:false,pausedAt:c.now,pausedBy:c.a.id},old)
 }
 if(name!=='report.schedule.save')return undefined
 keys(p,['id','revision','label','recipient','site','kind','job','person','periodDays','cadenceDays','nextDue','consent'])
 need(p.consent===true,'Explicit owner approval of this recipient and report is required',403)
 const old=p.id?get(c.s,'reportschedules',p.id):undefined;if(old)exact(old,p)
 const label=text(p.label,'report label',80),site=text(p.site,'cafe',80,true),recipient=text(p.recipient,'recipient'),kind=text(p.kind,'report kind',30),job=text(p.job,'job',120,true),person=text(p.person,'person',120,true)
 need(reportSites(c.s,c.a).includes(site),'Choose an existing cafe')
 need(!job||c.s.jobs.some(j=>j.id===job),'Choose an existing job')
 const periodDays=integer(p.periodDays,'inclusive period days',1,93),cadenceDays=integer(p.cadenceDays,'cadence days',1,7),nextDue=instant(p.nextDue,'first run')
 need(cadenceDays===1||cadenceDays===7,'Choose daily or weekly delivery')
 need(nextDue>=c.now&&Date.parse(nextDue)-Date.parse(c.now)<=366*86400000,'First run must be within the next year')
 const reader=await reportRecipient(c.db,c.s,c.a,recipient,site)
 need(reader.role==='owner'||!['PTO','payroll'].includes(kind),'Private paid-time and payroll reports remain owner-only',403)
 operationalReport(c.s,reader,new URLSearchParams({site,kind,job,person,...deliveryPeriod(c.s,nextDue,periodDays)}),c.now)
 need(c.secret,'Installation secret required',503)
 const schedule=put(c,'reportschedules',{label,recipient,recipientId:reader.id,site,kind,job,person,periodDays,cadenceDays,nextDue,enabled:true,ownerId:c.a.id,authorityDigest:await recipientBinding(c.secret,c.s,reader,site),approvedAt:c.now,approvedBy:c.a.id},old)
 c.sql.push(c.db.prepare('INSERT INTO l_report_approvals(schedule_id,revision,owner_id) VALUES(?,?,?) ON CONFLICT(schedule_id) DO UPDATE SET revision=excluded.revision,owner_id=excluded.owner_id').bind(schedule.id,schedule.revision,c.a.id))
 return schedule
}
export async function deliveryReader(db:D1Database,s:State,owner:Actor,schedule:Row,secret:string) {
 need(schedule.enabled&&schedule.ownerId===owner.id,'Report schedule is paused or its owner changed',403)
 need(await db.prepare('SELECT 1 FROM l_report_approvals WHERE schedule_id=? AND revision=? AND owner_id=?').bind(schedule.id,schedule.revision,owner.id).first(),'Restored report schedules require fresh owner approval',403)
 const reader=await reportRecipient(db,s,owner,schedule.recipient,schedule.site)
 need(reader.id===schedule.recipientId&&await recipientBinding(secret,s,reader,schedule.site)===schedule.authorityDigest,'Recipient or installation authority changed; owner must approve again',403)
 return reader
}
