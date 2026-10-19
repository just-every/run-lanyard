// Time: the phone clock, timesheets waiting for approval, and the week's worked time
// in day bands like the schedule's, with corrections that keep the original record.
import {h,rows,person,manager,self,form,field,hidden,utc,exact,staffSelect,disclosure,card,status,empty,avatar,titleRow,venue,moment,staffOf} from './shared'
import {type Week} from './week'
import {dateKey,day,hours,span} from './format'

const timeFields=(s:any,r:any={})=>staffSelect(s,r.staffId)+utc('start','Work starts',r.start)+utc('end','Work ends',r.end)+field('breakMinutes','Meal minutes',r.breakMinutes??0,'number','required min="0" max="1440"')+field('reason','Reason for manual entry or correction','','text','required maxlength="120"')+(r.id?hidden('corrects',r.id):'')
function clockCard(s:any,tz:string) {
 const open=rows(s,'clocks').find(r=>r.staffId===s.actor.staffId&&r.status==='open')
 return `<section class="card clock" data-clock data-actor="${h(s.actor.id)}"><div class="clock-state">${avatar(staffOf(s,s.actor.staffId)?.name??s.actor.email)}<p><strong>${open?`Clocked in at ${moment(open.start,tz)}`:'You are clocked out.'}</strong><span data-clock-status role="status" aria-live="polite"></span></p></div><form data-clock-form data-command="clock.${open?'out':'in'}">${open?field('breakMinutes','Meal minutes',0,'number','required min="0" max="1440"'):''}<button type="submit" class="primary">Clock ${open?'out':'in'}</button></form><button type="button" class="secondary" data-clock-retry hidden>Retry queued clock event</button><p class="note">A clock event keeps its original time and command ID if the connection drops. Keep this page open and retry when you are back online.</p><noscript><p class="note">Turn on JavaScript to use the clock and its retry queue.</p></noscript></section>`
}
function line(s:any,r:any,tz:string,back:string,canManage:boolean,showDay=false) {
 const approve=canManage&&r.status==='submitted'&&r.staffId!==s.actor.staffId?form('time.approve',back,exact(r),'Approve','','primary small'):''
 const correct=canManage&&r.status==='approved'&&!rows(s,'timesheets').some(t=>t.corrects===r.id)?disclosure('Correct',`<p class="note">A correction keeps this record and needs its own approval.</p>${form('time.prepare',back,timeFields(s,r),'Prepare correction','','secondary')}`,false,'inline-menu'):''
 return `<tr${r.status==='superseded'?' class="superseded"':''}><td class="who">${avatar(person(s,r.staffId))}<span>${h(person(s,r.staffId))}</span></td>${showDay?`<td class="day">${h(day(dateKey(r.start,tz)))}</td>`:''}<td class="span" data-label="Clocked">${h(span(r.start,r.end,tz))}</td><td class="num meal" data-label="Meal">${h(r.breakMinutes)} min</td><td class="num hrs" data-label="Hours">${h(hours(r.minutes))}</td><td class="src" data-label="Source">${h(r.reason)}${r.corrects?' · correction':''}<small>Revision ${h(r.revision)}</small></td><td class="st" data-label="Status">${status(r.status)}</td><td class="act"><div class="row-actions">${approve}${correct}</div></td></tr>`
}
const head=(showDay=false)=>`<thead><tr><th>Person</th>${showDay?'<th>Day</th>':''}<th>Clocked</th><th class="num">Meal</th><th class="num">Hours</th><th>Source</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead>`
export function time(s:any,w:Week,now:number,back:string) {
 const tz=venue(s),canManage=manager(s),inSite=(r:any)=>!w.site||staffOf(s,r.staffId)?.site===w.site||!staffOf(s,r.staffId)?.site
 const all=rows(s,'timesheets').filter(inSite),week=all.filter(r=>w.days.includes(dateKey(r.start,tz)))
 const worked=week.filter(r=>r.status!=='superseded').reduce((n,r)=>n+r.minutes,0)
 const title=canManage?`${w.site||'All cafes'} · ${hours(worked)} hrs worked`:'My time'
 // Approvals are never hidden by the cafe filter: a cover may be someone else's home cafe.
 const waiting=canManage?rows(s,'timesheets').filter(r=>r.status==='submitted'&&r.staffId!==s.actor.staffId):[]
 const toApprove=waiting.length?card('To approve',`<table class="list stack time-list">${head(true)}<tbody>${waiting.map(r=>line(s,r,tz,back,canManage,true)).join('')}</tbody></table>`,`<p class="card-note">${h(waiting.length)} waiting</p>`,'approve'):''
 const days=w.days.map(d=>({d,list:week.filter(r=>dateKey(r.start,tz)===d)})).filter(v=>v.list.length)
 const table=days.length?`<table class="list banded stack time-list">${head()}${days.map(v=>`<tbody><tr class="band"><th colspan="7">${h(day(v.d))}<span>${h(hours(v.list.filter(r=>r.status!=='superseded').reduce((n,r)=>n+r.minutes,0)))} hrs</span></th></tr>${v.list.map(r=>line(s,r,tz,back,canManage)).join('')}</tbody>`).join('')}</table>`:empty(canManage?`No time recorded for the week of ${day(w.week)}. Staff clock in from their phones, or record worked time below.`:'No time recorded this week. Use the clock to record your work.')
 const manual=canManage?card('Record worked time',form('time.prepare',back,timeFields(s),'Prepare timesheet','','secondary'),'<p class="card-note">For a missed clock-in</p>'):''
 const history=rows(s,'clocks').filter(inSite).filter(r=>w.days.includes(dateKey(r.start,tz)))
 const clocks=`<details class="card fold"><summary><h2>Clock history</h2><span class="card-note">${h(history.length)} this week</span></summary>${history.length?`<table class="list stack clock-list"><thead><tr><th>Person</th><th>Day</th><th>Clock</th><th>Status</th></tr></thead><tbody>${history.map(r=>`<tr><td class="who">${h(person(s,r.staffId))}</td><td class="day">${h(day(dateKey(r.start,tz)))}</td><td class="span" data-label="Clock">${r.end?h(span(r.start,r.end,tz)):`in ${moment(r.start,tz)}`}</td><td class="st" data-label="Status">${status(r.status)}</td></tr>`).join('')}</tbody></table>`:empty('No clock events this week.')}</details>`
 return `${titleRow(title,s,now)}${self(s)?clockCard(s,tz):''}${toApprove}${card(`Week of ${day(w.week)}`,table,`<p class="card-note">${h(week.length)} timesheet${week.length===1?'':'s'}</p>`)}${manual}${clocks}`
}
