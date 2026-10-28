// EARN-001 screens: the signed-in person's own hours and estimated pay for the shown week (on
// Time), and the owner's estimate switch, pay date and pay statement link (on People).
import {h,rows,form,field,hidden,card} from './shared'
import {day,hours,money} from './format'
import {earnSettings,type EarningsEstimate} from '../domain/earnings'
import {type Week} from './week'

export function earningsCard(s:any,w:Week) {
 const e=s.ownEarnings as EarningsEstimate
 const line=(label:string,minutes:number,pay:number|null)=>`<tr><th scope="row">${h(label)}</th><td class="num">${h(hours(minutes))} hrs</td><td class="num">${pay===null?'':h(money(pay))}</td></tr>`
 const table=`<table class="list earnings"><tbody>${line('Scheduled',e.scheduledMinutes,null)}${line('Regular (approved)',e.regularMinutes,e.regularCostCents)}${line('Overtime (approved)',e.overtimeMinutes,e.overtimeCostCents)}${line('Double time (approved)',e.doubleMinutes,e.doubleCostCents)}${line('Shift differential (approved)',e.differential.minutes,e.differential.costCents)}${line('Paid sick / safe leave (approved)',e.paidLeave.minutes,e.paidLeave.costCents)}${line('Holiday premium (approved)',e.holiday.minutes,e.holiday.workedCostCents)}${line('Holiday non-work pay (approved)',e.holiday.nonWorkMinutes,e.holiday.nonWorkCostCents)}${line('Reporting / split / spread premium (approved)',e.jurisdiction.minutes,e.jurisdiction.costCents)}${line('Tip pool allocation (approved)',0,e.tips.costCents)}${line('Pending approval (not in the estimate)',e.pendingMinutes,null)}</tbody></table>`
 const estimate=!e.estimates?'<p class="note">Your employer has turned off pay estimates. Your hours are shown above.</p>':e.rateCents===null?'<p class="note">No hourly rate is on file for you yet, so no estimate is shown.</p>':e.policyReviewRequired?'<p class="note">Your employer needs to review policy inputs before a pay estimate can be shown.</p>':e.estimateCents===null?'<p class="note">Some approved hours need a retained rate before an estimate can be shown.</p>':`<p class="estimate"><strong>${h(money(e.estimateCents))}</strong> Estimate before taxes and deductions</p><p class="note">Overtime uses your employer’s daily and weekly rules. Mixed rates use a weighted-average estimate.</p>`
 const statement=e.statementUrl?`<p><a class="text-link" href="${h(e.statementUrl)}" rel="noopener noreferrer" target="_blank">Open your pay statement</a> · your payroll provider’s pay statement is the authoritative record.</p>`:'<p class="note">Your payroll provider’s pay statement is the authoritative record of your pay.</p>'
 return card('My hours and pay',`${table}${estimate}${statement}`,`<p class="card-note">Pay period ${h(day(e.week,false))} – ${h(day(e.end,false))} · ${e.payDate?`pay date ${h(day(e.payDate))}`:'pay date not set'}</p>`,'earnings')
}

export function earningsSettingsCard(s:any) {
 const r=rows(s,'earnings')[0],e=earnSettings(rows(s,'earnings'))
 const body=`${r?hidden('revision',r.revision):''}<label class="check"><input type="checkbox" name="estimates" value="true" ${e.estimates?'checked':''}> Show each employee an estimate of their own pay</label><div class="fields">${field('payDays','Fallback pay date: days after the week ends',e.payDays??'','number','min="0" max="31"')}${field('statementUrl','Pay statement link (your payroll provider)',e.statementUrl,'url','maxlength="300" placeholder="https://"')}</div>`
 return card('Employee pay estimates',`<p class="note">Employees see their own scheduled, approved and pending hours for their pay schedule, or weekly until assigned. The estimate uses approved hours at retained rates, daily and weekly overtime and double time under configured rules, before taxes and deductions; nobody sees a coworker’s hours or pay.</p>${form('earnings.save','people',body,'Save pay estimates','','secondary')}`,'','earnings-settings')
}
