import {type State,need,text} from './model'
import {heldByPeriod} from './periods'

/** Worked-time sources shared by native preparation and the agent's reviewed facts. */
export function payrollTimesheets(s:State,requested?:unknown) {
 need(requested===undefined||(Array.isArray(requested)&&requested.length>0&&requested.length<=500),'Provide 1–500 timesheet IDs')
 const ids=(requested as unknown[]|undefined)?.map(v=>text(v,'time ID'))
 if(ids)need(new Set(ids).size===ids.length,'Duplicate timesheet IDs')
 const unclaimed=s.timesheets.filter(t=>t.status==='approved'&&!s.claims.some(cl=>cl.time_id===t.id&&cl.time_revision===t.revision))
 const available=unclaimed.filter(t=>!heldByPeriod(s,t))
 const selected=ids?ids.map(id=>{const t=available.find(r=>r.id===id);need(t,unclaimed.some(r=>r.id===id)?'Selected time is in an open pay period; lock the period first':'Selected time is not approved or is already exported',409);return t}):available
 return {unclaimed,selected:selected.sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id))}
}
