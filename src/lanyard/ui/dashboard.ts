// DASH-001 screen: the manager's day at the top of Schedule — each count from its own records,
// linking to the card that resolves it.
import {h,card} from './shared'
import {money} from './format'

const row=(label:string,n:number,href:string,detail='')=>`<li><a class="text-link" href="${h(href)}">${h(label)}</a> <strong>${h(n)}</strong>${detail?` · ${detail}`:''}</li>`
export function dashboardCard(s:any) {
 const d=s.dashboard;if(!d)return ''
 const a=d.approvals,l=d.links,pending=a.time.length+a.leave.length+a.swaps.length+a.availability.length
 const approvals=[['time',a.time],['time off',a.leave],['swaps',a.swaps],['availability',a.availability]].map(([label,list]:any)=>list.length?`<a class="text-link" href="${h(list[0].link)}">${h(list.length)} ${h(label)}</a>`:`${h(0)} ${h(label)}`).join(' · ')
 const labor=d.labor.map((x:any)=>`<li><a class="text-link" href="${h(x.link)}">${h(x.site||'Your cafe')}</a>: ${h(money(x.scheduledCents))} scheduled${x.percent===null?' · no sales forecast':` · ${h(x.percent)}% of forecast sales${x.budgetPercent!==null?` (budget ${h(x.budgetPercent)}%${x.overBudget?', over':''})`:''}`}${x.actual?` · ${h(x.actual.percent)}% of entered sales (${h(x.actual.days)} day${x.actual.days===1?'':'s'})`:''}</li>`).join('')
 const cutoff=d.cutoff?row('Payroll cutoff (days left)',d.cutoff.daysLeft,d.cutoff.link,`pay period ends ${h(d.cutoff.end)}`):'<li>Payroll cutoff: no open pay period</li>'
 return card('Today',`<ul class="swap-list">${row('On now',d.now.length,l.now)}${row('Late or no-show',d.late.length,l.late)}${row('Open shifts this week',d.openShifts.length,l.openShifts)}${row('Unconfirmed shifts this week',d.unconfirmed.length,l.unconfirmed)}${row('Pending approvals',pending,l.time,approvals)}${row('Overtime risk',d.overtime.length,l.overtime)}${row('Unresolved exceptions',d.exceptions.length,l.exceptions)}${cutoff}</ul>${labor?`<ul class="note">${labor}</ul>`:''}`,'','dashboard')
}
