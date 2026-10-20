// SCHEDULE-004 blocker files use the archive-supported attachment store; bytes never enter state.
import {type Context,need,text,sha,fail} from './model'
export async function blockerFile(c:Context,value:any,answerId:string) {
 if(value===undefined||value===null||value==='')return null
 need(value&&typeof value==='object','Invalid attachment')
 const name=text(value.name,'attachment name',160),type=text(value.type,'attachment type',100)
 need(typeof value.data==='string'&&/^[A-Za-z0-9+/]+={0,2}$/.test(value.data),'Invalid attachment')
 const bytes=Uint8Array.from(atob(value.data),ch=>ch.charCodeAt(0));need(bytes.length>0&&bytes.length<=1_000_000,'Attachments are 1 MB at most')
 const file={id:crypto.randomUUID(),name,type,size:bytes.length,sha256:await sha(value.data)}
 c.sql.push(c.db.prepare('INSERT INTO l_note_files(id,note_id,name,type,size,sha256,data,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(file.id,answerId,name,type,bytes.length,file.sha256,bytes,c.now))
 return file
}
export async function handoverFile(db:D1Database,visible:any[],answerId:string,fileId:string) {
 const answer=visible.find(r=>r.id===answerId);if(answer?.attachment?.id!==fileId)fail('Not found',404)
 const row=await db.prepare('SELECT name,type,data FROM l_note_files WHERE id=? AND note_id=?').bind(fileId,answerId).first<{name:string;type:string;data:ArrayBuffer}>();if(!row)fail('Not found',404)
 return {name:row.name,type:row.type,bytes:new Uint8Array(row.data)}
}
