// JOURNAL-001: dated notes on an employee's record. The owner and the managers of the
// employee's home cafe write and read them (TEAM-001 adds finer site and role scopes); nobody
// writes about themselves. Each note is private (managers and the owner only) or visible to
// its employee read-only. Edits keep every prior version. Notes never reach team views, agent
// context, payroll or other reports; PRIVACY-001's employee export carries employee-visible
// notes only. An optional attachment (1 MB at most) is stored outside the records.
import {type Actor,type Context,type State,type Row,keys,text,need,fail,manager,get,exact,put,sha} from './model'

export const CATEGORIES=['attendance','performance','commendation','other'],VISIBILITY=['private','employee']
const DATE=/^\d{4}-\d{2}-\d{2}$/
export type Attachment={name:string;type:string;data:string}
const homeOf=(s:State,staffId?:string)=>s.staff.find(p=>p.id===staffId)?.site??''

/** Whether a manager or owner may write and read this employee's notes. */
export function inScope(s:State,a:Actor,staffId:string) {
 if(a.role==='owner')return true
 return a.role==='manager'&&staffId!==a.staffId&&homeOf(s,staffId)===homeOf(s,a.staffId)
}
function attachment(v:unknown):Attachment|null {
 if(v===undefined||v===null||v==='')return null
 need(typeof v==='object'&&!Array.isArray(v),'Invalid attachment')
 const f=v as Record<string,unknown>,name=text(f.name,'attachment name',160),type=text(f.type,'attachment type',100)
 need(typeof f.data==='string'&&/^[A-Za-z0-9+/]+={0,2}$/.test(f.data),'Invalid attachment')
 return {name,type,data:f.data}
}

export async function journal(c:Context,name:string,p:Record<string,any>) {
 if(name!=='note.save')return undefined
 manager(c.a);keys(p,['id','revision','staffId','date','category','visibility','text','attachment'])
 const old=p.id?get(c.s,'notes',p.id):undefined;if(old)exact(old,p)
 const staffId=old?.staffId??text(p.staffId,'staffId');need(c.s.staff.some(v=>v.id===staffId&&!v.erased_at),'Staff not found',404)
 need(inScope(c.s,c.a,staffId),'Only the owner and the managers of this employee’s cafe keep their notes',403)
 const date=text(p.date,'date',10);need(DATE.test(date)&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date,'Invalid date')
 need(CATEGORIES.includes(p.category),'Choose attendance, performance, commendation or other');need(VISIBILITY.includes(p.visibility),'Choose private or visible to the employee')
 const body=text(p.text,'note',4000),file=attachment(p.attachment)
 const bytes=file?Uint8Array.from(atob(file.data),ch=>ch.charCodeAt(0)):null
 if(bytes)need(bytes.length>0&&bytes.length<=1_000_000,'Attachments are 1 MB at most')
 const stored=file&&bytes?{id:crypto.randomUUID(),name:file.name,type:file.type,size:bytes.length,sha256:await sha(file.data)}:old?.attachment??null
 const version=old?[...(old.versions??[]),{date:old.date,category:old.category,visibility:old.visibility,text:old.text,attachment:old.attachment,by:old.by,byName:old.byName,at:old.at,revision:old.revision}]:[]
 const me=await c.db.prepare('SELECT display_name FROM oa_operators WHERE id=?').bind(c.a.id).first<{display_name:string}>()
 const r=put(c,'notes',{staffId,date,category:p.category,visibility:p.visibility,text:body,attachment:stored,by:c.a.id,byName:me?.display_name??c.a.email,at:c.now,author:old?.author??c.a.id,versions:version},old)
 if(bytes&&stored)c.sql.push(c.db.prepare('INSERT INTO l_note_files(id,note_id,name,type,size,sha256,data,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(stored.id,r.id,stored.name,stored.type,stored.size,stored.sha256,bytes,c.now))
 return r
}

/** Owners read every note, managers their cafe's employees' notes with versions; an employee reads their employee-visible notes without history; agents none. */
export function notesFor(s:State,a:Actor):Row[] {
 if(a.role==='agent')return []
 const own=s.notes.filter(n=>n.staffId===a.staffId&&n.visibility==='employee').map(({versions,by,author,...n})=>n as Row)
 if(a.role==='staff')return own
 return [...s.notes.filter(n=>inScope(s,a,n.staffId)),...own]
}
/** A note's attachment, for a reader who may read the note. */
export async function noteFile(db:D1Database,s:State,a:Actor,noteId:string,fileId:string) {
 const visible=notesFor(s,a).find(n=>n.id===noteId);if(!visible)fail('Not found',404)
 const known=[visible.attachment,...(visible.versions??[]).map((v:any)=>v.attachment)].some(f=>f?.id===fileId);if(!known)fail('Not found',404)
 const row=await db.prepare('SELECT name,type,data FROM l_note_files WHERE id=? AND note_id=?').bind(fileId,noteId).first<{name:string;type:string;data:ArrayBuffer}>()
 if(!row)fail('Not found',404)
 return {name:row.name,type:row.type,bytes:new Uint8Array(row.data)}
}
/** Events on a private note are not about its employee's own record. */
export const privateNote=(s:State,id:string)=>s.notes.some(n=>n.id===id&&n.visibility==='private')
