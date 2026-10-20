// LOG-001: the manager logbook. Each cafe keeps dated entries by category with optional
// attachments, mentions of that cafe's managers and links to a shift, a person and an attendance
// exception. The owner and the cafe's managers write and read them (TEAM-001 adds finer scopes);
// a manager acknowledges an entry with a read receipt; a correction is a new version; an incident
// exports as a text record. Staff and agents never read the logbook.
import {type Actor,type Context,type State,keys,text,need,fail,manager,get,exact,put} from './model'
import {prepareLogFiles} from './logfiles'
import {siteOf} from './team'

export const LOG_CATEGORIES=['sales','incident','maintenance','staffing','menu']
const DATE=/^\d{4}-\d{2}-\d{2}$/
const homeOf=(s:State,staffId?:string)=>s.staff.find(p=>p.id===staffId)?.site??''
/** The owner reads every cafe's logbook; a manager their home cafe's. */
export const logScope=(s:State,a:Actor,site:string)=>a.role==='owner'||a.role==='manager'&&homeOf(s,a.staffId)===site
const list=(v:unknown)=>v===undefined||v===''?[]:Array.isArray(v)?v:[v]

export async function logbook(c:Context,name:string,p:Record<string,any>) {
 if(name==='log.read') {
  manager(c.a);keys(p,['id','revision']);const r=get(c.s,'logbook',p.id);exact(r,p)
  need(logScope(c.s,c.a,r.site),'Only the owner and this cafe’s managers read its logbook',403);need(r.author!==c.a.id,'You wrote this entry',409)
  need(!r.reads.some((x:any)=>x.by===c.a.id&&x.revision===(r.contentRevision??r.revision)),'Already acknowledged',409)
  return put(c,'logbook',{...r,reads:[...r.reads,{by:c.a.id,staffId:c.a.staffId??null,revision:r.contentRevision??r.revision,at:c.now}]},r)
 }
 if(name!=='log.save')return undefined
 manager(c.a);keys(p,['id','revision','site','date','category','text','mentions','shiftId','staffId','timesheetId','attachments'])
 const old=p.id?get(c.s,'logbook',p.id):undefined;if(old)exact(old,p)
 const site=old?.site??text(p.site,'cafe',80,true);need(logScope(c.s,c.a,site),'Only the owner and this cafe’s managers keep its logbook',403)
 const date=text(p.date,'date',10);need(DATE.test(date)&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date,'Invalid date')
 need(LOG_CATEGORIES.includes(p.category),'Choose sales notes, incident, maintenance, staffing or menu outage')
 const mentions=[...new Set(list(p.mentions).map(v=>text(v,'mention')))]
 for(const id of mentions)need(c.s.staff.some(v=>v.id===id&&v.active&&!v.erased_at&&v.role==='manager'&&(v.site??'')===site),'Mention a manager of this cafe',409)
 // Links: a shift at this cafe, a person at it, and an attendance exception (a timesheet with exceptions) at it.
 const links:Record<string,string>={}
 if(p.shiftId){const x=get(c.s,'shifts',p.shiftId);need(siteOf(c.s,x)===site,'Link a shift at this cafe',409);links.shiftId=x.id}
 if(p.staffId){const x=c.s.staff.find(v=>v.id===p.staffId&&!v.erased_at);need(x&&(x.site??'')===site,'Link a person at this cafe',409);links.staffId=x.id}
 if(p.timesheetId){const x=get(c.s,'timesheets',p.timesheetId);need(x.exceptions?.length&&homeOf(c.s,x.staffId)===site,'Link an attendance exception at this cafe',409);links.timesheetId=x.id}
 const entryText=text(p.text,'entry',4000)
 let attachments=entryFiles(old)
 if(p.attachments!==undefined){
  need(c.files,'Logbook file storage is not configured',503)
  const staged=await prepareLogFiles(c.files,p.attachments);attachments=staged.files;c.rollback?.push(staged.rollback)
 }
 const versions=old?[...old.versions,{date:old.date,category:old.category,text:old.text,mentions:old.mentions,links:old.links,attachments:entryFiles(old),byName:old.byName,at:old.at,revision:old.revision}]:[]
 const me=await c.db.prepare('SELECT display_name FROM oa_operators WHERE id=?').bind(c.a.id).first<{display_name:string}>()
 const r=put(c,'logbook',{site,date,contentRevision:old?(old.contentRevision??old.revision)+1:1,category:p.category,text:entryText,mentions,links,attachments,by:c.a.id,byName:me?.display_name??c.a.email,at:c.now,author:old?.author??c.a.id,versions,reads:old?.reads??[]},old)
 for(const f of attachments.filter((f:any)=>f.key&&!entryFiles(old).some((x:any)=>x.id===f.id)))c.sql.push(c.db.prepare('INSERT INTO l_log_files(id,entry_id,object_key,name,type,size,sha256) VALUES(?,?,?,?,?,?,?)').bind(f.id,r.id,f.key,f.name,f.type,f.size,f.sha256))
 return r
}
/** The entries a reader may see: the owner every cafe's, a manager their cafe's; staff and agents none. */
export const logFor=(s:State,a:Actor)=>a.role==='owner'||a.role==='manager'?s.logbook.filter(r=>logScope(s,a,r.site)):[]
/** Search: by cafe, category and month (YYYY-MM of the entry's date), newest first. */
export function searchLog(s:State,a:Actor,q:{site?:string;category?:string;month?:string}) {
 need(!q.month||/^\d{4}-\d{2}$/.test(q.month),'Choose a month as YYYY-MM')
 return logFor(s,a).filter(r=>(!q.site||r.site===q.site)&&(!q.category||r.category===q.category)&&(!q.month||r.date.startsWith(q.month))).sort((x,y)=>y.date.localeCompare(x.date)||y.at.localeCompare(x.at))
}
export const entryFiles=(r:any):any[]=>r?.attachments??(r?.attachment?[r.attachment]:[])
const name=(s:State,id:string|null|undefined)=>s.staff.find(p=>p.id===id)?.name??'Former staff'
/** An incident entry as a plain-text record with its versions, links and read receipts; nothing is sent anywhere (HR-001 sends to Willow). */
export function incidentText(s:State,a:Actor,id:string) {
 const r=logFor(s,a).find(x=>x.id===id);if(!r)fail('Not found',404);need(r.category==='incident','Only incident entries export',409)
 const shift=r.links.shiftId?s.shifts.find(x=>x.id===r.links.shiftId):undefined
 const lines=[`Lanyard logbook incident`,`Cafe: ${r.site||'Your cafe'}`,`Date: ${r.date}`,`Written by: ${r.byName} at ${r.at}`,`Entry: ${r.text}`,
  ...entryFiles(r).map(f=>`Attachment: ${f.name} (${f.size} bytes, SHA-256 ${f.sha256})`),
  ...(r.links.staffId?[`Person: ${name(s,r.links.staffId)}`]:[]),...(shift?[`Shift: ${shift.start} to ${shift.end} (${name(s,shift.staffId)})`]:[]),
  ...(r.links.timesheetId?[`Attendance exception: ${(s.timesheets.find(t=>t.id===r.links.timesheetId)?.exceptions??[]).join(', ')}`]:[]),
  ...(r.mentions.length?[`Mentions: ${r.mentions.map((m:string)=>name(s,m)).join(', ')}`]:[]),
  ...r.reads.map((x:any)=>`Read by ${name(s,x.staffId)} at ${x.at} (revision ${x.revision})`),
  ...r.versions.map((v:any)=>`Earlier version ${v.revision} by ${v.byName} at ${v.at}: ${v.text}`),
  `Exported ${new Date().toISOString()} for insurance or HR follow-up; this file was not sent anywhere.`]
 return {name:`lanyard-incident-${r.date}-${r.id.slice(0,8)}.txt`,body:lines.join('\r\n')+'\r\n'}
}
/** A logbook attachment, for a reader of its entry. */
export async function logFile(db:D1Database,s:State,a:Actor,entryId:string,fileId:string,files?:R2Bucket) {
 const r=logFor(s,a).find(x=>x.id===entryId);if(!r)fail('Not found',404)
 const file=[...entryFiles(r),...r.versions.flatMap(entryFiles)].find((f:any)=>f.id===fileId);if(!file)fail('Not found',404)
 if(file.key){
  need(files,'Logbook file storage is not configured',503);const object=await files.get(file.key);if(!object)fail('Not found',404)
  return {name:file.name,type:file.type,bytes:new Uint8Array(await object.arrayBuffer())}
 }
 const row=await db.prepare('SELECT name,type,data FROM l_note_files WHERE id=? AND note_id=?').bind(fileId,entryId).first<{name:string;type:string;data:ArrayBuffer}>()
 if(!row)fail('Not found',404)
 return {name:row.name,type:row.type,bytes:new Uint8Array(row.data)}
}
