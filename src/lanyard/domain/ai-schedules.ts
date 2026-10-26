import {type Actor,type Context,type State,type Row,keys,text,need,object,get,exact,put,keyed} from './model'
import {restricted} from './access'
import {aiModel,extractSchedule,type AiConfiguration} from './ai-provider'
import {aiReview,aiWeekDigest,aiWeekShifts,aiShiftInput} from './ai-review'
import {draftWeek} from './roster'

export function aiOwner(s:State,a:Actor){need(a.role==='owner'&&!restricted(s,a),'Only the native owner can use AI schedule sources',403)}
const receipt=(r:Row)=>({id:r.id,revision:r.revision,status:r.status,...(r.rosterId?{rosterId:r.rosterId,rosterRevision:r.rosterRevision}:{} )})
/** Bytes travel only through the authenticated owner source door. */
export function aiSchedulesFor(s:State,a:Actor){return a.role==='owner'?s.aischedules.map(({image,...r})=>({...r,...(image?{image:{name:image.name,type:image.type,size:image.size}}:{})})):[]}
export function aiSource(s:State,a:Actor,id:string){aiOwner(s,a);const r=get(s,'aischedules',id);need(r.status!=='erased'&&r.image,'Source is unavailable',404);return r.image as {name:string;type:string;data:string}}

function imageInput(value:unknown){
 if(value===undefined)return undefined
 const f=object(value);keys(f,['name','type','data']);const name=text(f.name,'image name',120),type=text(f.type,'image type',30)
 need(type==='image/png'||type==='image/jpeg'||type==='image/webp','Use a PNG, JPEG or WebP image')
 need(typeof f.data==='string'&&f.data.length<=1400000&&/^[A-Za-z0-9+/]+={0,2}$/.test(f.data),'Image is too large or invalid',413)
 let bytes:string;try{bytes=atob(f.data)}catch{need(false,'Invalid image bytes')}
 need(bytes.length>0&&bytes.length<=1048576,'Images are 1 MB at most',413)
 const b=(n:number)=>bytes.charCodeAt(n)
 need(type==='image/png'?bytes.startsWith('\x89PNG\r\n\x1a\n'):type==='image/jpeg'?b(0)===255&&b(1)===216&&b(2)===255:bytes.startsWith('RIFF')&&bytes.slice(8,12)==='WEBP','Image content does not match its type')
 return {name,type,data:f.data,size:bytes.length}
}

export async function aiCommand(c:Context,name:string,p:Record<string,any>,config:AiConfiguration={}) {
 if(!name.startsWith('ai.'))return undefined
 aiOwner(c.s,c.a)
 c.storedDigest=await keyed(c.secret??'',JSON.stringify({name,input:p}))
 if(name==='ai.consent'){
  keys(p,['week','site','request','image','consent'])
  need(p.consent===true||p.consent==='on','Explicit authorization is required before sharing with OpenAI')
  const week=text(p.week,'week',10),date=new Date(week+'T00:00:00Z');need(/^\d{4}-\d{2}-\d{2}$/.test(week)&&Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===week&&date.getUTCDay()===1,'Choose a Monday week')
  const site=text(p.site,'cafe',80);need(c.s.staff.some(w=>w.active&&!w.erased_at&&w.site===site),'Choose a cafe with active employees')
  need(typeof p.request==='string'&&p.request.length<=8000,'Use at most 8,000 characters for the staffing request')
  const request=p.request.trim(),image=imageInput(p.image);need(request||image,'Provide a request or a schedule image')
  need(config.OPENAI_API_KEY,'AI extraction is not configured. The owner must supply OPENAI_API_KEY privately.',503)
  const model=text(aiModel(config),'AI model',100),inputDigest=await keyed(c.secret??'',JSON.stringify({request,image,week,site,model}))
  return receipt(put(c,'aischedules',{week,site,timezone:c.s.timezone,request,image,inputDigest,baseDigest:await aiWeekDigest(c.s,week),status:'consented',consent:{actor:c.a.id,at:c.now,provider:'OpenAI',model,notice:'Source, request, cafe employee names and existing cafe schedule sent only for this extraction. Local source erasable; provider retention and disconnected backups remain outside app erasure.'}}))
 }
 const r=get(c.s,'aischedules',p.id);exact(r,p);need(r.status!=='erased','This source was erased',409)
 if(name==='ai.erase'){
  keys(p,['id','revision','reason','consent']);need(p.consent===true||p.consent==='on','Confirm source erasure')
  const reason=text(p.reason,'erasure reason',500)
  return receipt(put(c,'aischedules',{week:r.week,site:r.site,status:'erased',consent:r.consent,erasure:{actor:c.a.id,at:c.now,reason},...(r.rosterId?{rosterId:r.rosterId,rosterRevision:r.rosterRevision}:{})},r))
 }
 need(r.timezone===c.s.timezone,'Venue timezone changed; authorize a fresh extraction',409)
 if(name==='ai.extract'){
  keys(p,['id','revision']);need(r.status==='consented','Authorize a new source before another extraction',409)
  need(r.consent.model===aiModel(config),'AI model configuration changed; authorize a fresh extraction',409)
  const people=c.s.staff.filter(w=>w.active&&!w.erased_at&&w.site===r.site).map(w=>({id:w.id,name:w.name,site:w.site??''})),schedule=aiWeekShifts(c.s,r.week).filter(x=>(x.site||c.s.staff.find(w=>w.id===x.staffId)?.site)===r.site).map(aiShiftInput)
  const extracted=await extractSchedule(config,r as any,people,schedule)
  // A provider request can be slow. Authority and consent are checked again before saving output.
  const current=await c.db.prepare("SELECT data FROM l_records WHERE kind='aischedules' AND id=?").bind(r.id).first<{data:string}>()
  need(current&&JSON.parse(current.data).revision===r.revision,'Source changed while extraction was running; output was discarded',409)
  return receipt(put(c,'aischedules',{...r,...extracted,status:'extracted',extractedAt:c.now},r))
 }
 need(await aiWeekDigest(c.s,r.week)===r.baseDigest,'Schedule changed since this source was authorized. Start a fresh extraction.',409)
 if(name==='ai.review'){
  keys(p,['id','revision','rows','reason']);need(['extracted','reviewed'].includes(r.status),'Extract this source before reviewing it',409)
  const review=aiReview(c,r,p.rows),reason=text(p.reason,'review reason',500)
  return receipt(put(c,'aischedules',{...r,...review,review:{actor:c.a.id,at:c.now,reason},status:review.issues.length?'extracted':'reviewed'},r))
 }
 if(name==='ai.prepare'){
  keys(p,['id','revision']);need(r.status==='reviewed'&&!r.issues.length&&r.review?.actor,'Correct and confirm every row before preparing a draft',409)
  // Re-run all native employee, local-time and schedule validation on the exact saved review.
  const checked=aiReview(c,r,r.reviewRows);need(!checked.issues.length,checked.issues.map(x=>x.message).join('; '),409)
  const other=aiWeekShifts(c.s,r.week).filter(x=>(x.site||c.s.staff.find(w=>w.id===x.staffId)?.site||'')!==r.site).map(aiShiftInput)
  const roster=draftWeek(c,r.week,[...other,...checked.reviewedShifts]);const updated=put(c,'aischedules',{...r,status:'prepared',preparedAt:c.now,rosterId:roster.id,rosterRevision:roster.revision},r)
  return {...receipt(updated),approvalRequired:'roster.publish',approval:{id:roster.id,revision:roster.revision}}
 }
 need(false,'Unknown AI command',404)
}
