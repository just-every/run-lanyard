import {priced} from './workforce'
// COVER-003: a coverage case follows the published assignment. An accepted offer
// is the in-app acknowledgment; only a recorded replacement punch verifies cover.
import {type Actor,type Row,type State,instant,manager} from './model'
import {siteOf} from './team'
import {cost,project} from './overtime'
import {weekOf} from './openshifts'

/** An observed arrival needs a received capture, never an acceptance or time estimate. */
export function receivedCoverageClock(s:State,x:Row,asOf:string) {
 const known=s.clocks.filter(k=>k.staffId===x.staffId&&k.start<=asOf&&k.receivedAt<=asOf&&(k.seenAt===undefined||k.seenAt===siteOf(s,x)))
 const punch=known.find(k=>k.shiftId===x.id)??known.find(k=>!k.shiftId&&k.start<x.end&&Math.abs(Date.parse(k.start)-Date.parse(x.start))<=7200000)
 return punch?{clockId:punch.id,start:punch.start,receivedAt:punch.receivedAt}:null
}

/** Expiry is a read-time fact, never a synthetic response or a changed approval. */
export function coverageOffers(s:State,shift:Row,asOf:string):Row[] {
 return s.offers.filter(o=>o.shiftId===shift.id).map(o=>({...o,legacy:!Number.isInteger(o.shiftRevision),expiresAt:shift.end,
  status:['sent','accepted'].includes(o.status)&&asOf>=shift.end?'expired':o.status}))
}
/** Uses CLOCK-004's shift-linked punch first, else an unlinked capture within two
 * hours of start, plus its approved-time and configured no-show semantics. */
export function coverageCase(s:State,x:Row,asOf:string) {
 const c=x.callout,cafe=siteOf(s,x),rule=s.attendrules.find(r=>r.site===cafe)
 // An acceptance or approved time is never represented as a recorded clock.
 const known=s.clocks.filter(k=>k.staffId===x.staffId&&k.start<=asOf)
 const punch=known.find(k=>k.shiftId===x.id)??known.find(k=>!k.shiftId&&Math.abs(Date.parse(k.start)-Date.parse(x.start))<=7200000)
 const clock=c.coveredBy&&punch?{clockId:punch.id,start:punch.start,receivedAt:punch.receivedAt,receivedAfter:punch.receivedAt>asOf}:null
 const approvedTime=s.timesheets.some(t=>t.staffId===x.staffId&&t.status==='approved'&&t.start<x.end&&t.end>x.start)
 const noShowAt=rule?new Date(Date.parse(x.start)+rule.noShowMinutes*60000).toISOString():null
 const missed=Boolean(c.coveredBy&&!clock&&!approvedTime&&noShowAt&&asOf>=noShowAt)
 const status=clock?'verified':asOf>=x.end?'expired':missed?'reopened':c.coveredBy?'assigned':'waiting'
 const shiftCents=(id:string)=>priced(s,id,x).costCents
 const originalShiftCents=shiftCents(c.staffId)
 const offers=coverageOffers(s,x,asOf).map((o):Row=>{const candidateShiftCents=shiftCents(o.staffId)
  return {...o,cost:{...cost(project(s,o.staffId,weekOf(s,x.start),asOf,[{...x,staffId:o.staffId}],[x.id])),shiftCents:candidateShiftCents,originalShiftCents,differenceCents:candidateShiftCents!==null&&originalShiftCents!==null?candidateShiftCents-originalShiftCents:null}}
 })
 const actionable=status==='waiting'||status==='reopened'
 const exception=actionable?{kind:status==='reopened'?'replacement no-show':'unfilled',since:status==='reopened'?noShowAt:c.at,managerStaffIds:s.staff.filter(p=>p.active&&!p.erased_at&&p.role==='manager'&&(p.site??'')===cafe).map(p=>p.id),owner:true}:null
 const timeline=[{kind:'called out',at:c.at,staffId:c.staffId},
  ...offers.flatMap(o=>[...(o.sentAt<x.end?[{kind:'offered in app',at:o.sentAt,staffId:o.staffId,offerId:o.id}]:[]),...(o.respondedAt?[{kind:o.status==='declined'?'declined':'acknowledged',at:o.respondedAt,staffId:o.staffId,offerId:o.id}]:[]),...(o.approvedAt?[{kind:'approved',at:o.approvedAt,staffId:o.staffId,offerId:o.id}]:[])]),
  ...(c.reoffers??[]).map((r:any)=>({kind:'reoffered',at:r.at,staffId:r.staffId})),
  ...(missed?[{kind:'replacement no-show',at:noShowAt!,staffId:x.staffId}]:[]),
  ...(clock?[{kind:'recorded clock-in',at:clock.start,staffId:x.staffId,clockId:clock.clockId}]:[])]
  .filter(e=>e.at<=asOf).sort((a,b)=>a.at.localeCompare(b.at))
 return {shiftId:x.id,revision:x.revision,site:cafe,start:x.start,end:x.end,asOf,status,actionable,exception,timeline,
  originalStaffId:c.staffId,staffId:x.staffId,calledOutAt:c.at,note:c.note,assignedAt:c.approvedAt??null,
  noShowAt,reopenedAt:missed?noShowAt:null,clock,
  notice:{channel:'in-app',offers:offers.map(o=>({offerId:o.id,staffId:o.staffId,offeredAt:o.sentAt,expiresAt:o.expiresAt,reached:asOf>=o.sentAt&&o.sentAt<x.end,acknowledgedAt:o.respondedAt??null,decision:o.status}))},
  offers,approvals:offers.filter(o=>o.status==='approved').sort((a,b)=>a.approvedAt.localeCompare(b.approvedAt)).map(o=>({offerId:o.id,staffId:o.staffId,shiftRevision:o.shiftRevision,approvedBy:o.approvedBy,approvedAt:o.approvedAt,acknowledgedAt:o.respondedAt})),
  reoffers:c.reoffers??[]}
}
/** Owner: every cafe. Managers: their home cafe, exactly the attendance scope. */
export function coverageCases(s:State,a:Actor,asOf:string,site='') {
 manager(a);asOf=instant(asOf,'asOf')
 const home=s.staff.find(p=>p.id===a.staffId)?.site??''
 return s.shifts.filter(x=>x.status==='published'&&x.callout&&x.callout.at<=asOf&&(a.role==='owner'||siteOf(s,x)===home)&&(!site||siteOf(s,x)===site))
  .sort((x,y)=>x.start.localeCompare(y.start)||x.id.localeCompare(y.id)).map(x=>coverageCase(s,x,asOf))
}
