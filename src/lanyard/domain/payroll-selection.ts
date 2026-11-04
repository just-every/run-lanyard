import type {State} from './model'
import {heldByPeriod} from './periods'

/** Worked-time sources shared by native preparation and the agent's reviewed facts. */
export function payrollTimesheets(s:State,ids?:readonly string[]) {
 const requested=ids&&new Set(ids.map(id=>id.trim()))
 const unclaimed=s.timesheets.filter(t=>t.status==='approved'&&!s.claims.some(cl=>cl.time_id===t.id&&cl.time_revision===t.revision))
 const available=unclaimed.filter(t=>!heldByPeriod(s,t))
 const selected=requested?available.filter(t=>requested.has(t.id)):available
 return {unclaimed,selected:selected.sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id))}
}
