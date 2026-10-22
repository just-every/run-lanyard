import {type State,type Actor,type Context,type Row,need,keys,text,get,exact,put,self} from './model'
import {restricted,allowed} from './access'
const person=(s:State,a:Actor)=>s.staff.find(p=>p.id===a.staffId&&p.active&&!p.erased_at)
function manages(s:State,a:Actor,site:string){return a.role==='owner'||a.role==='manager'&&!restricted(s,a)&&person(s,a)?.site===site}
export function chatMayRead(s:State,a:Actor,t:Row){
 if(a.role==='agent')return false
 const me=person(s,a),manager=manages(s,a,t.site)
 if(a.role!=='owner'&&(!me||me.site!==t.site))return false
 if(t.kind==='site'||t.kind==='announcement')return manager||Boolean(me)
 if(t.kind==='shift'){const x=s.shifts.find(x=>x.id===t.shiftId);return Boolean(x&&['published','superseded'].includes(x.status)&&(manager||x.staffId===a.staffId))}
 return Boolean(me&&t.members.includes(me.id))
}
const safeMessage=(m:Row)=>({...m,attachments:m.attachments.map(({data,...f}:any)=>f)})
export function chatRead(s:State,a:Actor,q='',threadId=''){
 need(a.role!=='agent','Native session required',403)
 const threads=s.chatthreads.filter(t=>chatMayRead(s,a,t)),ids=new Set(threads.map(t=>t.id))
 if(threadId)need(ids.has(threadId),'Not found',404)
 const search=q.trim().toLowerCase();need(search.length<=120,'Search is too long')
 const messages=s.chatmessages.filter(m=>ids.has(m.threadId)&&(!threadId||m.threadId===threadId)&&(!search||m.text.toLowerCase().includes(search))).sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id)).slice(-100).map(safeMessage)
 return {threads,messages,reads:s.chatreads.filter(x=>ids.has(x.threadId)),people:s.staff.filter(p=>p.active&&!p.erased_at&&(p.site===person(s,a)?.site||a.role==='owner')).map(p=>({id:p.id,name:p.name,site:p.site})),q}
}
export function chatCommand(c:Context,name:string,p:Record<string,any>){
 if(!name.startsWith('chat.'))return undefined
 need(c.a.role!=='agent','Native session required',403)
 if(name==='chat.create'){
  keys(p,['kind','site','title','members','shiftId','shiftRevision'])
  need(['direct','group','site','shift','announcement'].includes(p.kind),'Choose a thread kind')
  const site=text(p.site,'cafe',80),me=person(c.s,c.a)
  need(me?.site===site||manages(c.s,c.a,site),'Only your cafe',403)
  const members=p.members??[];need(Array.isArray(members)&&members.length<=50&&members.every((id:any)=>typeof id==='string'),'Choose thread members')
  const list=[...new Set([...members,...(me?[me.id]:[])])]
  if(['direct','group'].includes(p.kind)){
   need(me,'Direct and group threads require your own linked employee identity',403)
   need(list.length>1&&(p.kind!=='direct'||list.length===2),'Choose the other thread members')
   need(list.every(id=>c.s.staff.some(x=>x.id===id&&x.active&&!x.erased_at&&x.site===site)),'Members must be active at the cafe',403)
  }else need(members.length===0,'This thread uses current cafe or shift membership')
  if(p.kind==='announcement')need(manages(c.s,c.a,site),'Cafe manager required',403)
  let shift:any=null
  if(p.kind==='shift'){shift=get(c.s,'shifts',p.shiftId);need(shift.status==='published'&&shift.revision===p.shiftRevision&&shift.site===site,'Choose the current published shift revision',409);need(manages(c.s,c.a,site)||shift.staffId===c.a.staffId,'Only your shift',403)}
  return put(c,'chatthreads',{kind:p.kind,site,title:text(p.title,'title',120),members:['direct','group'].includes(p.kind)?list:[],shiftId:shift?.id??null,shiftRevision:shift?.revision??null,rosterId:shift?.rosterId??null,createdBy:c.a.id,at:c.now})
 }
 if(name==='chat.send'){
  keys(p,['threadId','text','attachment']);const t=get(c.s,'chatthreads',p.threadId);need(chatMayRead(c.s,c.a,t),'Not found',404)
  if(t.kind==='announcement')need(manages(c.s,c.a,t.site),'Cafe manager required',403)
  const attachments=[]
  if(p.attachment){const f=p.attachment;keys(f,['name','type','data']);const name=text(f.name,'file name',100),type=text(f.type,'file type',100);need(typeof f.data==='string'&&f.data.length<=134000&&/^[A-Za-z0-9+/]*={0,2}$/.test(f.data),'File must be at most 100 KB');let bytes;try{bytes=atob(f.data)}catch{need(false,'Invalid attachment')};need(bytes!.length<=100000,'File must be at most 100 KB');attachments.push({id:crypto.randomUUID(),name,type,data:f.data})}
  const m=put(c,'chatmessages',{threadId:t.id,site:t.site,text:text(p.text,'message',4000),by:c.a.id,staffId:c.a.staffId??null,author:person(c.s,c.a)?.name??'Owner',at:c.now,attachments})
  return safeMessage(m)
 }
 if(name==='chat.acknowledge'){
  keys(p,['id','revision']);const m=get(c.s,'chatmessages',p.id),t=get(c.s,'chatthreads',m.threadId);exact(m,p);need(chatMayRead(c.s,c.a,t),'Not found',404)
  const old=c.s.chatreads.find(x=>x.messageId===m.id&&x.actorId===c.a.id)
  return old??put(c,'chatreads',{messageId:m.id,threadId:t.id,actorId:c.a.id,staffId:c.a.staffId??null,at:c.now})
 }
 return undefined
}
export function chatFile(s:State,a:Actor,messageId:string,fileId:string){const m=get(s,'chatmessages',messageId),t=get(s,'chatthreads',m.threadId);need(chatMayRead(s,a,t),'Not found',404);const f=m.attachments.find((f:any)=>f.id===fileId);need(f,'Not found',404);return {...f,bytes:Uint8Array.from(atob(f.data),c=>c.charCodeAt(0))}}
