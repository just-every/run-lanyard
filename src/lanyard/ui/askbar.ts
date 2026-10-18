// The bar under the schedule: find anyone or anything (⌘K), and the first draft a
// person still has to review. Drafts are where an agent's work waits for a human.
import {h,rows,manager} from './shared'
import {day,hours} from './format'

function latestDraft(s:any) {
 const items=[
  ...rows(s,'rosters').filter(r=>r.status==='draft').map(r=>({at:r.preparedAt,text:`Drafted: week of ${day(r.week)} · ${rows(s,'shifts').filter(x=>x.rosterId===r.id&&x.status==='draft').length} shifts, revision ${r.revision}`,href:`/app/schedule?week=${r.week}&view=draft`})),
  ...rows(s,'batches').filter(b=>b.status==='draft').map(b=>({at:b.preparedAt,text:`Drafted: payroll batch · ${(b.lines??[]).length} entries, ${hours((b.lines??[]).reduce((n:number,l:any)=>n+l.minutes,0))} hrs`,href:'/app/payroll'})),
 ]
 const submitted=rows(s,'timesheets').filter(t=>t.status==='submitted'&&t.staffId!==s.actor.staffId)
 if(submitted.length)items.push({at:submitted.map(t=>t.submittedAt).sort().at(-1),text:`Drafted: ${submitted.length} timesheet${submitted.length===1?'':'s'} to approve`,href:'/app/time#approve'})
 // A drafted week comes first, then a payroll batch, then time waiting for approval.
 return items[0]
}
export function askbar(s:any) {
 const draft=manager(s)?latestDraft(s):undefined
 return `<div class="askbar"><form class="ask" action="/app/people" method="get" role="search"><span class="spark" aria-hidden="true">✦</span><label><span class="sr-only">Find a person</span><input name="q" type="search" placeholder="Find in Lanyard…" autocomplete="off" data-find></label><kbd>⌘K</kbd></form>${draft?`<a class="drafted" href="${h(draft.href)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2.75h8.5l4.75 4.75v13.75H6zM14.5 2.75V7.5h4.75M9 12h7.5M9 16h7.5"/></svg><span>${h(draft.text)}</span><span class="chev right" aria-hidden="true"></span></a>`:''}</div>`
}
