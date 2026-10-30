import {localDay,localWeekday,html,t as tr} from '../localization'
// SCHEDULE-006 on the schedule: the week's shift changes (who, when, why, acknowledgments and notice
// state), each published revision with a compare link for managers, and the change log export.
import {h,rows,card,person} from './shared'
import {clock,dateKey,day,span} from './format'

const verb:Record<string,string>={created:'Published',moved:'Moved',reassigned:'Reassigned',republished:'Republished unchanged',canceled:'Canceled',swapped:'Swapped',covered:'Covered after call-out',acknowledged:'Acknowledged'}
export function historyCard(s:any,week:string,tz:string,canManage:boolean) {
 const list=rows(s,'shiftChanges').filter(e=>e.week===week&&e.action!=='republished');if(!list.length)return ''
 const lines=[...new Set(list.map(e=>e.lineage))]
 const items=lines.map(l=>{const mine=list.filter(e=>e.lineage===l),last=mine[mine.length-1]
  return html(s)`<li><strong>${last.start?h(`${localDay(s,dateKey(last.start,tz))} · ${span(last.start,last.end,tz)}`):tr(s,'Shift')}</strong>${last.site?` · ${h(last.site)}`:''}<ol class="history">${mine.map(e=>html(s)`<li>${h(tr(s,verb[e.action]??e.action))}${e.staffId&&e.action!=='acknowledged'?` · ${h(person(s,e.staffId))}`:''}${e.from?.staffId&&e.from.staffId!==e.staffId?html(s)` (from ${h(person(s,e.from.staffId))})`:''}${e.from?.start&&e.from.start!==e.start?html(s)` (was ${h(span(e.from.start,e.from.end,tz))})`:''} · ${h(e.by)} · ${h(localDay(s,dateKey(e.at,tz)))} ${h(clock(e.at,tz))}${e.reason?` · “${h(e.reason)}”`:''}${e.notice?html(s)` · notice ${h(tr(s,e.notice))}`:''}</li>`).join('')}</ol></li>`}).join('')
 const revisions=rows(s,'rosters').filter(r=>r.week===week&&r.publishedAt).sort((a,b)=>String(a.publishedAt).localeCompare(String(b.publishedAt)))
 const tools=canManage&&revisions.length?html(s)`<p class="note">${h(revisions.length)} published revision${revisions.length===1?'':'s'}.${revisions.length>1?html(s)` <a class="text-link" href="/api/lanyard/weeks/${h(week)}/compare?from=${h(revisions[0].id)}&amp;to=${h(revisions[revisions.length-1].id)}">Compare first and latest</a>`:''} <a class="text-link" href="/api/lanyard/weeks/${h(week)}/changes.csv">Export change log (CSV)</a></p>`:''
 return card(canManage?tr(s,'Schedule changes'):tr(s,'Changes to my shifts'),html(s)`${tools}<ul class="swap-list">${items}</ul>`,'','changes')
}
