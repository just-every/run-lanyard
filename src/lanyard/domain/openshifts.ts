// COVER-002: open shifts. A manager posts an unassigned shift for a cafe and position to every
// eligible teammate or to a chosen pool, deciding whether a pickup is approved at once or waits
// for a manager. Eligible staff see it with their own rate and request it; assignment rechecks
// eligibility, adds the shift to the published week once and closes every other request.
import {type Context,type Row,type State,keys,text,integer,need,manager,self,staff,get,exact,put,work} from './model'
import {fit} from './cover'
import {localDate} from './settings'

const APPROVAL=['auto','manager']
/** The Monday of the venue week holding an instant. */
export function weekOf(s:State,at:string) {
 const d=localDate(at,s.timezone),n=new Date(d+'T00:00:00Z').getUTCDay();return new Date(Date.parse(d+'T00:00:00Z')-((n+6)%7)*86400000).toISOString().slice(0,10)
}
/** Whether a person may pick the open shift up: active, in its pool (or its cafe and position), and free (overlap, availability, approved leave); overtime is shown, never refused. */
export function pickupFit(s:State,staffId:string,o:Row) {
 const p=s.staff.find(v=>v.id===staffId),hidden=new Set(s.teamviews.flatMap(v=>v.hidden))
 if(!p||!p.active||p.erased_at||hidden.has(p.id))return {block:'not eligible'}
 if(o.pool?!o.pool.includes(p.id):(p.site??'')!==o.site||(o.position&&p.position!==o.position))return {block:'not eligible'}
 // Hours are counted in the week's published revision, as a shift in it would be.
 const f=fit(s,staffId,{...o,rosterId:s.rosters.find(r=>r.week===o.week&&r.status==='published')?.id} as Row)
 return f.reason&&f.reason!=='overtime'?{block:f.reason}:{overtime:f.reason==='overtime'?f.after:null,after:f.after}
}
/** Open shifts the person may request, each with their own hourly rate when it is theirs to see. */
export function openFor(s:State,staffId:string,showRate:boolean) {
 const rate=s.staff.find(p=>p.id===staffId)?.rate_cents??null
 return s.openshifts.filter(o=>o.status==='open'&&!pickupFit(s,staffId,o).block).map(o=>({...o,pool:undefined,...(showRate&&rate!==null?{hourlyRateCents:rate}:{})}))
}
/** Assigns the open shift: a published shift row in the week's published revision, other requests closed. */
function assign(c:Context,o:Row,staffId:string,pickup:Row|null) {
 const r=c.s.rosters.find(x=>x.week===o.week&&x.status==='published');need(r,'Publish this week before filling its open shifts',409)
 const shift=put(c,'shifts',{rosterId:r.id,staffId,start:o.start,end:o.end,breakMinutes:o.breakMinutes,minutes:o.minutes,label:o.label,site:o.site,status:'published',confirmedAt:c.now,confirmedBy:staffId,openShiftId:o.id})
 for(const x of c.s.pickups.filter(x=>x.openShiftId===o.id&&x.status==='requested'&&x.id!==pickup?.id))put(c,'pickups',{...x,status:'closed',closedAt:c.now},x)
 if(pickup)put(c,'pickups',{...pickup,status:'approved',approvedBy:c.a.id,approvedAt:c.now},pickup)
 put(c,'openshifts',{...o,status:'filled',filledBy:staffId,shiftId:shift.id,filledAt:c.now},o)
 c.entity=o.id;return {openShift:get(c.s,'openshifts',o.id),shift}
}
/** Until TEAM-001 brings site scopes, a manager posts and approves only at their home cafe; the owner at any. */
function scoped(c:Context,site:string) {
 if(c.a.role==='manager')need((c.s.staff.find(v=>v.id===c.a.staffId)?.site??'')===site,'Only a manager of this cafe can do this',403)
}
function recheck(c:Context,o:Row,staffId:string,mine:boolean) {
 need(o.status==='open','This open shift is no longer open',409);need(o.start>c.now,'This open shift has already started',409)
 const f=pickupFit(c.s,staffId,o);if(f.block)need(false,f.block==='not eligible'?'This open shift is not offered to this person':mine||c.a.role!=='staff'?`Not eligible for this shift: ${f.block}`:'Not eligible for this shift',409)
 return f
}
/** Open shift rows a draft carries (SCHEDULE-002 position-only template rows); posted when the draft is published. */
export function draftOpenShift(c:Context,rosterId:string,week:string,slot:{start:string;end:string;breakMinutes:number;label:string;site:string;position:string}) {
 const w=work(slot);return put(c,'openshifts',{week,rosterId,site:slot.site,position:slot.position,...w,label:slot.label,pool:null,approval:'manager',status:'draft',postedBy:c.a.id,postedAt:c.now})
}
export function openShifts(c:Context,name:string,p:Record<string,any>) {
 if(name==='openshift.post') {
  manager(c.a);keys(p,['site','position','start','end','breakMinutes','label','pool','approval'])
  const w=work({...p,breakMinutes:typeof p.breakMinutes==='string'?Number(p.breakMinutes):p.breakMinutes??0});need(w.start>c.now,'Post open shifts that have not started')
  need(APPROVAL.includes(p.approval),'Choose approved pickup or manager approval');scoped(c,text(p.site,'site',80,true))
  const pool=p.pool===undefined||p.pool===''?null:(Array.isArray(p.pool)?p.pool:[p.pool]).map((id:unknown)=>staff(c,id).id)
  need(!pool||pool.length>0&&pool.length<=200,'Choose 1–200 people for the pool')
  return put(c,'openshifts',{week:weekOf(c.s,w.start),rosterId:null,site:text(p.site,'site',80,true),position:text(p.position,'position',80,true),...w,label:text(p.label,'label',120,true),pool,approval:p.approval,status:'open',postedBy:c.a.id,postedAt:c.now})
 }
 if(name==='openshift.request') {
  keys(p,['id','revision']);const me=self(c.a)!,o=get(c.s,'openshifts',p.id);exact(o,p)
  need(!c.s.pickups.some(x=>x.openShiftId===o.id&&x.staffId===me&&x.status==='requested'),'You already requested this shift',409)
  const f=recheck(c,o,me,true)
  if(o.approval==='auto')return assign(c,o,me,null)
  return put(c,'pickups',{openShiftId:o.id,staffId:me,status:'requested',after:f.after,overtime:f.overtime,requestedAt:c.now})
 }
 if(name==='openshift.approve') {
  manager(c.a);keys(p,['id','revision']);const x=get(c.s,'pickups',p.id);exact(x,p);need(x.status==='requested','This request is no longer waiting',409)
  need(x.staffId!==c.a.staffId,'You cannot approve your own pickup',403)
  const o=get(c.s,'openshifts',x.openShiftId);scoped(c,o.site);recheck(c,o,x.staffId,true);return assign(c,o,x.staffId,x)
 }
 return undefined
}
