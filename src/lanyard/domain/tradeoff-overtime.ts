// TRADEOFF-001: scheduled whole-workweek estimates, never payable overtime.
import {type State,type Row} from './model'
import {workweek} from './payschedules'
import {dayAfter} from './aca'
import {priced,rateBasis} from './workforce'
import {siteOf} from './team'

export function scheduledOvertime(s:State,site:string,source:Row[],rows:Row[],targetRows:Row[]=rows) {
 const replaced=new Set(source.map(x=>x.id)),people=new Set(targetRows.map(x=>x.staffId))
 const published=[...s.shifts.filter(x=>x.status==='published'&&!replaced.has(x.id)),...rows]
 const pieces=(x:Row,trial=false)=>{
  const basis=trial?rateBasis(s,x.staffId,x):priced(s,x.staffId,x)
  return basis.segments.map((p:any)=>({shiftId:x.id,revision:x.revision,staffId:x.staffId,start:x.start,date:p.date,minutes:p.minutes,cents:p.cents,rateFrom:p.from,profileId:p.profileId,profileRevision:p.profileRevision,week:workweek(s,x.staffId,p.date)}))
 }
 const targets=new Map<string,{staffId:string;week:string}>()
 for(const x of targetRows)for(const p of pieces(x,true))targets.set(x.staffId+'|'+p.week,{staffId:x.staffId,week:p.week})
 const inputs=published.filter(x=>people.has(x.staffId)&&siteOf(s,x)===site).flatMap(x=>pieces(x,replaced.has(x.id)))
 const groups=[...targets.values()].sort((a,b)=>a.staffId.localeCompare(b.staffId)||a.week.localeCompare(b.week)).map(({staffId,week})=>{
  const end=dayAfter(week,6),own=inputs.filter((p:any)=>p.staffId===staffId&&p.week===week)
  // Shifts may last 48 elapsed hours. Include possible prior-week carry-in,
  // with a third lookback date for the spring DST boundary.
  const calendarWeeks=[...new Set(Array.from({length:10},(_,i)=>{const d=dayAfter(week,i-3);return dayAfter(d,-((new Date(d+'T00:00:00Z').getUTCDay()+6)%7))}))]
  const missingWeeks=calendarWeeks.filter(w=>!s.rosters.some(r=>r.week===w&&r.status==='published'))
  const outside=published.some(x=>x.staffId===staffId&&siteOf(s,x)!==site&&pieces(x).some((p:any)=>p.week===week))
  const reasons=[...(missingWeeks.length?['Some calendar weeks needed for this workweek or overnight carry-in are unpublished.']:[]),...(outside?['Cross-cafe scheduled work is present; this cafe comparison cannot price a complete workweek.']:[])]
  const knownMinutes=own.reduce((n:number,p:any)=>n+p.minutes,0),minutes=reasons.length?null:knownMinutes
  const overtimeMinutes=minutes===null?null:Math.max(0,minutes-2400)
  const missingRates=own.some((p:any)=>typeof p.cents!=='number')
  const premiumCents=overtimeMinutes===null?null:overtimeMinutes===0?0:missingRates?null:Math.round(own.reduce((n:number,p:any)=>n+p.minutes*p.cents,0)*overtimeMinutes/(minutes!*120))
  if(missingRates&&overtimeMinutes!==0)reasons.push('A scheduled base rate is missing; the half-rate premium estimate is unknown.')
  const group=s.paygroups.find(g=>g.staffIds.includes(staffId))
  return {staffId,week,end,payGroup:group?{id:group.id,revision:group.revision,workweekStart:group.workweekStart}:null,thresholdMinutes:2400,knownMinutes,minutes,overtimeMinutes,premiumCents,inputs:own,missingWeeks,reasons}
 })
 return {label:'Scheduled weekly estimate only; not payable or statutory overtime',groups,overtimeMinutes:groups.some(g=>g.overtimeMinutes===null)?null:groups.reduce((n,g)=>n+g.overtimeMinutes!,0),premiumCents:groups.some(g=>g.premiumCents===null)?null:groups.reduce((n,g)=>n+g.premiumCents!,0),definition:'Payable scheduled minutes are split by venue date using the retained rate basis and grouped by each employee’s configured workweek (Monday by default). Above 2,400 minutes, the premium estimate is half the scheduled-minute-weighted base hourly rate, rounded once per employee-workweek to USD cents. Unpublished adjacent weeks and cross-cafe work leave the total unknown. Actual punches, daily overtime, regular-rate inclusions, statutory policy and exceptions are not calculated.'}
}
