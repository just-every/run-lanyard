// PRIVACY-001: explicit owner administration; no automatic deletion or new readers.
// @ts-ignore The pinned portability runtime has no declarations.
import {createPortability} from '@runeditrun/rer/modules/portability'
// @ts-ignore Shared with the public archive CLI.
import archivePolicy from '../archive-policy.mjs'
import {type Context,type State,type Row,keys,text,need,integer,put,exact} from './model'
export const privacyTypes=['history','notes','attachments','location','photos'] as const
export function privacyHeld(s:State,staffId:string,type:string){return s.privacyholds.some(h=>h.staffId===staffId&&h.type===type&&h.hold)}
function schedule(s:State,type:string){return s.privacypolicies.find(r=>r.type===type)}
export function privacyExpired(s:State,type:string,at:string,now:string){const rule=schedule(s,type);return !rule||Date.parse(at)<=Date.parse(now)-rule.days*86400000}
function person(c:Context,id:unknown){const p=c.s.staff.find(p=>p.id===text(id,'staff ID')&&!p.erased_at);need(p,'Person not found',404);return p}
function approved(p:any){need(p.consent===true,'Explicit reviewed owner authorization is required',403);return text(p.reason,'request authorization or reason',500)}
function eligible(c:Context,type:string,at:string){const rule=schedule(c.s,type);return Boolean(rule&&Number.isFinite(Date.parse(at))&&Date.parse(at)<=Date.parse(c.now)-rule.days*86400000)}
export async function privacyCommand(c:Context,name:string,p:Record<string,any>){
 if(!name.startsWith('privacy.'))return undefined
 need(c.a.role==='owner','Only the owner administers employee data rights',403)
 if(name==='privacy.retention'){
  keys(p,['type','days','revision','reason','consent']);const reason=approved(p);need(privacyTypes.includes(p.type),'Choose a supported data type')
  const old=schedule(c.s,p.type);if(old)exact(old,p)
  // History is retained even after this review period; this is never legal advice.
  const {changes,...prior}:any=old??{}
  return put(c,'privacypolicies',{type:p.type,days:integer(p.days,'elapsed retention days',1,36500),reason,by:c.a.id,at:c.now,changes:old?[...(changes??[]),prior]:[]},old)
 }
 const employee=person(c,p.staffId),staffId=employee.id
 if(name==='privacy.hold'){
  keys(p,['staffId','type','hold','revision','reason','consent','caseId']);const reason=approved(p);need(privacyTypes.includes(p.type)&&typeof p.hold==='boolean','Choose a data type and explicit hold or release')
  const caseId=text(p.caseId,'hold case',120,true),old=c.s.privacyholds.find(h=>h.staffId===staffId&&h.type===p.type&&(h.caseId??'')===caseId);if(old)exact(old,p)
  return put(c,'privacyholds',{staffId,type:p.type,caseId,hold:p.hold,reason,by:c.a.id,at:c.now,changes:old?[...(old.changes??[]),{hold:old.hold,reason:old.reason,by:old.by,at:old.at}]:[]},old)
 }
 if(name==='privacy.review'){
  keys(p,['staffId']);c.entity=staffId
  return {staffId,policies:c.s.privacypolicies,holds:c.s.privacyholds.filter(h=>h.staffId===staffId),results:c.s.privacyresults.filter(r=>r.staffId===staffId)}
 }
 if(name==='privacy.export'){
  keys(p,['staffId','reason','consent']);const reason=approved(p)
  const receipt=put(c,'privacyresults',{staffId,type:'export',by:c.a.id,at:c.now,reason,format:'lanyard.employee.v1'})
  // Construct the employee projection explicitly. Never include private journal history,
  // batch CSV, other employees' payroll lines, credentials or manager-only records.
  const own=(rows:Row[])=>rows.filter(r=>r.staffId===staffId)
  return {format:'lanyard.employee.v1',receiptId:receipt.id,staffId,generatedAt:c.now,employee:{name:employee.name,email:employee.email,payrollId:employee.payroll_id,active:Boolean(employee.active),position:employee.position,site:employee.site},
   shifts:own(c.s.shifts),clocks:own(c.s.clocks),timesheets:own(c.s.timesheets),
   payroll:c.s.batches.filter(b=>b.lines?.some((l:any)=>l.staffId===staffId)).map(b=>({id:b.id,status:b.status,lines:b.lines.filter((l:any)=>l.staffId===staffId)})),
   notes:own(c.s.notes).filter(n=>n.visibility==='employee').map(({versions,by,byName,author,...n})=>n),
   locations:own(c.s.georeceipts),photos:own(c.s.photoreceipts).concat(own(c.s.kioskreceipts)).map(({photoId,...r})=>({...r,photoAvailable:Boolean(photoId)})),
   omissions:['Private journal notes and prior note versions','Other employees and shared conversations','Logbook and import originals require separate review','Attachment and photo bytes require their existing authorized download doors','Provider copies and external messages are outside this installation'],
   handling:'Keep this download private. Retire earlier downloaded exports and offline archives after erasure; Lanyard cannot recall them. External custodians must handle their copies separately.'}
 }
 if(name!=='privacy.erase')return undefined
 keys(p,['staffId','type','reason','consent']);const reason=approved(p);need(privacyTypes.includes(p.type),'Choose a supported data type');need(!employee.active,'Deactivate the former employee before erasure',409)
 need(!privacyHeld(c.s,staffId,p.type),'A legal hold prevents erasure',409)
 need(schedule(c.s,p.type),'Configure an explicit retention period first',409)
 // Necessary employment, punch and payroll facts are never erased by this door.
 if(p.type==='history')return put(c,'privacyresults',{staffId,type:p.type,by:c.a.id,at:c.now,reason,erased:[],retained:[{type:'history',reason:'Necessary employment, punch and payroll facts remain restricted; retention review is not deletion authority'}]})
 need(p.type==='notes'||p.type==='attachments','Use the existing photo or location erasure door; its retained policy period and holds also apply',409)
 const erased:string[]=[],retained:any[]=[]
 for(const n of c.s.notes.filter(n=>n.staffId===staffId&&!n.erasedAt)){
  if(privacyHeld(c.s,staffId,'notes')||privacyHeld(c.s,staffId,'attachments')){retained.push({id:n.id,reason:'Legal hold'});continue}
  // Notes use their declared record date. Revisions and file copies share the same disposition.
  if(!eligible(c,p.type,n.date+'T23:59:59.999Z')){retained.push({id:n.id,reason:'Retention period has not expired'});continue}
  const fileIds=[n.attachment,...(n.versions??[]).map((v:any)=>v.attachment)].filter(Boolean).map((f:any)=>f.id)
  if(p.type==='notes'&&fileIds.length&&(!schedule(c.s,'attachments')||!eligible(c,'attachments',n.date+'T23:59:59.999Z'))){retained.push({id:n.id,reason:'Attachment retention period has not expired'});continue}
  const clean=(v:any)=>({...v,attachment:null})
  if(p.type==='notes'){
   put(c,'notes',{staffId,date:n.date,visibility:n.visibility,category:n.category,text:'Erased note',attachment:null,versions:[],erasedAt:c.now,erasedBy:c.a.id},n);erased.push(n.id)
  }else{put(c,'notes',{...clean(n),versions:(n.versions??[]).map(clean)},n);erased.push(...fileIds)}
  c.sql.push(c.db.prepare('DELETE FROM l_note_files WHERE note_id=?').bind(n.id),c.db.prepare('UPDATE l_commands SET result=? WHERE instr(result,?)>0').bind(JSON.stringify({ok:true,result:{redacted:true}}),n.id))
 }
 if(erased.length){
  // Saved results can contain earlier note text and file descriptors. Remove those
  // derived copies atomically, while retaining command identities and digests.
  const portability=await createPortability({db:c.db,buckets:{FILES:c.files!},policy:archivePolicy});c.sql.push(...await portability.redactionStatements(),...await portability.invalidateTransfersStatements())
 }
 return put(c,'privacyresults',{staffId,type:p.type,by:c.a.id,at:c.now,reason,erased,retained,employmentFactsRetained:true,externalCopies:'Not recalled; retire old downloads and contact external custodians'})
}
