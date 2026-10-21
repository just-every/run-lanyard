// Call-out cover: the person (or a manager) calls out of a published shift, Lanyard
// offers it to every qualified teammate who stays inside overtime, each answers,
// and a manager approves one accepted offer. Only the cover's clock-in closes it.
import {type Context,type Row,type State,keys,text,need,manager,self,get,exact,put,overlap} from './model'
import {workweek} from './payschedules'
import {qualification,rateBasis,profileOf} from './workforce'
import {available,onLeave} from './roster'
import {localDate} from './settings'
import {patternFit} from './patterns'
import {replacementOrder,tiers} from './offerorder'
import {siteOf} from './team'
import {coverageCase} from './coverage'

const WEEK_LIMIT=40*60, DAY_LIMIT=8*60
type Fit={staffId:string;before:number;after:number;reason?:'overtime'|'already on'|'unavailable'|'time off'|'not qualified'|'maximum hours';shiftId?:string;overlap?:number}

/** Minutes a person is already published for in the shift's workweek and on its day. */
function load(s:State,staffId:string,shift:Row,skip:string[]) {
 const day=localDate(shift.start,s.timezone),week=workweek(s,staffId,day)
 const mine=s.shifts.filter(x=>x.staffId===staffId&&x.status==='published'&&x.id!==shift.id&&!skip.includes(x.id))
 const inWeek=mine.filter(x=>workweek(s,staffId,localDate(x.start,s.timezone))===week)
 return {week:inWeek.reduce((n,x)=>n+x.minutes,0),day:inWeek.filter(x=>localDate(x.start,s.timezone)===day).reduce((n,x)=>n+x.minutes,0),clash:mine.find(x=>overlap(x,shift))}
}
/** One teammate measured against the shift (ignoring shifts they would give up, for a swap): qualified, or the reason they are left out. */
export function fit(s:State,staffId:string,shift:Row,skip:string[]=[]):Fit {
 const {week,day,clash}=load(s,staffId,shift,skip),f:Fit={staffId,before:week,after:week+shift.minutes}
 if(qualification(s,staffId,shift))return {...f,reason:'not qualified'}
 if(clash)return {...f,reason:'already on',shiftId:clash.id,overlap:(Math.min(Date.parse(clash.end),Date.parse(shift.end))-Math.max(Date.parse(clash.start),Date.parse(shift.start)))/60000}
 if(!available(s,staffId,shift))return {...f,reason:'unavailable'}
 if(onLeave(s,staffId,shift))return {...f,reason:'time off'}
 if(f.after>(profileOf(s,staffId)?.maxHours??168)*60)return {...f,reason:'maximum hours'}
 if(f.after>WEEK_LIMIT||day+shift.minutes>DAY_LIMIT)return {...f,reason:'overtime'}
 return f
}
/** Teammates in the caller's position (everyone, if positions are not set): qualified by least hours after,
 * left out by reason (overtime first, then whoever overlaps the shift least: the nearest to covering it). */
export function shortlist(s:State,shift:Row) {
 const caller=s.staff.find(p=>p.id===shift.staffId),order={'overtime':0,'already on':1,'time off':2,'unavailable':3,'not qualified':4,'maximum hours':5}
 const team=s.staff.filter(p=>p.id!==shift.staffId&&p.active&&!p.erased_at&&(!caller?.position||p.position===caller.position)).map(p=>fit(s,p.id,shift))
 // AVAIL-001: whoever's effective pattern marks the whole shift preferred ranks first.
 const preferred=(f:Fit)=>patternFit(s,f.staffId,shift)?.preferred?0:1
 return {qualified:team.filter(f=>!f.reason).sort((a,b)=>preferred(a)-preferred(b)||a.after-b.after),leftOut:team.filter(f=>f.reason).sort((a,b)=>order[a.reason!]-order[b.reason!]||(a.overlap??0)-(b.overlap??0)||a.after-b.after)}
}
/** A manager acts on the same cafe scope as the live attendance board. */
function manages(c:Context,r:Row) {
 manager(c.a)
 if(c.a.role==='manager')need((c.s.staff.find(p=>p.id===c.a.staffId)?.site??'')===siteOf(c.s,r),'Only a manager of this cafe',403)
}
/** Each offer pins the assignment revision and expires at its real shift end.
 * With no saved cafe rule, the preferred-first shortlist is offered in that order;
 * an explicitly saved COVER-004 tier rule keeps its own ranking and opening times. */
