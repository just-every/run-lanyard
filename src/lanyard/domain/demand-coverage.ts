// COVERAGE-001: a reviewed manual-demand deficit follows an existing open shift.
// This record grants no staffing authority and never posts or publishes work.
import {type Actor,type Context,type Row,type State,canonical,exact,get,integer,keys,manager,need,put,sha,text} from './model'
import {restricted} from './access'
import {demandCompute,digestOf,savedVersions,datePlus} from './demand'
import {planningDemand} from './planning-inputs'
import {instantAt} from './settings'
import {weekOf} from './openshifts'
import {receivedCoverageClock} from './coverage'

export function demandCoverageScope(s:State,a:Actor,site:string) {
 manager(a);need(!restricted(s,a),'Demand coverage is unavailable to custom levels',403)
 need(a.role==='owner'||s.staff.some(p=>p.id===a.staffId&&(p.site??'')===site),'Not found',404)
}
const positionOf=(s:State,x:Row)=>s.jobs.find(j=>j.id===x.job)?.name??s.staff.find(p=>p.id===x.staffId)?.position??x.position??''
const openFacts=(o:Row)=>({id:o.id,revision:o.revision,site:o.site,week:o.week,position:o.position,job:o.job,start:o.start,end:o.end,minutes:o.minutes,breakMinutes:o.breakMinutes,approval:o.approval})
const round=(v:number)=>Math.round(v*100)/100
function bounds(s:State,date:string,hour:number) {
 return {start:instantAt(date,`${String(hour).padStart(2,'0')}:00`,s.timezone),end:hour===23?instantAt(datePlus(date,1),'00:00',s.timezone):instantAt(date,`${String(hour+1).padStart(2,'0')}:00`,s.timezone)}
}
function contribution(x:Row,start:string,end:string) {
 const overlap=Math.max(0,Math.min(Date.parse(x.end),Date.parse(end))-Math.max(Date.parse(x.start),Date.parse(start)))
 return round(overlap/(Date.parse(x.end)-Date.parse(x.start))*x.minutes)
}
async function source(s:State,site:string,date:string,hour:number,position:string,now:string,excludeOpenShift?:string) {
 const forecast=savedVersions(s,site,date)[0];need(forecast,'Save a forecast before reviewing coverage',409)
 need(forecast.status==='complete'&&forecast.hours[hour]?.roles?.some((r:any)=>r.position===position),'This forecast interval has no known role demand',409)
 const liveDigest=await digestOf(demandCompute(s,site,date,now))
 need(liveDigest===forecast.digest,'Forecast sources changed; save and review a fresh forecast',409)
 const window=bounds(s,date,hour),week=weekOf(s,window.start),roster=s.rosters.find(r=>r.week===week&&r.status==='published')
 need(roster,'Publish this week before reviewing demand coverage',409)
 const rows=s.shifts.filter(x=>x.status==='published'&&x.rosterId===roster.id&&x.openShiftId!==excludeOpenShift)
 const interval=planningDemand(s,week,site,rows,[date]).intervals.find(x=>x.hour===hour&&x.position===position)!
 const reviewed={forecast:{id:forecast.id,revision:forecast.revision,version:forecast.version,digest:forecast.digest,source:forecast.source},liveDigest,
  roster:{id:roster.id,revision:roster.revision,week},interval:{...interval,...window},
  coverage:rows.filter(x=>x.site===site&&positionOf(s,x)===position&&x.start<window.end&&x.end>window.start).map(x=>({id:x.id,revision:x.revision,staffId:x.staffId,start:x.start,end:x.end,minutes:x.minutes,position:positionOf(s,x)})).sort((a,b)=>a.id.localeCompare(b.id))}
 return {...reviewed,sourceDigest:await sha(canonical(reviewed))}
}
async function preview(s:State,a:Actor,p:Record<string,any>,now:string) {
 const site=text(p.site,'site',80,true);demandCoverageScope(s,a,site)
 const date=text(p.date,'date',10);need(/^\d{4}-\d{2}-\d{2}$/.test(date)&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date,'Choose a service date')
 const hour=integer(Number(p.hour),'hour',0,23),position=text(p.position,'position',80)
 const o=get(s,'openshifts',p.openShiftId)
 need(o.site===site,'Not found',404)
 const reviewed=await source(s,site,date,hour,position,now,o.id)
 need(o.status==='open'&&o.start>now,'Choose an open shift that has not started',409)
 need(o.approval==='manager','Demand coverage requires independent manager approval',409)
 need(o.week===reviewed.roster.week&&positionOf(s,o)===position&&o.start<reviewed.interval.end&&o.end>reviewed.interval.start,'Choose this cafe and position in the reviewed interval',409)
 need(reviewed.interval.uncoveredMinutes>0,'This interval has no forecast deficit',409)
 const openShift=openFacts(o),plannedMinutes=contribution(o,reviewed.interval.start,reviewed.interval.end)
 const plannedReductionMinutes=Math.min(reviewed.interval.uncoveredMinutes,plannedMinutes)
 return {site,date,hour,position,reviewed,openShift,plannedMinutes,plannedReductionMinutes,residualMinutes:round(reviewed.interval.uncoveredMinutes-plannedReductionMinutes),
  digest:await sha(canonical({reviewed,openShift}))}
}
export async function demandCoverageCommand(c:Context,name:string,p:Record<string,any>) {
 if(!['demand.coverage.link','demand.coverage.review'].includes(name))return undefined
 keys(p,['id','revision','site','date','hour','position','openShiftId','openShiftRevision','digest'])
 const v=await preview(c.s,c.a,p,c.now),o=get(c.s,'openshifts',v.openShift.id)
 need(Number(p.openShiftRevision)===o.revision&&p.digest===v.digest,'Coverage sources changed; review them again',409)
 const old=name==='demand.coverage.review'?get(c.s,'demandcoverage',p.id):undefined
 if(old){
  exact(old,p);need(old.site===v.site&&old.date===v.date&&old.hour===v.hour&&old.position===v.position&&old.openShift.id===o.id,'Review the existing case and linked shift',409)
 }else{
  need(!c.s.demandcoverage.some(x=>x.openShift.id===o.id),'This open shift is already linked to demand coverage',409)
  need(!c.s.demandcoverage.some(x=>x.site===v.site&&x.date===v.date&&x.hour===v.hour&&x.position===v.position),'This demand interval already has a coverage case',409)
 }
 const review={...v,by:c.a.id,at:c.now}
 return put(c,'demandcoverage',{...v,createdBy:old?.createdBy??c.a.id,createdAt:old?.createdAt??c.now,reviewedBy:c.a.id,reviewedAt:c.now,reviews:[...(old?.reviews??[]),review]},old)
}
/** The ordinary pickup approval retains its eligibility and self-approval checks.
 * A linked case adds only the reviewed-source fence before that decision. */
