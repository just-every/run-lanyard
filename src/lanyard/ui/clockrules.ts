// TIME-006 on People (owner only): each cafe's clock-in rule, optionally per position:
// how early staff may clock in before a scheduled shift, and clock-ins without a shift.
import {h,rows,form,field,hidden,card,disclosure,empty} from './shared'
import {sitesOf} from './week'

const EARLY:[string,string][]=[['any','Any time before the shift'],['refuse','Refuse before the window'],['flag','Accept and flag for approval']]
const UNSCHEDULED:[string,string][]=[['allow','Allow'],['pending','Accept pending approval (flagged)'],['refuse','Refuse']]
const choose=(name:string,title:string,options:[string,string][],value:string)=>`<label>${h(title)}<select name="${h(name)}">${options.map(([v,l])=>`<option value="${h(v)}" ${v===value?'selected':''}>${h(l)}</option>`).join('')}</select></label>`
const textOf=(options:[string,string][],v:string)=>options.find(([k])=>k===v)?.[1]??v

function fields(s:any,r:any={}) {
 const where=r.revision?hidden('site',r.site)+hidden('position',r.position)+hidden('revision',r.revision):`<label>Cafe<select name="site">${(sitesOf(s).length?sitesOf(s):['']).map(v=>`<option value="${h(v)}">${h(v||'Your cafe')}</option>`).join('')}</select></label>${field('position','Position (blank for the whole cafe)','','text','maxlength="80" list="positions"')}`
 return `<div class="fields">${where}${choose('early','Early clock-in',EARLY,r.early??'refuse')}${field('earlyMinutes','Window (minutes before the shift)',r.earlyMinutes??10,'number','min="0" max="720"')}${choose('unscheduled','Clock-in without a shift',UNSCHEDULED,r.unscheduled??'pending')}</div>`
}
export function clockRulesCard(s:any) {
 const list=rows(s,'clockrules')
 const table=list.length?`<table class="list stack"><thead><tr><th>Cafe</th><th>Position</th><th>Early clock-in</th><th>Without a shift</th><th><span class="sr-only">Edit</span></th></tr></thead><tbody>${list.map(r=>`<tr><td data-label="Cafe">${h(r.site||'Your cafe')}</td><td data-label="Position">${h(r.position||'Everyone')}</td><td data-label="Early clock-in">${h(r.early==='any'?textOf(EARLY,'any'):`${textOf(EARLY,r.early)} · ${r.earlyMinutes} min`)}</td><td data-label="Without a shift">${h(textOf(UNSCHEDULED,r.unscheduled))}</td><td>${disclosure('Edit',form('clockrule.save','people',fields(s,r),'Save rule','','secondary'),false,'inline-menu')}</td></tr>`).join('')}</tbody></table>`:empty('No clock-in rules: staff can clock in at any time, with or without a shift.')
 return card('Clock-in rules',`<p class="note">Clock-ins are compared with the published schedule at their captured time. A position’s rule replaces its cafe’s rule. Flagged time waits for a manager and is skipped by bulk approval.</p>${table}${disclosure('Add a rule',form('clockrule.save','people',fields(s),'Save rule','','secondary'))}`,'','clock-rules')
}
