// FEEDBACK-001: after clock-out an employee rates their clocked shift (1-5), comments, flags an
// issue, or skips; one answer per clock. The shift's cafe is its matched shift's cafe, else the
// person's home cafe; its manager is whoever published that shift's week. The owner turns on
// anonymous feedback for the installation: an anonymous answer (safety flags included) shows
// managers and the owner only its cafe, date, manager and content, never its author, shift or
// timesheet. Its author, clock, history actor and command digest are stored only as digests keyed
// by the installation secret, so the records and archive alone never name the author; inside the
// installation the keys still serve the author's own view, replies and one-answer-per-clock fence.
// Feedback lives in its own records: pay, approval, schedules and rankings never read it.
import {type Actor,type Context,type State,type Row,keys,text,integer,need,self,manager,get,exact,put,keyed} from './model'
import {localDate} from './settings'

export const FLAGS=['understaffed','equipment','safety','conflict']
const num=(v:unknown)=>typeof v==='string'&&v.trim()!==''?Number(v):v
const yes=(v:unknown)=>v===true||v==='true'||v==='on'
export const anonymousOn=(s:State)=>s.feedbackopts[0]?.anonymous===true
const homeOf=(s:State,staffId?:string)=>s.staff.find(p=>p.id===staffId)?.site??''

export async function feedback(c:Context,name:string,p:Record<string,any>) {
 if(name==='feedback.submit') {
  keys(p,['timesheetId','rating','comment','flags','anonymous','skip']);const staffId=self(c.a),t=get(c.s,'timesheets',p.timesheetId)
  need(t.staffId===staffId&&t.clockId,'Give feedback on your own clocked shift',403)
  need(c.secret,'Installation secret missing',500);const clockKey=await keyed(c.secret,'feedback-clock:'+t.clockId)
  need(!c.s.feedback.some(f=>f.clockId===t.clockId||f.clockKey===clockKey),'Feedback for this shift is already recorded',409)
  const clock=c.s.clocks.find(x=>x.id===t.clockId),shift=clock?.shiftId?c.s.shifts.find(x=>x.id===clock.shiftId):undefined
  const base={staffId,clockId:t.clockId,timesheetId:t.id,shiftId:shift?.id??null,site:shift?.site||homeOf(c.s,staffId),date:localDate(t.start,c.s.timezone),at:c.now}
  if(yes(p.skip))return put(c,'feedback',{...base,skipped:true})
  const rating=p.rating===undefined||p.rating===''?null:integer(num(p.rating),'rating',1,5),comment=text(p.comment,'comment',1000,true)
  const list=p.flags===undefined||p.flags===''?[]:Array.isArray(p.flags)?p.flags:[p.flags]
  need(list.every((f:unknown)=>FLAGS.includes(f as string)),'Flag understaffed, equipment, safety or conflict')
  const flags=[...new Set(list as string[])]
  need(rating!==null||comment||flags.length,'Rate the shift, leave a comment or flag an issue, or skip')
  const anonymous=yes(p.anonymous);if(anonymous)need(anonymousOn(c.s),'Your employer has not turned on anonymous feedback')
  const roster=shift?c.s.rosters.find(r=>r.id===shift.rosterId):undefined
  const by=roster?.publishedBy?await c.db.prepare('SELECT display_name FROM oa_operators WHERE id=?').bind(roster.publishedBy).first<{display_name:string}>():null
  const content={rating,comment,flags,anonymous,managerId:roster?.publishedBy??null,managerName:by?.display_name??null,status:'open'}
  if(!anonymous)return put(c,'feedback',{...base,...content})
  // FEEDBACK-001 archive fence: the author link is kept only as keyed digests.
  c.storedActor=await keyed(c.secret,'feedback-actor:'+c.a.id);c.storedDigest=await keyed(c.secret,'feedback-command:'+t.id)
  return put(c,'feedback',{authorKey:await keyed(c.secret,'feedback-author:'+staffId),clockKey,site:base.site,date:base.date,at:base.at,...content})
 }
 if(name==='feedback.reply') {
  manager(c.a);keys(p,['id','revision','reply','resolve']);const f=get(c.s,'feedback',p.id);exact(f,p);need(!f.skipped,'Nothing to reply to',409)
  need(c.a.role==='owner'||homeOf(c.s,c.a.staffId)===f.site,'Only the cafe’s managers and the owner reply',403)
  const reply=text(p.reply,'reply',1000,true),resolve=yes(p.resolve);need(reply||resolve,'Write a reply or mark it resolved')
  return put(c,'feedback',{...f,...(reply?{reply,repliedBy:c.a.id,repliedAt:c.now}:{}),...(resolve?{status:'resolved',resolvedBy:c.a.id,resolvedAt:c.now}:{})},f)
 }
 if(name==='feedback.settings') {
  need(c.a.role==='owner','Owner required',403);keys(p,['anonymous','revision']);const old=c.s.feedbackopts[0]
  if(old)need(integer(num(p.revision),'revision',1,Number.MAX_SAFE_INTEGER)===old.revision,'Feedback settings changed; reload before saving',409)
  return put(c,'feedbackopts',{anonymous:yes(p.anonymous),savedBy:c.a.id,savedAt:c.now},old)
 }
 return undefined
}

/** Authors read their own answers (skips included, anonymous ones matched by key); the owner reads every cafe and a manager their home cafe, never others' skips or an anonymous author. */
export async function feedbackFor(s:State,a:Actor,secret?:string):Promise<Row[]> {
 if(a.role==='agent')return []
 const author=a.staffId&&secret?await keyed(secret,'feedback-author:'+a.staffId):null
 const clocks=author?new Map(await Promise.all(s.clocks.filter(x=>x.staffId===a.staffId).map(async x=>[await keyed(secret!,'feedback-clock:'+x.id),x.id] as const))):new Map()
 const mine=(f:Row)=>(Boolean(a.staffId)&&f.staffId===a.staffId)||(author!==null&&f.authorKey===author)
 const own=({authorKey,clockKey,...f}:Row)=>({...f,staffId:a.staffId,clockId:f.clockId??clocks.get(clockKey)}) as unknown as Row
 const hide=({authorKey,clockKey,...f}:Row)=>({...f,staffId:null}) as unknown as Row
 if(a.role==='staff')return s.feedback.filter(mine).map(own)
 const home=homeOf(s,a.staffId)
 return s.feedback.filter(f=>mine(f)||(!f.skipped&&(a.role==='owner'||f.site===home))).map(f=>mine(f)?own(f):f.anonymous?hide(f):f)
}
/** Records whose events only the person who performed them reads. */
export const privateEntity=(s:State,id:string)=>s.feedback.some(f=>f.id===id&&f.anonymous)
