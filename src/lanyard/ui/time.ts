import {localDay,localWeekday,html,t as tr} from '../localization'
import {locationFields,locationReview} from './geofence'
import {photoFields,photoReview} from './photos'
import {sickOwnCard} from './sick'
import {differentialNote} from './differentials'
// Time: the phone clock, timesheets waiting for approval, and the week's worked time
// in day bands like the schedule's, with corrections that keep the original record.
import {h,rows,person,manager,self,form,field,hidden,utc,exact,staffSelect,disclosure,card,staffStatus,empty,avatar,titleRow,venue,moment,staffOf} from './shared'
import {type Week} from './week'
import {dateKey,day,hours,span} from './format'
import {bulkControls,bulkResult,filterOf,shown} from './approvals'
import {mealNote,mealQuestion} from './mealrules'
import {earningsCard} from './earnings'
import {paidNote,neutralityCard} from './rounding'
import {myFeedbackCard,feedbackCard} from './feedback'
import {sharedNotesCard} from './journal'
import {reminderCard,provisionalCard} from './closerules'
import {reviewNote,reviewActions,returnedCard} from './review'
import {exceptionsCard,myRequestsCard} from './cases'
import {breakButtons,clockBreaks,breakQuestions,breakNote} from './breaks'
import {clockQuestions,answersNote,safetyCard,tipsCard} from './questions'
import {attendanceCard} from './attendance'
import {signoffCard} from './periods'
import {offlineCard,captureReceipts} from './offline'
import {segmentTime} from './shiftwork'
import {clockJobs,transferFields} from './transfers'
import {logbookCard} from './logbook'

