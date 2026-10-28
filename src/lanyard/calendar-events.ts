import {type Context,type State} from './domain/model'
import {lineageOf} from './domain/history'
import {siteOf} from './domain/team'

type Assignment={staffId:string;lineage:string;start:string;end:string;site:string;timezone:string;status:string}
function published(s:State) {
 return new Map(s.shifts.filter(x=>x.status==='published').map(x=>{
  const roster=s.rosters.find(r=>r.id===x.rosterId)
  const value:Assignment={staffId:x.staffId,lineage:lineageOf(x),start:x.start,end:x.end,site:siteOf(s,x),timezone:roster?.timezone??s.timezone,status:'CONFIRMED'}
  return [value.staffId+':'+value.lineage,value]
 }))
}
/** Persist only public assignment facts, atomically with the source decision. A departing
 * employee's cancellation retains their last facts, never the replacement's assignment. */
export function calendarStatements(c:Context,before:State) {
 const prior=published(before),current=published(c.s),statements:D1PreparedStatement[]=[]
 for(const key of new Set([...prior.keys(),...current.keys()])) {
  const old=prior.get(key),next=current.get(key),value=next??{...old!,status:'CANCELLED'}
  if(old&&next&&JSON.stringify(old)===JSON.stringify(next))continue
  statements.push(c.db.prepare(`INSERT INTO l_calendar_events(staff_id,lineage,sequence,data,updated_at) VALUES(?,?,0,?,?)
   ON CONFLICT(staff_id,lineage) DO UPDATE SET sequence=l_calendar_events.sequence+1,data=excluded.data,updated_at=excluded.updated_at
   WHERE l_calendar_events.data<>excluded.data`).bind(value.staffId,value.lineage,JSON.stringify(value),c.now))
 }
 return statements
}
