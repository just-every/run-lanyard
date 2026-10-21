// TRADEOFF-001: scheduled overtime exposure, not statutory payroll calculation.
import {type State,type Row} from './model'
import {dayAfter} from './aca'
import {workweek} from './payschedules'
import {priced,rateBasis} from './workforce'

const rosterWeek=(day:string)=>dayAfter(day,-((new Date(day+'T00:00:00Z').getUTCDay()+6)%7))
const sumKnown=(values:(number|null)[])=>values.some(v=>v===null)?null:values.reduce<number>((n,v)=>n+v!,0)

/** Replace only the compared slots. All other published work, including adjacent
 * roster weeks and other cafes, still contributes to each affected workweek. */
export function scheduledOvertime(s:State,source:Row[],rows:Row[],staffIds:string[]) {
 const replaced=new Set(source.map(x=>x.id)),candidates=new Set(rows.map(x=>x.id))
 const schedule=[...s.shifts.filter(x=>x.status==='published'&&!replaced.has(x.id)),...rows]
 const groups=staffIds.flatMap(staffId=>{
  const dates=source.flatMap(x=>rateBasis(s,staffId,x).segments.map(p=>p.date))
  const weeks=[...new Set(dates.map(day=>workweek(s,staffId,day)))].sort()
  return weeks.map(week=>{
   const end=dayAfter(week,6),requiredWeeks=[...new Set([rosterWeek(dayAfter(week,-2)),...Array.from({length:7},(_,i)=>rosterWeek(dayAfter(week,i)))])]
   const rosters=requiredWeeks.map(on=>{
    const r=s.rosters.find(x=>x.week===on&&x.status==='published')
    return {week:on,id:r?.id??null,revision:r?.revision??null}
   })
   const missingWeeks=rosters.filter(r=>r.id===null).map(r=>r.week)
   const group=s.paygroups.find(g=>g.staffIds.includes(staffId))
   const inputs=schedule.filter(x=>x.staffId===staffId).flatMap(x=>{
    const basis=candidates.has(x.id)?rateBasis(s,staffId,x):priced(s,staffId,x)
    const roster=s.rosters.find(r=>r.id===x.rosterId)
    return basis.segments.filter((p:any)=>p.date>=week&&p.date<=end).map((p:any)=>({
     shiftId:x.id,revision:x.revision,rosterId:x.rosterId,rosterRevision:roster?.revision??null,
     assignment:candidates.has(x.id)?'candidate':'published',site:x.site??'',job:x.job??'',
     start:x.start,end:x.end,breakMinutes:x.breakMinutes,date:p.date,minutes:p.minutes,
     cents:p.cents,rateFrom:p.from,profileId:p.profileId,profileRevision:p.profileRevision,jobRevision:basis.jobRevision
    }))
   }).sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start)||a.shiftId.localeCompare(b.shiftId))
   let minutes=0
   const classified=inputs.map(x=>{
    const before=minutes;minutes+=x.minutes
    const overtimeMinutes=Math.max(0,minutes-2400)-Math.max(0,before-2400)
    return {...x,overtimeMinutes,premiumCents:overtimeMinutes===0?0:x.cents===null?null:Math.round(overtimeMinutes*x.cents/120)}
   })
   const observedOvertimeMinutes=Math.max(0,minutes-2400),observedPremiumCents=sumKnown(classified.map(x=>x.premiumCents))
   const reasons=[...(missingWeeks.length?['A required roster week is unpublished; scheduled workweek totals are incomplete']:[]),...(observedPremiumCents===null?['An overtime segment has no usable hourly rate; the premium estimate is unknown']:[])]
   return {staffId,week,end,workweekStart:group?.workweekStart??1,paygroup:group?{id:group.id,revision:group.revision}:null,
    rosters,missingWeeks,scheduledMinutes:minutes,observedOvertimeMinutes,
    overtimeMinutes:missingWeeks.length?null:observedOvertimeMinutes,premiumCents:missingWeeks.length?null:observedPremiumCents,
    inputs:classified,reasons}
  })
 })
 return {label:'Scheduled workweek exposure and half-rate premium estimate; not statutory payroll cost',
  definition:'Published payable minutes across all cafes, including preceding-roster overnight work, split by retained venue-date rate segments into each employee’s configured workweek (Monday by default). Minutes above 2400 receive an additional half of that segment’s hourly rate, rounded per segment to USD cents. Compared assignments use current effective rates; unchanged work retains its published rate basis. Unpublished roster weeks leave totals unknown. Actual hours, regular-rate blending, daily overtime, jurisdiction rules, burden and other premiums are excluded.',
  overtimeMinutes:sumKnown(groups.map(g=>g.overtimeMinutes)),premiumCents:sumKnown(groups.map(g=>g.premiumCents)),groups}
}
