import {keys,need,object,text} from './model'

export type LogFile = {id:string;key:string;name:string;type:string;size:number;sha256:string}
/** Older singular attachments remain in D1 and have no R2 key. */
export type LegacyLogFile = Omit<LogFile,'key'> & {key?:undefined}
const MAX_BYTES=10_000_000
const BASE64=/^[A-Za-z0-9+/]*={0,2}$/
const ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Validate the entire request before storing anything. Commit metadata separately,
 * and call rollback if that commit fails. Entry-reader authority belongs to the caller. */
export async function prepareLogFiles(bucket:R2Bucket,input:unknown):Promise<{files:LogFile[];rollback:()=>Promise<void>}> {
 need(Array.isArray(input)&&input.length<=5,'Provide at most five attachments')
 const prepared=Array.from(input,value=>{
  const file=object(value);keys(file,['name','type','data','blob'])
  const name=text(file.name,'attachment name',160),type=text(file.type,'attachment type',100)
  let data:string|undefined,blob:Blob|undefined,size:number
  if('blob' in file){
   need(!('data' in file)&&file.blob instanceof Blob,'Invalid attachment blob')
   blob=file.blob;size=file.blob.size
  } else {
   const encoded=file.data;need(typeof encoded==='string','Invalid attachment base64');data=encoded
   need(encoded.length<=4*Math.ceil(MAX_BYTES/3),'Attachments are 10 MB at most')
   need(encoded.length%4===0&&BASE64.test(encoded),'Invalid attachment base64')
   const padding=encoded.endsWith('==')?2:encoded.endsWith('=')?1:0
   // Check unused padding bits without decoding and retaining every file's buffer.
   need(!padding||ALPHABET.indexOf(encoded[encoded.length-padding-1])%(padding===2?16:4)===0,'Invalid attachment base64')
   size=encoded.length/4*3-padding
  }
  need(size>0&&size<=MAX_BYTES,'Attachments must be nonempty and 10 MB at most')
  return {name,type,size,data,blob}
 })
 const files:LogFile[]=[]
 const created:string[]=[]
 const rollback=async()=>{
  if(created.length){await bucket.delete([...created]);created.length=0}
 }
 try {
  for(const item of prepared){
   const bytes=item.blob?new Uint8Array(await item.blob.arrayBuffer()):Uint8Array.from(atob(item.data!),ch=>ch.charCodeAt(0))
   const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('')
   const id=crypto.randomUUID(),file={id,key:`logbook/${id}`,name:item.name,type:item.type,size:item.size,sha256}
   created.push(file.key)
   await bucket.put(file.key,bytes,{httpMetadata:{contentType:file.type}})
   files.push(file)
  }
 } catch(error) {
  try {await rollback()}
  catch(cleanupError){throw new AggregateError([error,cleanupError],'Logbook attachment storage and cleanup failed')}
  throw error
 }
 return {files,rollback}
}
