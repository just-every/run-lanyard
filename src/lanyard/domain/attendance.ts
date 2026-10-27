// CLOCK-004: live attendance. As of an instant, every published shift running then or starting that
// venue day is matched to the punches captured by then (the live board knows only those received): scheduled, present, on break,
// done, late, missing or no-show, with the punch's freshness, a wrong-cafe network and unresolved
// conflicts. A cafe's attendance rule turns a missing punch into a late alert after its grace and a
// no-show escalation after its no-show point; only a received punch or approved time closes one.
import {type Actor,type Context,type Row,type State,keys,text,integer,need,manager,get,put} from './model'
import {siteOf} from './team'
import {localDate} from './settings'
import {actorName} from './history'

const at=(v:string)=>Date.parse(v)
const num=(v:unknown)=>typeof v==='string'&&v.trim()!==''?Number(v):v
/** The punch captured by `asOf` for the shift: the clock matched to it, else the person's clock that began within two hours of its start. */
function punchFor(s:State,x:Row,asOf:string) {
 const known=s.clocks.filter(k=>k.staffId===x.staffId&&k.start<=asOf)
 return known.find(k=>k.shiftId===x.id)??known.find(k=>!k.shiftId&&Math.abs(at(k.start)-at(x.start))<=2*3600000)
}
export function board(s:State,a:Actor,asOf:string,site='') {
 const day=localDate(asOf,s.timezone),home=s.staff.find(p=>p.id===a.staffId)?.site??''
 const shifts=s.shifts.filter(x=>x.status==='published'&&(localDate(x.start,s.timezone)===day||x.start<=asOf&&x.end>asOf)).filter(x=>(a.role==='owner'||siteOf(s,x)===home)&&(!site||siteOf(s,x)===site)).sort((p,q)=>p.start.localeCompare(q.start))
 return shifts.map(x=>attendanceFact(s,x,asOf))
}
/** One shift at a report instant, including shifts that ended on an earlier venue day. */
export function attendanceFact(s:State,x:Row,asOf:string) {
  const cafe=siteOf(s,x),rule=s.attendrules.find(r=>r.site===cafe),grace=(rule?.graceMinutes??0)*60000,k=punchFor(s,x,asOf)
  const closed=k?.end&&k.end<=asOf,onBreak=k&&!closed&&(k.breaks??[]).some((b:any)=>b.start<=asOf&&(!b.end||b.end>asOf))
  const lateMinutes=k?Math.max(0,Math.round((at(k.start)-at(x.start))/60000)):null
  // Approved time covering the shift counts as a fact; a published or confirmed shift alone never does.
  const approved=s.timesheets.some(t=>t.staffId===x.staffId&&t.status==='approved'&&t.start<x.end&&t.end>x.start)
  const status=k?(closed?'done':onBreak?'on break':'present'):approved?'approved time':at(asOf)<at(x.start)?'scheduled':at(asOf)<at(x.start)+grace?'due':rule&&at(asOf)>=at(x.start)+rule.noShowMinutes*60000?'no-show':'missing'
  const conflicts=[...(k?.exceptions??[]),...(x.callout&&!x.callout.coveredBy?['called out, waiting for cover']:[])]
  const alert=rule&&(status==='missing'||status==='no-show')?{kind:status==='no-show'?'no-show':'late',since:new Date(at(x.start)+(status==='no-show'?rule.noShowMinutes*60000:grace)).toISOString(),acknowledged:s.attendacks.filter(r=>r.shiftId===x.id&&r.staffId===x.staffId).map(({by,byName,at,note})=>({by,byName,at,note}))}:null
  return {shiftId:x.id,revision:x.revision,staffId:x.staffId,name:s.staff.find(p=>p.id===x.staffId)?.name??'Former staff',site:cafe,start:x.start,end:x.end,status,
   lateMinutes:k?(lateMinutes!>(rule?.graceMinutes??0)?lateMinutes:0):null,
   punch:k?{clockId:k.id,start:k.start,end:closed?k.end:null,receivedAt:k.receivedAt,lastHeard:closed?k.closedReceivedAt:k.receivedAt,offlineMinutes:Math.max(0,Math.round((at(k.receivedAt)-at(k.start))/60000)),receivedAfter:k.receivedAt>asOf,seenAt:k.seenAt??null}:null,
   wrongSite:Boolean(k?.seenAt&&k.seenAt!==cafe),conflicts,alert}
}
export function attendance(c:Context,name:string,p:Record<string,any>) {
 if(name==='attendrule.save') {
  need(c.a.role==='owner','Owner required',403);keys(p,['site','graceMinutes','noShowMinutes','revision'])
  const site=text(p.site,'site',80,true),old=c.s.attendrules.find(r=>r.site===site)
  if(old)need(integer(p.revision,'revision',1,Number.MAX_SAFE_INTEGER)===old.revision,'Attendance rule changed; reload before saving',409)
  const graceMinutes=integer(num(p.graceMinutes),'late grace minutes',0,60),noShowMinutes=integer(num(p.noShowMinutes),'no-show minutes',5,240)
  need(noShowMinutes>graceMinutes,'The no-show point comes after the late grace')
  return put(c,'attendrules',{site,graceMinutes,noShowMinutes,savedBy:c.a.id,savedAt:c.now},old)
 }
 if(name==='attendance.acknowledge') {
  // A manager of the shift's cafe (or the owner) records that they are handling an alert; only a punch or approved time closes it.
  manager(c.a);keys(p,['shiftId','note']);const x=get(c.s,'shifts',p.shiftId)
  if(c.a.role==='manager')need((c.s.staff.find(v=>v.id===c.a.staffId)?.site??'')===siteOf(c.s,x),'Only a manager of this cafe',403)
  const row=board(c.s,{...c.a,role:'owner'},c.now).find(r=>r.shiftId===x.id);need(row?.alert,'This shift has no open attendance alert',409)
  return put(c,'attendacks',{shiftId:x.id,staffId:x.staffId,kind:row.alert.kind,note:text(p.note,'note',280),by:c.a.id,byName:actorName(c),at:c.now})
 }
 return undefined
}
