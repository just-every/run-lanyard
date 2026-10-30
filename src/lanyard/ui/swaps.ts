import {localDay,localWeekday,html,t as tr} from '../localization'
// COVER-001 screens on the schedule: the employee's swap form under each upcoming shift, the
// coworker's consent card, the proposer's open swaps, and the manager's approval list with any
// overtime the swap would cause shown before deciding.
import {h,rows,form,hidden,exact,field,card,manager,person,staffStatus} from './shared'
import {dateKey,day,hours,span} from './format'
import {costNote} from './overtime'

const when=(s:any,x:any,tz:string)=>`${localDay(s,dateKey(x.start,tz))} · ${span(x.start,x.end,tz)}`
function what(s:any,w:any,tz:string) {
 return w.take?html(s)`${h(w.fromName)}’s ${h(when(s,w.give,tz))} for ${h(w.toName)}’s ${h(when(s,w.take,tz))}`:html(s)`${h(w.fromName)}’s ${h(when(s,w.give,tz))} to ${h(w.toName)}`
}
const overtime=(s:any,w:any)=>(w.overtime??[]).map((o:any)=>html(s)`<p class="note">Overtime: ${h(o.staffId===w.fromId?w.fromName:o.staffId===w.toId?w.toName:person(s,o.staffId))} would reach ${h(hours(o.after))} hrs that week.</p>`).join('')
const answer=(s:any,w:any,back:string)=>html(s)`<form class="offer-actions" method="post" action="/app/action?name=swap.respond&amp;returnTo=${encodeURIComponent(back)}">${exact(w)}${field('note',tr(s,'Message (optional)'),'','text','maxlength="280"')}<button type="submit" name="decision" value="accepted" class="primary">Agree</button><button type="submit" name="decision" value="declined" class="secondary">Decline</button></form>`
const decide=(s:any,w:any,back:string)=>html(s)`<form class="offer-actions" method="post" action="/app/action?name=swap.decide&amp;returnTo=${encodeURIComponent(back)}">${exact(w)}${field('note',tr(s,'Note (optional)'),'','text','maxlength="280"')}<button type="submit" name="decision" value="approved" class="primary">Approve swap</button><button type="submit" name="decision" value="refused" class="secondary">Refuse</button></form>`

/** Swaps waiting on the signed-in person, their own open swaps and the swap form for each upcoming shift; managers also see swaps to decide. */
export function swapCards(s:any,tz:string,back:string) {
 const me=s.actor.staffId,list=rows(s,'swaps'),parts:string[]=[]
 for(const w of list.filter(w=>w.toId===me&&w.status==='proposed'))parts.push(html(s)`<section class="offer"><div><p class="eyebrow">Swap request</p><h2>${what(s,w,tz)}</h2>${w.note?html(s)`<p><q>${h(w.note)}</q></p>`:''}<p>Nothing changes until you agree and a manager approves.</p></div>${answer(s,w,back)}</section>`)
 if(manager(s))for(const w of list.filter(w=>w.status==='accepted'&&w.fromId!==me&&w.toId!==me))parts.push(html(s)`<section class="offer"><div><p class="eyebrow">Swap to approve</p><h2>${what(s,w,tz)}</h2>${overtime(s,w)}${costNote(s,w.cost)}<p>Both agreed. Approving moves the shifts and closes other swaps on them.</p></div>${decide(s,w,back)}</section>`)
 const mine=list.filter(w=>(w.fromId===me||w.toId===me)&&w.status!=='proposed'||w.fromId===me).filter(w=>w.status!=='closed'||w.fromId===me).slice(-8)
 const items=mine.map(w=>html(s)`<li>${what(s,w,tz)} · ${staffStatus(s,w.status==='proposed'?'waiting':w.status==='accepted'?tr(s,'waiting for a manager'):w.status,w.status)}${w.fromId===me&&['proposed','accepted'].includes(w.status)?form('swap.withdraw',back,exact(w),tr(s,'Withdraw'),'','secondary'):''}</li>`).join('')
 const offers=rows(s,'swapOptions').filter(o=>o.give.length||o.exchange.length).map(o=>form('swap.propose',back,html(s)`${hidden('shiftId',o.shiftId)}${hidden('revision',o.revision)}<p><strong>${h(when(s,o,tz))}</strong></p><label>Give it to<select name="to"><option value="">Choose a coworker</option>${o.give.map((g:any)=>html(s)`<option value="${h(g.staffId)}">${h(g.name)}</option>`).join('')}</select></label><label>Or exchange it for<select name="theirShiftId"><option value="">No exchange</option>${o.exchange.map((x:any)=>html(s)`<option value="${h(x.shiftId)}">${h(x.name)} · ${h(when(s,x,tz))}</option>`).join('')}</select></label>${field('note',tr(s,'Message (optional)'),'','text','maxlength="280"')}`,tr(s,'Propose swap'),'class="swap-form"','secondary')).join('')
 if(items||offers)parts.push(card(tr(s,'Shift swaps'),html(s)`${items?html(s)`<ul class="swap-list">${items}</ul>`:''}${offers?html(s)`<details><summary>Swap one of your shifts</summary><div class="detail-content">${offers}</div></details>`:''}`,'','swaps'))
 return parts.join('')
}
