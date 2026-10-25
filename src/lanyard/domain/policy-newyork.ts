import {type Row} from './model'
import {dayAfter} from './aca'
import {wall,instantAt} from './settings'

/** Labor Law 162 uses local meal windows, including the calendar date after
 * an overnight start. Coverage is an employer-reviewed establishment input. */
export function newYorkMeals(row:Row,tz:string,factory:boolean){
 const start=wall(row.start,tz),finish=wall(row.end,tz),span=(Date.parse(row.end)-Date.parse(row.start))/60000
 const offset=(date:string,time:string)=>(Date.parse(instantAt(date,time,tz))-Date.parse(row.start))/60000
 const required:{length:number;earliest:number;latest:number}[]=[]
 for(let date=start.date;date<=finish.date;date=dayAfter(date)){
  const from=offset(date,'11:00'),through=offset(date,'14:00'),length=factory?60:30
  if(from>=0&&through<=span&&(factory||span>360))required.push({length,earliest:from,latest:through-length})
  const evening=offset(date,'19:00')
  if(from>0&&evening<span)required.push({length:20,earliest:offset(date,'17:00'),latest:evening-20})
 }
 const minute=Number(start.time.slice(0,2))*60+Number(start.time.slice(3))
 if(span>360&&(minute>=780||minute<360)){
  const length=factory?60:45
  required.push({length,earliest:span/2-length,latest:span/2})
 }
 return required.sort((a,b)=>a.earliest-b.earliest)
}
