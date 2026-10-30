import {html,t as tr} from '../localization'
// BREAK-002 screens: the owner's meal deduction per cafe (on People), the question the
// phone clock asks at clock-out, and what each timesheet recorded about the deduction.
import {h,rows,form,field,hidden,card,disclosure,empty,staffOf} from './shared'
import {sitesOf} from './week'

function fields(s:any,r:any={}) {
 const where=r.revision?hidden('site',r.site)+hidden('revision',r.revision):`<label>Cafe<select name="site">${(sitesOf(s).length?sitesOf(s):['']).map(v=>`<option value="${h(v)}">${h(v||'Your cafe')}</option>`).join('')}</select></label>`
 return `<div class="fields">${where}${field('afterMinutes','On shifts longer than (minutes)',r.afterMinutes??360,'number','required min="60" max="1440"')}${field('deductMinutes','Deduct (minutes)',r.deductMinutes??30,'number','required min="1" max="120"')}</div><label class="check"><input type="checkbox" name="enabled" value="true" ${r.enabled===false?'':'checked'}> Deduct automatically when no meal is recorded</label>`
}
export function mealRulesCard(s:any) {
 const list=rows(s,'mealrules')
 const table=list.length?`<table class="list stack"><thead><tr><th>Cafe</th><th>Deduction</th><th>Status</th><th><span class="sr-only">Edit</span></th></tr></thead><tbody>${list.map(r=>`<tr><td data-label="Cafe">${h(r.site||'Your cafe')}</td><td data-label="Deduction">${h(r.deductMinutes)} min on shifts over ${h((r.afterMinutes/60).toFixed(1))} hours</td><td data-label="Status">${r.enabled?'On':'Off'}</td><td>${disclosure('Edit',form('mealrule.save','people',fields(s,r),'Save deduction','','secondary'),false,'inline-menu')}</td></tr>`).join('')}</tbody></table>`:empty('No automatic meal deductions: staff record their own meal minutes.')
 return card('Meal deductions',`<p class="note">When nobody records a meal on a long shift, Lanyard deducts it and asks the employee at clock-out whether they took it. A missed or interrupted meal is paid in full and flagged for approval; an unanswered deduction is flagged too.</p>${table}${disclosure('Add a deduction',form('mealrule.save','people',fields(s),'Save deduction','','secondary'))}`,'','meal-rules')
}
/** The clock-out question, when the person's cafe deducts meals. */
export function mealQuestion(s:any,open:any) {
 const shift=open.shiftId?rows(s,'shifts').find(x=>x.id===open.shiftId):undefined,site=shift?.site||staffOf(s,s.actor.staffId)?.site||''
 const rule=rows(s,'mealrules').find(r=>r.site===site&&r.enabled);if(!rule)return ''
 return html(s)`<p class="note">If you record no meal minutes on a shift over ${h((rule.afterMinutes/60).toFixed(1))} hours, ${h(rule.deductMinutes)} minutes are deducted as an unpaid meal.</p><label>Did you take your meal?<select name="meal"><option value="">Choose</option><option value="taken">Yes, I took my meal</option><option value="missed">No, I missed it</option><option value="interrupted">It was interrupted</option></select></label>`
}
/** One line under a timesheet's source saying what happened to the deduction. */
export function mealNote(s:any,r:any) {
 const d=r.mealDeduction;if(!d)return ''
 return html(s)`<small>${d.reversed?html(s)`Meal reported ${h(d.answer)}: ${h(d.minutes)} min deduction reversed`:d.answer==='taken'?html(s)`Meal deducted ${h(d.minutes)} min · confirmed taken`:html(s)`Meal deducted ${h(d.minutes)} min · not confirmed`}</small>`
}
