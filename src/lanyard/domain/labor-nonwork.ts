// Paid non-work inputs preserve their existing owner-only payroll authority.
import {type Actor,type State,type Row} from './model'
import {dayAfter} from './aca'
import {localDate} from './settings'

export function nonWorkCosts(s:State,reader:Actor|undefined,week:string,site:string,asOf:string,burden:{percent:number;perHourCents:number}) {
 if(reader?.role!=='owner')return null
 const on=localDate(asOf,s.timezone)
 const inputs:Row[]=[
  ...s.payinputs.filter(r=>r.kind==='PTO').map(r=>({...r,sourceKind:'employer PTO',costCents:r.amountCents})),
  ...s.sickuses.filter(r=>r.status==='approved').map(r=>({...r,sourceKind:'paid leave'})),
  ...s.holidaypay.map(r=>({...r,sourceKind:'non-work holiday'})),
 ]
 const sources=inputs.filter(r=>r.site===site&&r.date>=week&&r.date<=dayAfter(week,6)&&r.date<=on).map(r=>({id:r.id,revision:r.revision,sourceKind:r.sourceKind,staffId:r.staffId,site:r.site,date:r.date,minutes:Number(r.minutes),costCents:typeof r.costCents==='number'?r.costCents:null,reference:r.reference??null}))
 const references=sources.map(r=>r.reference).filter(Boolean),duplicateReference=new Set(references).size!==references.length
 const minutes=sources.reduce((n,r)=>n+r.minutes,0),earningsCents=duplicateReference||sources.some(r=>r.costCents===null)?null:sources.reduce((n,r)=>n+r.costCents!,0)
 const burdenCents=earningsCents===null?null:Math.round(earningsCents*burden.percent/100+minutes*burden.perHourCents/60)
 return {minutes,earningsCents,burdenCents,totalCents:earningsCents===null?null:earningsCents+burdenCents!,duplicateReference,sources,label:'Approved paid non-work inputs, separate from worked hours; duplicate source references require reconciliation.'}
}