export async function demandCoverageApproval(c:Context,name:string,p:Record<string,any>) {
 if(name!=='openshift.approve')return
 const pickup=get(c.s,'pickups',p.id),record=c.s.demandcoverage.find(x=>x.openShift.id===pickup.openShiftId)
 if(!record)return
 const v=await preview(c.s,c.a,{...record,openShiftId:record.openShift.id},c.now)
 need(v.digest===record.digest,'Demand coverage sources changed; review the linked case before approving',409)
}
export async function demandCoverageCase(s:State,r:Row,now:string) {
 let fresh=false,reason=''
 try{const current=await source(s,r.site,r.date,r.hour,r.position,now,r.openShift.id);fresh=current.sourceDigest===r.reviewed.sourceDigest;if(!fresh)reason='Published coverage or saved forecast changed; fresh review required'}catch(e){reason=(e as Error).message}
 const o=s.openshifts.find(x=>x.id===r.openShift.id),assigned=o?.status==='filled'?s.shifts.find(x=>x.id===o.shiftId&&x.status==='published'&&x.staffId===o.filledBy):undefined
 if(o?.status==='open'&&o.revision!==r.openShift.revision){fresh=false;reason='Linked open shift changed; fresh review required'}
 const clock=assigned?receivedCoverageClock(s,assigned,now):null
 const assignedMinutes=assigned&&assigned.site===r.site&&positionOf(s,assigned)===r.position?contribution(assigned,r.reviewed.interval.start,r.reviewed.interval.end):0
 const approvedReductionMinutes=Math.min(r.reviewed.interval.uncoveredMinutes,assignedMinutes)
 const requests=s.pickups.filter(x=>x.openShiftId===r.openShift.id).map(x=>({...x}))
 return {...r,fresh,reason,status:!fresh?'review-required':clock?'arrived':assigned?'assigned':now>=r.openShift.end?'ended-unfilled':'awaiting-pickup',
  requests,assignment:assigned?{shiftId:assigned.id,revision:assigned.revision,staffId:assigned.staffId,approvedAt:o!.filledAt}:null,clock,
  approvedReductionMinutes,residualMinutes:round(r.reviewed.interval.uncoveredMinutes-approvedReductionMinutes),
  note:'Planned coverage is an estimate. Only a received clock-in records arrival; arrival establishes no service outcome.'}
}
export async function demandCoverageCases(s:State,a:Actor,now:string,site?:string,date?:string) {
 if(!['owner','manager'].includes(a.role)||restricted(s,a))return []
 const home=s.staff.find(p=>p.id===a.staffId)?.site??''
 return Promise.all(s.demandcoverage.filter(r=>(a.role==='owner'||r.site===home)&&(site===undefined||r.site===site)&&(!date||r.date===date)).map(r=>demandCoverageCase(s,r,now)))
}
export async function demandCoverageReport(s:State,a:Actor,site:string,date:string,now:string,p:Record<string,any>={}) {
 demandCoverageScope(s,a,site)
 const forecast=savedVersions(s,site,date)[0],roster=s.rosters.find(r=>r.week===weekOf(s,instantAt(date,'12:00',s.timezone))&&r.status==='published')
 const intervals=forecast?.status==='complete'&&roster?planningDemand(s,roster.week,site,s.shifts.filter(x=>x.status==='published'&&x.rosterId===roster.id),[date]).intervals.filter(x=>forecast.hours[x.hour]?.roles?.some((r:any)=>r.position===x.position)&&x.uncoveredMinutes>0):[]
 const cases=await demandCoverageCases(s,a,now,site,date)
 let review=null,error=''
 if(p.openShiftId)try{review=await preview(s,a,{site,date,...p},now)}catch(e){error=(e as Error).message}
 const hour=p.hour===undefined?undefined:Number(p.hour),position=typeof p.position==='string'?p.position:''
 const window=hour!==undefined&&Number.isInteger(hour)&&hour>=0&&hour<=23?bounds(s,date,hour):null
 const candidates=window?s.openshifts.filter(o=>o.site===site&&o.status==='open'&&o.approval==='manager'&&o.start>now&&positionOf(s,o)===position&&o.start<window.end&&o.end>window.start).map(openFacts):[]
 return {intervals,cases,review,error,candidates,hour,position}
}
