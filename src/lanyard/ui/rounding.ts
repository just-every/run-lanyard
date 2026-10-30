import {html,t as tr} from '../localization'
// TIME-005 screens: the owner's punch rounding rules per cafe (on People), the paid time beside
// each captured timesheet, and the week's per-employee rounding report (on Time).
import {h,rows,form,field,card,disclosure,empty,person} from './shared'
import {sitesOf} from './week'
import {span} from './format'
import {neutrality} from '../domain/rounding'

const ruleText=(r:any)=>`${r.method==='nearest'?`Nearest ${r.increment===6?'tenth of an hour':r.increment===15?'quarter hour':`${r.increment} minutes`}`:`Snap to schedule within ${r.window} min`} · ${r.apply==='capture'?'at clock-out':'at approval'}`

function fields(s:any) {
 return `<div class="fields"><label>Cafe<select name="site">${(sitesOf(s).length?sitesOf(s):['']).map(v=>`<option value="${h(v)}">${h(v||'Your cafe')}</option>`).join('')}</select></label>${field('from','Effective from (venue date)','','date','required')}<label>Method<select name="method"><option value="nearest">Nearest increment</option><option value="snap">Snap to schedule</option></select></label><label>Increment<select name="increment"><option value="5">5 minutes</option><option value="6">Tenth of an hour</option><option value="15">Quarter hour</option></select></label>${field('window','Snap window (minutes)',7,'number','min="1" max="30"')}<label>Applied<select name="apply"><option value="capture">At clock-out</option><option value="approval">At approval</option></select></label></div>`
}
export function roundRulesCard(s:any) {
 const list=[...rows(s,'roundrules')].sort((a,b)=>a.site.localeCompare(b.site)||a.from.localeCompare(b.from))
 const table=list.length?`<table class="list stack"><thead><tr><th>Cafe</th><th>From</th><th>Rule</th></tr></thead><tbody>${list.map(r=>`<tr><td data-label="Cafe">${h(r.site||'Your cafe')}</td><td data-label="From">${h(r.from)}</td><td data-label="Rule">${h(ruleText(r))}</td></tr>`).join('')}</tbody></table>`:empty('No punch rounding: phone clock time is paid exactly as captured.')
 return card('Punch rounding',`<p class="note">Rounding rounds both up and down; snap-to-schedule never removes early-arrival minutes. Captured times are always kept beside the paid time, manual entries are never rounded, and a new rule never changes approved time.</p>${table}${disclosure('Add a rule',form('roundrule.save','people',fields(s),'Save rule','','secondary'))}`,'','round-rules')
}
/** The paid span under a captured one, with the minutes rounding added or removed. */
export function paidNote(s:any,r:any,tz:string) {
 if(!r.rounding)return ''
 if(!r.payable)return html(s)`<small>Rounded at approval</small>`
 const d=r.minutes-r.rounding.capturedMinutes
 return html(s)`<small>Paid ${h(span(r.payable.start,r.payable.end,tz))} (${d>0?'+':d<0?'−':'±'}${Math.abs(d)} min)</small>`
}
export function neutralityCard(s:any,week:any[]) {
 const net=[...neutrality(week)]
 if(!net.length)return ''
 return card('Rounding this week',`<p class="note">Net minutes rounding added (+) or removed (−) per employee.</p><table class="list"><tbody>${net.map(([id,m])=>`<tr><th scope="row">${h(person(s,id))}</th><td class="num">${m>0?'+':m<0?'−':'±'}${Math.abs(m)} min</td></tr>`).join('')}</tbody></table>`,'','rounding-report')
}
