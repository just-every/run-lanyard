// EARN-001 screens: the signed-in person's own hours and estimated pay for the shown week (on
// Time), and the owner's estimate switch, pay date and pay statement link (on People).
import {h,rows,form,field,hidden,card,staffOf,venue} from './shared'
import {day,hours,money} from './format'
import {earnSettings,earningsOf} from '../domain/earnings'
import {type Week} from './week'

export function earningsCard(s:any,w:Week) {
 const me=staffOf(s,s.actor.staffId),e=earningsOf(s.actor.staffId,w.week,venue(s),rows(s,'shifts'),rows(s,'timesheets'),me?.hourlyRateCents??null,earnSettings(rows(s,'earnings')),{...s,timezone:venue(s)})
 const line=(label:string,minutes:number,pay:string)=>`<tr><th scope="row">${h(label)}</th><td class="num">${h(hours(minutes))} hrs</td><td class="num">${pay}</td></tr>`
 const rate=e.rateCents
 const priced=rate===null?'':`${h(money(Math.round(rate)))}/hr`
 const table=`<table class="list earnings"><tbody>${line('Scheduled',e.scheduledMinutes,'')}${line('Regular (approved)',e.regularMinutes,priced)}${line('Overtime over 40 hrs (approved)',e.overtimeMinutes,rate===null?'':`${h(money(Math.round(rate*1.5)))}/hr`)}${line('Shift differential (approved)',e.differential.minutes,e.estimates&&e.differential.costCents!==null?money(e.differential.costCents):'')}${line('Paid sick / safe leave (approved)',e.paidLeave.minutes,e.estimates?money(e.paidLeave.costCents):'')}${line('Holiday premium (approved)',e.holiday.minutes,e.estimates&&e.holiday.workedCostCents!==null?money(e.holiday.workedCostCents):'')}${line('Holiday non-work pay (approved)',e.holiday.nonWorkMinutes,e.estimates&&e.holiday.nonWorkCostCents!==null?money(e.holiday.nonWorkCostCents):'')}${line('Reporting / split / spread premium (approved)',e.jurisdiction.minutes,e.estimates?money(e.jurisdiction.costCents):'')}${line('Pending approval (not in the estimate)',e.pendingMinutes,'')}</tbody></table>`
 const estimate=!e.estimates?'<p class="note">Your employer has turned off pay estimates. Your hours are shown above.</p>':rate===null?'<p class="note">No hourly rate is on file for you yet, so no estimate is shown.</p>':`<p class="estimate"><strong>${h(money(e.estimateCents!))}</strong> Estimate before taxes and deductions</p>`
 const statement=e.statementUrl?`<p><a class="text-link" href="${h(e.statementUrl)}" rel="noopener noreferrer" target="_blank">Open your pay statement</a> · your payroll provider’s pay statement is the authoritative record.</p>`:'<p class="note">Your payroll provider’s pay statement is the authoritative record of your pay.</p>'
 return card('My hours and pay',`${table}${estimate}${statement}`,`<p class="card-note">Pay period ${h(day(e.week,false))} – ${h(day(e.end,false))} · ${e.payDate?`pay date ${h(day(e.payDate))}`:'pay date not set'}</p>`,'earnings')
}

export function earningsSettingsCard(s:any) {
 const r=rows(s,'earnings')[0],e=earnSettings(rows(s,'earnings'))
 const body=`${r?hidden('revision',r.revision):''}<label class="check"><input type="checkbox" name="estimates" value="true" ${e.estimates?'checked':''}> Show each employee an estimate of their own pay</label><div class="fields">${field('payDays','Fallback pay date: days after the week ends',e.payDays??'','number','min="0" max="31"')}${field('statementUrl','Pay statement link (your payroll provider)',e.statementUrl,'url','maxlength="300" placeholder="https://"')}</div>`
 return card('Employee pay estimates',`<p class="note">Employees see their own scheduled, approved and pending hours for their pay schedule, or weekly until assigned. The estimate counts approved hours at their rate, with overtime over 40 hours at 1.5x, before taxes and deductions; nobody sees a coworker’s hours or pay.</p>${form('earnings.save','people',body,'Save pay estimates','','secondary')}`,'','earnings-settings')
}