const timeFields=(s:any,r:any={})=>staffSelect(s,r.staffId)+utc('start',tr(s,'Work starts'),r.start)+utc('end',tr(s,'Work ends'),r.end)+field('breakMinutes',tr(s,'Meal minutes'),r.breakMinutes??0,'number','required min="0" max="1440"')+field('reason',tr(s,'Reason for manual entry or correction'),'','text','required maxlength="120"')+(r.id?hidden('corrects',r.id):'')
function clockCard(s:any,tz:string,now:number) {
 const open=rows(s,'clocks').find(r=>r.staffId===s.actor.staffId&&r.status==='open')
 // TIME-007: a provisionally closed punch is ended from its reminder card, never by a late clock-out.
 if(open?.provisional)return ''
 // BREAK-001: while on a break the clock only ends it; otherwise breaks start beside clock-out.
 const b=open?breakButtons(s,open):null
 return html(s)`<section class="card clock" data-clock data-version="${h(s.version)}" data-actor="${h(s.actor.id)}" data-state="${h(JSON.stringify(open??null))}"><div class="clock-state">${avatar(staffOf(s,s.actor.staffId)?.name??s.actor.email)}<p><strong>${open?html(s)`Clocked in at ${moment(open.start,tz,s)}`:tr(s,'You are clocked out.')}</strong>${clockJobs(s,open,tz)}<span data-clock-status role="status" aria-live="polite"></span></p></div>${open?clockBreaks(s,open,tz):''}${photoFields(s,now)}${locationFields(s,now)}<form data-clock-form data-command="${h(b?.command??'clock.in')}">${open&&b?.command==='clock.out'?(open.breaks?.some((x:any)=>x.kind==='meal')?hidden('breakMinutes',0):field('breakMinutes',tr(s,'Meal minutes'),0,'number','required min="0" max="1440"'))+mealQuestion(s,open)+breakQuestions(s,open)+clockQuestions(s,open,'out')+transferFields(s,open)+b.fields:open?'':clockQuestions(s,null,'in')}<button type="submit" class="primary">${h(b?.label??tr(s,'Clock in'))}</button></form><button type="button" class="secondary" data-clock-retry hidden>Retry queued clock events</button><template data-clock-fields="in">${clockQuestions(s,null,'in')}</template><template data-clock-fields="out">${field('breakMinutes',tr(s,'Meal minutes'),0,'number','required min="0" max="1440"')+mealQuestion(s,open??{})+breakQuestions(s,open??{})+clockQuestions(s,open??{},'out')+transferFields(s,open)}</template><p class="note">A clock event keeps its original time and command ID if the connection drops. Pending captures are encrypted on this device across restarts. Reconnect to sync; rejected captures stay visible for review.</p><noscript><p class="note">Turn on JavaScript to use the clock and its retry queue.</p></noscript></section>`
}
function line(s:any,r:any,tz:string,back:string,canManage:boolean,showDay=false) {
 const approve=canManage&&r.status==='submitted'&&r.staffId!==s.actor.staffId?form('time.approve',back,exact(r),tr(s,'Approve'),'','primary small')+reviewActions(r,back):''
 const correct=canManage&&r.status==='approved'&&!rows(s,'timesheets').some(t=>t.corrects===r.id)?disclosure(tr(s,'Correct'),html(s)`<p class="note">A correction keeps this record and needs its own approval.</p>${form('time.prepare',back,timeFields(s,r),tr(s,'Prepare correction'),'','secondary')}`,false,'inline-menu'):''
 return html(s)`<tr${r.status==='superseded'?' class="superseded"':''}><td class="who">${avatar(person(s,r.staffId))}<span>${h(person(s,r.staffId))}</span></td>${showDay?html(s)`<td class="day">${h(localDay(s,dateKey(r.start,tz)))}</td>`:''}<td class="span" data-label="Clocked">${h(span(r.start,r.end,tz))}</td><td class="num meal" data-label="Meal">${h(r.breakMinutes)} min</td><td class="num hrs" data-label="Hours">${h(hours(r.minutes))}</td><td class="src" data-label="Source">${h(r.clockId&&r.reason==='Phone clock'?tr(s,'Phone clock'):r.reason)}${r.corrects?tr(s,' · correction'):''}<small>Revision ${h(r.revision)}</small>${r.exceptions?.length?html(s)`<small>Flagged: ${h(r.exceptions.map((value:string)=>value==='missed break reported'?tr(s,value):value).join(', '))}</small>`:''}${r.network?html(s)`<small>Network: ${h([r.network.in,r.network.out].filter(Boolean).map((n:any)=>`${n.ip||tr(s,'unknown')} (${n.via??tr(s,'not approved')})`).join(' → '))}</small>`:''}${mealNote(s,r)}${breakNote(s,r,tz)}${answersNote(s,r)}${segmentTime(s,r)}${differentialNote(s,r,tz)}${paidNote(s,r,tz)}${reviewNote(s,r,tz)}${photoReview(s,r)}${locationReview(s,r)}</td><td class="st" data-label="Status">${staffStatus(s,r.status)}</td><td class="act"><div class="row-actions">${approve}${correct}</div></td></tr>`
}
const head=(s:any,showDay=false)=>html(s)`<thead><tr><th>Person</th>${showDay?html(s)`<th>Day</th>`:''}<th>Clocked</th><th class="num">Meal</th><th class="num">Hours</th><th>Source</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead>`
export function time(s:any,w:Week,now:number,back:string,q:URLSearchParams,extras:any) {
 const tz=venue(s),canManage=manager(s),inSite=(r:any)=>!w.site||staffOf(s,r.staffId)?.site===w.site||!staffOf(s,r.staffId)?.site
 const all=rows(s,'timesheets').filter(inSite),week=all.filter(r=>w.days.includes(dateKey(r.start,tz)))
 const worked=week.filter(r=>r.status!=='superseded').reduce((n,r)=>n+r.minutes,0)
 const title=canManage?html(s)`${w.site||tr(s,'All cafes')} · ${hours(worked)} hrs worked`:tr(s,'My time')
 // Approvals are never hidden by the cafe filter: a cover may be someone else's home cafe.
 const waiting=canManage?rows(s,'timesheets').filter(r=>r.status==='submitted'&&r.staffId!==s.actor.staffId):[]
 const f=filterOf(q),list=shown(s,waiting,f),report=canManage?bulkResult(s,extras):''
 const toApprove=waiting.length||report?card(tr(s,'To approve'),html(s)`${report}${bulkControls(s,list,f,q,back)}${list.length?html(s)`<table class="list stack time-list">${head(s,true)}<tbody>${list.map(r=>line(s,r,tz,back,canManage,true)).join('')}</tbody></table>`:empty(waiting.length?tr(s,'No waiting timesheets match this filter.'):tr(s,'Nothing is waiting for approval.'))}`,html(s)`<p class="card-note">${h(list.length)} of ${h(waiting.length)} waiting</p>`,'approve'):''
 const days=w.days.map(d=>({d,list:week.filter(r=>dateKey(r.start,tz)===d)})).filter(v=>v.list.length)
 const table=days.length?html(s)`<table class="list banded stack time-list">${head(s)}${days.map(v=>html(s)`<tbody><tr class="band"><th colspan="7">${h(localDay(s,v.d))}<span>${h(hours(v.list.filter(r=>r.status!=='superseded').reduce((n,r)=>n+r.minutes,0)))} hrs</span></th></tr>${v.list.map(r=>line(s,r,tz,back,canManage)).join('')}</tbody>`).join('')}</table>`:empty(canManage?html(s)`No time recorded for the week of ${localDay(s,w.week)}. Staff clock in from their phones, or record worked time below.`:tr(s,'No time recorded this week. Use the clock to record your work.'))
 const manual=canManage?card(tr(s,'Record worked time'),form('time.prepare',back,timeFields(s),tr(s,'Prepare timesheet'),'','secondary'),html(s)`<p class="card-note">For a missed clock-in</p>`):''
 const history=rows(s,'clocks').filter(inSite).filter(r=>w.days.includes(dateKey(r.start,tz)))
 const clocks=html(s)`<details class="card fold"><summary><h2>Clock history</h2><span class="card-note">${h(history.length)} this week</span></summary>${history.length?html(s)`<table class="list stack clock-list"><thead><tr><th>Person</th><th>Day</th><th>Clock</th><th>Status</th></tr></thead><tbody>${history.map(r=>html(s)`<tr><td class="who">${h(person(s,r.staffId))}</td><td class="day">${h(localDay(s,dateKey(r.start,tz)))}</td><td class="span" data-label="Clock">${r.end?h(span(r.start,r.end,tz)):html(s)`in ${moment(r.start,tz,s)}`}${captureReceipts(s,r,tz)}</td><td class="st" data-label="Status">${staffStatus(s,r.status)}</td></tr>`).join('')}</tbody></table>`:empty(tr(s,'No clock events this week.'))}</details>`
 return html(s)`${titleRow(title,s,now)}${self(s)?reminderCard(s,tz,back)+returnedCard(s,tz,back)+(manager(s)?'':signoffCard(s))+clockCard(s,tz,now)+myRequestsCard(s,tz,back)+safetyCard(s,tz,back,false)+myFeedbackCard(s,tz,back)+earningsCard(s,w)+sickOwnCard(s,back)+sharedNotesCard(s):''}${canManage?attendanceCard(s,tz,back,now)+logbookCard(s,q):''}${offlineCard(s,tz,back)}${toApprove}${canManage?provisionalCard(s,tz,back)+exceptionsCard(s,tz,back)+safetyCard(s,tz,back,true)+tipsCard(s,w.days,tz):''}${canManage?feedbackCard(s,w,q,back,tz)+neutralityCard(s,week):''}${card(html(s)`Week of ${localDay(s,w.week)}`,table,html(s)`<p class="card-note">${h(week.length)} timesheet${week.length===1?'':'s'}</p>`)}${manual}${clocks}`
}
