import {type State,type Row} from './model'
import {instantAt} from './settings'
import {dayAfter} from './aca'

/** Consecutive work carries across midnight, cafes, jobs and workweeks. Only
 * recorded qualifying unpaid meals reduce it; they do not reset the run. */
export function consecutiveWork(s:State,parts:any[],rows:Row[],ruleFor:(site:string,date:string)=>any){
 const result=new Map<any,{minutes:number;unknown:boolean}>()
 let end=-Infinity,worked=0
 const intervals=parts.map(p=>({...p,part:p,begin:Math.max(Date.parse(p.start),Date.parse(instantAt(p.date,'00:00',s.timezone))),finish:Math.min(Date.parse(p.end),Date.parse(instantAt(dayAfter(p.date),'00:00',s.timezone)))})).sort((a,b)=>a.begin-b.begin||a.finish-b.finish)
 for(const p of intervals){
  if(p.begin>end)worked=0
  const row=rows.find(t=>t.id===p.timeId)!,rule=ruleFor(p.site,p.date)
  const meals=(row.breaks??[]).filter((b:any)=>b.kind==='meal'&&b.end&&Date.parse(b.end)-Date.parse(b.start)>=30*60000&&Date.parse(b.start)>=Date.parse(row.start)+60*60000&&Date.parse(b.end)<=Date.parse(row.end)-60*60000)
  const knownMealMinutes=meals.reduce((n:number,b:any)=>n+(Date.parse(b.end)-Date.parse(b.start))/60000,0)
  const unknownDeduction=Math.max(0,(row.breakMinutes??0)-knownMealMinutes)
  // Retained payable allocations already subtract recorded meals. Use them
  // once; subtracting again or maximizing each calendar slice double counts
  // a meal whose source allocation spans midnight.
  const elapsed=p.minutes+unknownDeduction*(p.finish-p.begin)/(Date.parse(row.end)-Date.parse(row.start)),limit=rule?.consecutiveMinutes
  const minutes=limit?Math.min(p.minutes,Math.max(0,worked+elapsed-limit)-Math.max(0,worked-limit)):0
  result.set(p.part,{minutes:Math.floor(minutes),unknown:!!limit&&(row.breakMinutes??0)>knownMealMinutes})
  worked+=elapsed;end=Math.max(end,p.finish)
 }
 return result
}
