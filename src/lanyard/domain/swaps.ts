import {restricted,allowed} from './access'
import {minimumRestIssue} from './policy'
// COVER-001: employee shift swaps. An employee offers one of their upcoming published shifts to
// an eligible coworker, or proposes exchanging it for one of that coworker's; the coworker consents
// and an owner, or a manager of the shifts' cafe, approves the exact exchange. Each step rechecks
// the pinned shift revisions and both people's eligibility; nothing moves until approval, which
// moves both shifts in one write and closes every other open swap on them.
import {type Context,type Row,type State,keys,text,need,fail,self,manager,get,exact,put} from './model'
import {rateBasis} from './workforce'
import {fit} from './cover'
import {siteOf} from './team'
import {actorName,swapHistory,confirmations} from './history'

const OPEN=['proposed','accepted']
type Pin={shiftId:string;revision:number;start:string;end:string;site:string;label:string}
const pin=(s:State,x:Row):Pin=>({shiftId:x.id,revision:x.revision,start:x.start,end:x.end,site:siteOf(s,x),label:x.label??''})

/** A coworker the person may swap with: active, same home cafe and position (when set), and not hidden from the team view. */
export function coworker(s:State,meId:string,id:string) {
 const me=s.staff.find(p=>p.id===meId),p=s.staff.find(v=>v.id===id),hidden=new Set(s.teamviews.flatMap(v=>v.hidden))
 return Boolean(me&&p&&p.id!==me.id&&p.active&&!p.erased_at&&!hidden.has(p.id)&&(p.site??'')===(me.site??'')&&(!me.position||p.position===me.position))
}
/** Whether the taker may work the shift once they give up `skip`: overlap, availability (AVAIL-001) and approved leave refuse; overtime is shown, never hidden. */
function check(s:State,takerId:string,shift:Row,skip:string[]) {
 const rest=minimumRestIssue(s,takerId,shift,skip);if(rest)return {block:rest,overtime:null}
 const f=fit(s,takerId,shift,skip)
 return {block:f.reason&&f.reason!=='overtime'?(f.minorRule??f.reason):null,overtime:f.reason==='overtime'?{staffId:takerId,after:f.after}:null}
}
/** The pinned shift as it is now, refused when it changed, moved, was called out or has started. */
function current(c:Context,p:Pin,ownerId:string) {
 const x=c.s.shifts.find(v=>v.id===p.shiftId)
 need(x&&x.status==='published'&&x.revision===p.revision&&x.staffId===ownerId&&!x.callout,'This swap is stale: a shift in it changed after it was proposed',409)
 need(x.start>c.now,'A shift in this swap has already started',409)
 return x
}
/** Both moves of a swap, rechecked now; the reason names the person only for the reader allowed to know it. */
function recheck(c:Context,w:Record<string,any>,reader:string) {
 const give=current(c,w.give,w.fromId),take=w.take?current(c,w.take,w.toId):null
 const moves=[{taker:w.toId,shift:give,skip:take?[take.id]:[]},...(take?[{taker:w.fromId,shift:take,skip:[give.id]}]:[])]
 const overtime=[]
 for(const m of moves) {
  const r=check(c.s,m.taker,m.shift,m.skip),name=c.s.staff.find(p=>p.id===m.taker)?.name??'Former staff'
  need(c.s.staff.some(p=>p.id===m.taker&&p.active&&!p.erased_at),`${name} is no longer active staff`,409)
  if(r.block)fail(reader==='manager'||reader===m.taker?`${name} is not eligible for this shift: ${r.block}`:`${name} is not eligible for this shift`,409)
  if(r.overtime)overtime.push(r.overtime)
 }
 return {give,take,overtime}
}
/** For the person's own upcoming shifts: coworkers who could take each, and coworkers' shifts at their cafe it could be exchanged for. */
export function swapOptions(s:State,meId:string,now:string) {
 const future=(x:Row)=>x.status==='published'&&!x.callout&&x.start>now
 const team=s.staff.filter(p=>coworker(s,meId,p.id)),home=s.staff.find(p=>p.id===meId)?.site??''
 return s.shifts.filter(x=>x.staffId===meId&&future(x)).sort((a,b)=>a.start.localeCompare(b.start)).map(mine=>({shiftId:mine.id,revision:mine.revision,start:mine.start,end:mine.end,
  give:team.filter(p=>!check(s,p.id,mine,[]).block).map(p=>({staffId:p.id,name:p.name})),
  exchange:team.flatMap(p=>s.shifts.filter(x=>x.staffId===p.id&&future(x)&&siteOf(s,x)===home&&!check(s,p.id,mine,[x.id]).block&&!check(s,meId,x,[mine.id]).block).map(x=>({shiftId:x.id,staffId:p.id,name:p.name,start:x.start,end:x.end})))}))
}
export function swaps(c:Context,name:string,p:Record<string,any>) {
 if(name==='swap.propose') {
  keys(p,['shiftId','revision','to','theirShiftId','note']);const me=self(c.a)!,mine=get(c.s,'shifts',p.shiftId)
  need(mine.staffId===me,'Only your own shift',403);exact(mine,p)
  const theirs=p.theirShiftId?get(c.s,'shifts',p.theirShiftId):null,to=theirs?theirs.staffId:text(p.to,'coworker',80)
  need(!p.to||p.to===to,'Choose that coworker’s own shift to exchange');need(coworker(c.s,me,to),'Choose an eligible coworker at your cafe',409)
  need(!c.s.swaps.some(w=>OPEN.includes(w.status)&&w.give.shiftId===mine.id&&w.toId===to&&(w.take?.shiftId??null)===(theirs?.id??null)),'You already proposed this swap',409)
  const w={fromId:me,toId:to,give:pin(c.s,mine),take:theirs?pin(c.s,theirs):null,note:text(p.note,'note',280,true),status:'proposed',proposedAt:c.now}
  return put(c,'swaps',{...w,overtime:recheck(c,w,me).overtime})
 }
 if(name==='swap.respond') {
  keys(p,['id','revision','decision','note']);const w=get(c.s,'swaps',p.id);exact(w,p);need(w.toId===self(c.a),'Only a swap offered to you',403)
  need(w.status==='proposed','This swap is no longer waiting for your answer',409);need(['accepted','declined'].includes(p.decision),'Invalid decision')
  const overtime=p.decision==='accepted'?recheck(c,w,w.toId).overtime:w.overtime
  return put(c,'swaps',{...w,status:p.decision,overtime,reply:text(p.note,'note',280,true),respondedAt:c.now},w)
 }
 if(name==='swap.withdraw') {
  keys(p,['id','revision']);const w=get(c.s,'swaps',p.id);exact(w,p);need(w.fromId===self(c.a),'Only your own swap',403);need(OPEN.includes(w.status),'This swap is already decided',409)
  return put(c,'swaps',{...w,status:'withdrawn',withdrawnAt:c.now},w)
 }
 if(name==='swap.decide') {
  manager(c.a);keys(p,['id','revision','decision','note']);const w=get(c.s,'swaps',p.id);exact(w,p)
  need(w.status==='accepted','Only a swap both people agreed to can be decided',409);need(c.a.staffId!==w.fromId&&c.a.staffId!==w.toId,'You cannot decide your own swap',403)
  // Until TEAM-001 brings site scopes, a manager decides swaps whose shifts are all at their home cafe; the owner decides any.
  const home=c.s.staff.find(v=>v.id===c.a.staffId)?.site??''
  if(c.a.role==='manager')need([w.give,w.take].every(x=>!x||(restricted(c.s,c.a)?allowed(c.s,c.a,'swap.approve',x.site):x.site===home)),'Only a manager of this shift’s cafe can decide this swap',403)
  need(['approved','refused'].includes(p.decision),'Invalid decision');const note=text(p.note,'note',280,true)
  if(p.decision==='refused')return put(c,'swaps',{...w,status:'refused',decisionNote:note,decidedBy:c.a.id,decidedAt:c.now},w)
  const {give,take,overtime}=recheck(c,w,'manager')
  for(const o of c.s.swaps.filter(o=>o.id!==w.id&&OPEN.includes(o.status)&&[o.give.shiftId,o.take?.shiftId].some(id=>id===give.id||id===take?.id)))put(c,'swaps',{...o,status:'closed',closedBy:w.id,closedAt:c.now},o)
  const moved=(x:Row,from:string,to:string)=>put(c,'shifts',{...x,staffId:to,rateBasis:rateBasis(c.s,to,x),confirmations:[...confirmations(x),{staffId:to,at:w.respondedAt}],confirmedAt:w.respondedAt,confirmedBy:w.toId===to?to:w.fromId,swapHistory:[...swapHistory(x),{id:w.id,from,to,reason:note,approvedBy:c.a.id,approvedByName:actorName(c),at:c.now}],swap:{id:w.id,from,approvedBy:c.a.id,approvedByName:actorName(c),at:c.now}},x)
  moved(give,w.fromId,w.toId);if(take)moved(take,w.toId,w.fromId)
  return put(c,'swaps',{...w,status:'approved',overtime,decisionNote:note,decidedBy:c.a.id,decidedAt:c.now},w)
 }
 return undefined
}
