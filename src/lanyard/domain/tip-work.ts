import {type State,type Row} from './model'
import {priced} from './workforce'

/** A timesheet's payable minutes by venue date, job and cafe at their retained rates (PEOPLE-002, SCHEDULE-004, CLOCK-008). */
export function tipPieces(s:State,t:Row):{date:string;minutes:number;cents:number|null;job:string;site:string}[] {
 if(t.workSegments?.length)return t.workSegments.flatMap((w:any)=>w.rateBasis.segments.map((x:any)=>({date:x.date,minutes:x.minutes,cents:x.cents,job:w.job??'',site:w.site??''})))
 const site=t.site||s.staff.find(p=>p.id===t.staffId)?.site||''
 return priced(s,t.staffId,t).segments.map((x:any)=>({date:x.date,minutes:x.minutes,cents:x.cents,job:t.job??'',site}))
}
