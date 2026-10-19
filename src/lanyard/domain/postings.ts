// SCHEDULE-005: a posting records one printed copy of a published week (by cafe, position
// or person) with the exact rows printed, its revision and publication time. The copy is
// superseded once the week's current published schedule, read with the same filter, differs.
import {type Context,keys,text,need,manager,put} from './model'

type Person={id:string;name:string;site?:string|null;position?:string|null}
export type Filter={site:string;position:string;staffId:string}
export type PrintedRow={start:string;end:string;name:string;position:string;label:string}

/** A week's revision as staff know it: 1 for its first publication, 2 for the next, and so on. */
export function weekRevision(rosters:Record<string,any>[],roster:Record<string,any>) {
 return rosters.filter(r=>r.week===roster.week&&r.publishedAt&&r.publishedAt<=roster.publishedAt).length
}
/** The published rows of one roster revision a filter selects: never wages, notes or leave. */
export function rowsOf(people:Person[],shifts:Record<string,any>[],rosterId:string,f:Filter):PrintedRow[] {
 return shifts.filter(x=>x.rosterId===rosterId&&x.status==='published').flatMap(x=>{
  const p=people.find(v=>v.id===x.staffId),site=x.site||p?.site||''
  if(!p||(f.site&&site!==f.site)||(f.position&&(p.position??'')!==f.position)||(f.staffId&&p.id!==f.staffId))return []
  return [{start:x.start,end:x.end,name:p.name,position:p.position??'',label:x.label??''}]
 }).sort((a,b)=>a.start.localeCompare(b.start)||a.name.localeCompare(b.name))
}
/** Current, or superseded with when the newer revision was published (null when a shift changed in place). */
export function postingState(people:Person[],shifts:Record<string,any>[],rosters:Record<string,any>[],posting:Record<string,any>) {
 const current=rosters.find(r=>r.week===posting.week&&r.status==='published')
 const same=current&&JSON.stringify(rowsOf(people,shifts,current.id,posting.filter))===JSON.stringify(posting.rows)
 if(same)return {current:true,supersededAt:null as string|null}
 return {current:false,supersededAt:current&&current.id!==posting.rosterId?current.publishedAt as string:null}
}

export function postings(c:Context,name:string,p:Record<string,any>) {
 if(name!=='schedule.post')return undefined
 manager(c.a);keys(p,['week','site','position','staffId'])
 const week=text(p.week,'week',10),roster=c.s.rosters.find(r=>r.week===week&&r.status==='published');need(roster,'Publish this week before printing it',409)
 const filter:Filter={site:text(p.site,'site',80,true),position:text(p.position,'position',80,true),staffId:text(p.staffId,'staffId',80,true)}
 if(filter.staffId)need(c.s.staff.some(v=>v.id===filter.staffId),'Staff not found',404)
 const rows=rowsOf(c.s.staff,c.s.shifts,roster.id,filter);need(rows.length,'No published shifts match this print',409)
 return put(c,'postings',{week,rosterId:roster.id,rosterRevision:weekRevision(c.s.rosters,roster),publishedAt:roster.publishedAt,timezone:roster.timezone,filter,rows,postedBy:c.a.id,postedAt:c.now})
}
