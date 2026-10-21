// LEARN-001: observed forecast error from retained manual forecasts and sales.
// This report never proposes or applies a policy, changes schedules or treats missing outcomes as zero.
import {type Actor,type State,type Row,need,integer} from './model'
import {localDate,instantAt} from './settings'
import {board} from './attendance'
import {salesSite} from './sales'

const datePlus=(date:string,n:number)=>new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10)
const reference=(r:Row)=>({id:r.id,revision:r.revision,savedAt:r.savedAt})
export function learningReport(s:State,a:Actor,week:string,site:string,weeks:number,asOf:string) {
 need(salesSite(s,a,site),'Not found',404)
 integer(weeks,'weeks',1,26)
 const chosen=new Date(week+'T12:00:00Z')
 need(/^\d{4}-\d{2}-\d{2}$/.test(week)&&Number.isFinite(chosen.getTime())&&chosen.toISOString().slice(0,10)===week&&chosen.getUTCDay()===1,'Choose a week by its Monday (YYYY-MM-DD)')
 const today=localDate(asOf,s.timezone),first=datePlus(week,-7*(weeks-1))
 const days=Array.from({length:weeks*7},(_,i)=>{
  const date=datePlus(first,i),offset=(new Date(date+'T12:00:00Z').getUTCDay()+6)%7,w=datePlus(date,-offset),start=instantAt(date,'00:00',s.timezone)
  const source=s.forecasts.find(r=>r.week===w&&r.site===site)
  const retained=source?[...(source.versions??[]),source].filter(r=>r.savedAt<start).sort((a,b)=>b.savedAt.localeCompare(a.savedAt)||b.revision-a.revision):[]
  const forecast=retained[0],sales=s.sales.filter(r=>r.site===site&&r.date===date&&r.metric==='sales')
  const daily=sales.find(r=>r.hour===null),hours=sales.filter(r=>r.hour!==null),completeHours=new Set(hours.map(r=>r.hour)).size===24
  const actual=daily?daily.value:completeHours?hours.reduce((n,r)=>n+r.value,0):null,expected=forecast?forecast.days[offset]*100:null
  const reasons:string[]=[]
  if(date>=today)reasons.push('service-day-not-complete')
  if(!forecast)reasons.push(source?'forecast-entered-after-service-start':'forecast-not-recorded')
  if(actual===null)reasons.push(hours.length?'incomplete-hourly-sales':'sales-not-recorded')
  const known=reasons.length===0,error=known?actual!-expected!:null
  const end=instantAt(date,'23:59',s.timezone)
  const attendance=date<today?board(s,{...a,role:'owner'},end,site).filter(x=>x.site===site):[]
  const published=s.rosters.some(r=>r.week===w&&r.publishedAt),attendanceUnknown=!published||!s.attendrules.some(r=>r.site===site)||date>=today||attendance.some(x=>['no-show','missing','due','present','on break'].includes(x.status))
  const noShows=attendance.filter(x=>x.status==='no-show').map(x=>({shiftId:x.shiftId,revision:x.revision,staffId:x.staffId,status:'unresolved-no-show',knownAbsent:false}))
  return {date,status:known?'observed':'unknown',reasons,forecastCents:expected,actualCents:actual,errorCents:error,absoluteErrorCents:error===null?null:Math.abs(error),forecastSource:forecast?{...reference(forecast),days:forecast.days}:null,salesSources:sales.map(r=>({...reference(r),hour:r.hour,value:r.value,source:r.source,versions:r.versions??[]})),attendance:{unresolvedNoShows:noShows,unknown:attendanceUnknown,schedulePublished:published},providerHistory:{status:'unknown',reason:'no-connected-POS-history'}}
 })
 const observed=days.filter(d=>d.status==='observed')
 return {site,week,weeks,from:first,to:datePlus(week,6),asOf,timezone:s.timezone,basis:'Manual SALES-001 entries and forecasts saved before service-day start',errorSign:'actual minus forecast',days,summary:{observedDays:observed.length,unknownDays:days.length-observed.length,meanAbsoluteErrorCents:observed.length?Math.round(observed.reduce((n,d)=>n+d.absoluteErrorCents!,0)/observed.length):null},policyChanges:'none; evaluated proposals, holdouts, approval and reversion are not implemented'}
}
