import {type State} from './model'
import {dayAfter} from './aca'
import {localDate,instantAt} from './settings'

/** Actual records and plans describe the same work, not additive hours. Use the
 * union at the larger paid fraction where they overlap. Pending corrections
 * cannot reduce retained approved hours until approved; superseded rows vanish.
 * Unlocated meal minutes are proportional, as in the existing date allocation. */
export function minorWork(s:State,staffId:string,candidate:any,plans:any[],skip:string[]=[]){
 const root=candidate.rootId??candidate.id
 const actual=s.timesheets.filter(t=>t.staffId===staffId&&['approved','submitted','returned'].includes(t.status)&&t.id!==candidate.id&&(!root||t.rootId!==root)).map(t=>{
  // Rounded payable time does not erase captured work. A reasoned manual edit
  // or correction is the current worked fact, while old revisions are retained.
  const source=t.edited||t.corrects?t:t.captured??t
  return {...source,minutes:source.minutes??(Date.parse(source.end)-Date.parse(source.start))/60000-Number(source.breakMinutes??0)}
 })
 const work=[...plans.filter(x=>x.staffId===staffId&&x.id!==candidate.id&&!skip.includes(x.id)),...actual,candidate].map(w=>({start:Date.parse(w.start),end:Date.parse(w.end),minutes:w.minutes??(Date.parse(w.end)-Date.parse(w.start))/60000-Number(w.breakMinutes??0)})).filter(w=>w.end>w.start)
 const boundaries=[...new Set(work.flatMap(w=>[w.start,w.end]))].sort((a,b)=>a-b),parts:{date:string;start:number;end:number;minutes:number}[]=[]
 for(let i=1;i<boundaries.length;i++){
  let start=boundaries[i-1],end=boundaries[i]
  const fraction=Math.max(0,...work.filter(w=>w.start<end&&w.end>start).map(w=>w.minutes/((w.end-w.start)/60000)))
  if(!fraction)continue
  while(start<end){const date=localDate(new Date(start).toISOString(),s.timezone),next=Math.min(end,Date.parse(instantAt(dayAfter(date),'00:00',s.timezone)));parts.push({date,start,end:next,minutes:(next-start)/60000*fraction});start=next}
 }
 return parts
}

/** The maximum work in a sliding elapsed 24 hours occurs at an interval edge
 * or 24 hours from one. Check both, including DST, rather than calendar dates. */
export function rollingWork(parts:{start:number;end:number;minutes:number}[],start:number,end:number){
 const edges=[...new Set(parts.flatMap(p=>[p.start,p.end,p.start-86400000,p.end-86400000]))]
 return Math.max(0,...edges.filter(at=>at<end&&at+86400000>start).map(at=>parts.reduce((n,p)=>n+Math.max(0,Math.min(p.end,at+86400000)-Math.max(p.start,at))/(p.end-p.start)*p.minutes,0)))
}
