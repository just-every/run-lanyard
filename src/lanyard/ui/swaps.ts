// COVER-001 screens on the schedule: the employee's swap form under each upcoming shift, the
// coworker's consent card, the proposer's open swaps, and the manager's approval list with any
// overtime the swap would cause shown before deciding.
import {h,rows,form,hidden,exact,field,card,manager,person,status} from './shared'
import {dateKey,day,hours,span} from './format'

const when=(x:any,tz:string)=>`${day(dateKey(x.start,tz))} · ${span(x.start,x.end,tz)}`
function what(w:any,tz:string) {
 return w.take?`${h(w.fromName)}’s ${h(when(w.give,tz))} for ${h(w.toName)}’s ${h(when(w.take,tz))}`:`${h(w.fromName)}’s ${h(when(w.give,tz))} to ${h(w.toName)}`
}
const overtime=(s:any,w:any)=>(w.overtime??[]).map((o:any)=>`<p class="note">Overtime: ${h(o.staffId===w.fromId?w.fromName:o.staffId===w.toId?w.toName:person(s,o.staffId))} would reach ${h(hours(o.after))} hrs that week.</p>`).join('')
const answer=(w:any,back:string)=>`<form class="offer-actions" method="post" action="/app/action?name=swap.respond&amp;returnTo=${encodeURIComponent(back)}">${exact(w)}${field('note','Message (optional)','','text','maxlength="280"')}<button type="submit" name="decision" value="accepted" class="primary">Agree</button><button type="submit" name="decision" value="declined" class="secondary">Decline</button></form>`
const decide=(w:any,back:string)=>`<form class="offer-actions" method="post" action="/app/action?name=swap.decide&amp;returnTo=${encodeURIComponent(back)}">${exact(w)}${field('note','Note (optional)','','text','maxlength="280"')}<button type="submit" name="decision" value="approved" class="primary">Approve swap</button><button type="submit" name="decision" value="refused" class="secondary">Refuse</button></form>`

/** Swaps waiting on the signed-in person, their own open swaps and the swap form for each upcoming shift; managers also see swaps to decide. */
export function swapCards(s:any,tz:string,back:string) {
 const me=s.actor.staffId,list=rows(s,'swaps'),parts:string[]=[]
 for(const w of list.filter(w=>w.toId===me&&w.status==='proposed'))parts.push(`<section class="offer"><div><p class="eyebrow">Swap request</p><h2>${what(w,tz)}</h2>${w.note?`<p><q>${h(w.note)}</q></p>`:''}<p>Nothing changes until you agree and a manager approves.</p></div>${answer(w,back)}</section>`)
 if(manager(s))for(const w of list.filter(w=>w.status==='accepted'&&w.fromId!==me&&w.toId!==me))parts.push(`<section class="offer"><div><p class="eyebrow">Swap to approve</p><h2>${what(w,tz)}</h2>${overtime(s,w)}<p>Both agreed. Approving moves the shifts and closes other swaps on them.</p></div>${decide(w,back)}</section>`)
 const mine=list.filter(w=>(w.fromId===me||w.toId===me)&&w.status!=='proposed'||w.fromId===me).filter(w=>w.status!=='closed'||w.fromId===me).slice(-8)
 const items=mine.map(w=>`<li>${what(w,tz)} · ${status(w.status==='proposed'?'waiting':w.status==='accepted'?'waiting for a manager':w.status,w.status)}${w.fromId===me&&['proposed','accepted'].includes(w.status)?form('swap.withdraw',back,exact(w),'Withdraw','','secondary'):''}</li>`).join('')
 const offers=rows(s,'swapOptions').filter(o=>o.give.length||o.exchange.length).map(o=>form('swap.propose',back,`${hidden('shiftId',o.shiftId)}${hidden('revision',o.revision)}<p><strong>${h(when(o,tz))}</strong></p><label>Give it to<select name="to"><option value="">Choose a coworker</option>${o.give.map((g:any)=>`<option value="${h(g.staffId)}">${h(g.name)}</option>`).join('')}</select></label><label>Or exchange it for<select name="theirShiftId"><option value="">No exchange</option>${o.exchange.map((x:any)=>`<option value="${h(x.shiftId)}">${h(x.name)} · ${h(when(x,tz))}</option>`).join('')}</select></label>${field('note','Message (optional)','','text','maxlength="280"')}`,'Propose swap','class="swap-form"','secondary')).join('')
 if(items||offers)parts.push(card('Shift swaps',`${items?`<ul class="swap-list">${items}</ul>`:''}${offers?`<details><summary>Swap one of your shifts</summary><div class="detail-content">${offers}</div></details>`:''}`,'','swaps'))
 return parts.join('')
}