function outreach(c:Context,r:Row,list:ReturnType<typeof shortlist>) {
 const log=tiers(c.s,replacementOrder(c.s,siteOf(c.s,r)),list.qualified,r,c.now)
 return log.tiers.flatMap((t,tier)=>t.staffIds.map(id=>{const f=list.qualified.find(v=>v.staffId===id)!;return put(c,'offers',{shiftId:r.id,shiftRevision:r.revision,fromStaffId:r.staffId,staffId:id,before:f.before,after:f.after,status:'sent',createdAt:c.now,sentAt:t.opensAt,tier:tier+1,opensAt:t.opensAt,expiresAt:r.end})}))
}
export function cover(c:Context,name:string,p:Record<string,any>) {
 if(name==='shift.callout') {
  keys(p,['id','revision','note']);const r=get(c.s,'shifts',p.id);exact(r,p)
  if(c.a.role==='owner'||c.a.role==='manager')manages(c,r)
  else need(r.staffId===self(c.a),'Only your own shift',403)
  need(c.a.role!=='agent','Staff or manager required',403);need(r.status==='published','Only a published shift can be called out',409)
  need(!r.callout,'This shift is already called out',409);need(r.end>c.now,'This shift has already ended',409)
  const list=shortlist(c.s,r),note=text(p.note,'note',280,true)
  const shift=put(c,'shifts',{...r,site:siteOf(c.s,r),callout:{staffId:r.staffId,note,at:c.now,by:c.a.id,qualified:list.qualified,leftOut:list.leftOut}},r)
  const offers=outreach(c,shift,list)
  c.entity=shift.id;return {shift,offers}
 }
 if(name==='cover.respond') {
  keys(p,['id','revision','decision','note']);const o=get(c.s,'offers',p.id);exact(o,p);need(o.staffId===self(c.a),'Only your own offer',403)
  const r=get(c.s,'shifts',o.shiftId);need(r.end>c.now,'This offer expired at shift end',409)
  need(r.status==='published'&&o.shiftRevision===r.revision,'The offered shift changed; ask for a fresh offer',409)
  need(['accepted','declined'].includes(p.decision),'Invalid decision');need(o.status==='sent','This offer is already answered or closed',409);need(!o.opensAt||o.opensAt<=c.now,'This offer has not reached you yet',409)
  return put(c,'offers',{...o,status:p.decision,note:text(p.note,'note',280,true),respondedAt:c.now},o)
 }
 if(name==='cover.reopen') {
  keys(p,['id','revision']);const r=get(c.s,'shifts',p.id);manages(c,r);exact(r,p)
  need(r.status==='published'&&r.callout&&['waiting','reopened'].includes(coverageCase(c.s,r,c.now).status),'This coverage case is not waiting or reopened',409)
  // Retain the assignment and all approvals. Each explicit reoffer closes only
  // outstanding offers and records the fresh shortlist against a new revision.
  const list=shortlist(c.s,{...r,staffId:r.callout.staffId})
  list.qualified=list.qualified.filter(f=>f.staffId!==r.staffId)
  list.leftOut=list.leftOut.filter(f=>f.staffId!==r.staffId)
  for(const x of c.s.offers.filter(x=>x.shiftId===r.id&&['sent','accepted'].includes(x.status)))put(c,'offers',{...x,status:'closed',closedAt:c.now},x)
  const shift=put(c,'shifts',{...r,callout:{...r.callout,qualified:list.qualified,leftOut:list.leftOut,reoffers:[...(r.callout.reoffers??[]),{at:c.now,by:c.a.id,staffId:r.staffId,shiftRevision:r.revision}]}},r)
  const offers=outreach(c,shift,list)
  c.entity=shift.id;return {shift,offers}
 }
 if(name==='cover.approve') {
  manager(c.a);keys(p,['id','revision']);const o=get(c.s,'offers',p.id);exact(o,p);need(o.status==='accepted','Only an accepted offer can be approved',409)
  const r=get(c.s,'shifts',o.shiftId);manages(c,r)
  need(r.end>c.now,'This offer expired at shift end',409)
  need(r.status==='published'&&r.callout&&o.shiftRevision===r.revision,'The offered shift changed; ask for a fresh offer',409)
  need(!r.callout.coveredBy||coverageCase(c.s,r,c.now).status==='reopened','This shift is no longer waiting for cover',409)
  need(o.staffId!==r.staffId&&o.staffId!==r.callout.staffId,'Offer must be for another replacement',409)
  need(c.s.staff.some(p=>p.id===o.staffId&&p.active&&!p.erased_at),'Replacement is no longer active',409)
  const now=fit(c.s,o.staffId,r);need(!now.reason,`No longer qualified: ${now.reason}`,409)
  for(const x of c.s.offers.filter(x=>x.shiftId===r.id&&x.id!==o.id&&['sent','accepted'].includes(x.status)))put(c,'offers',{...x,status:'closed',closedAt:c.now},x)
  // Prior approved offers remain approved: a new approval never rewrites history.
  put(c,'offers',{...o,status:'approved',approvedBy:c.a.id,approvedByName:c.a.staffId?c.s.staff.find(p=>p.id===c.a.staffId)?.name??'Former manager':'Owner',approvedAt:c.now},o)
  const approvals=c.s.offers.filter(v=>v.shiftId===r.id&&v.status==='approved').sort((a,b)=>a.approvedAt.localeCompare(b.approvedAt)).map(v=>({offerId:v.id,staffId:v.staffId,fromStaffId:v.fromStaffId,shiftRevision:v.shiftRevision,approvedBy:v.approvedBy,approvedByName:v.approvedByName,approvedAt:v.approvedAt,acknowledgedAt:v.respondedAt}))
  return put(c,'shifts',{...r,staffId:o.staffId,rateBasis:rateBasis(c.s,o.staffId,r),confirmedAt:o.respondedAt,confirmedBy:o.staffId,callout:{...r.callout,coveredBy:o.staffId,approvedBy:c.a.id,approvedAt:c.now,approvals}},r)
 }
 return undefined
}
