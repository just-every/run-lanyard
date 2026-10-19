// Under the week: how a manager builds and publishes it (shift rows, the forecast and
// budget), and the availability and time off the schedule is checked against.
import {h,rows,manager,self,form,field,hidden,utc,exact,staffSelect,disclosure,card,status,empty,person,venue} from './shared'
import {type Week} from './week'
import {day,dollars,wallInput,when,weekday,zoneTime} from './format'
import {whoIsWorking} from './team'
import {allowedNote,approveLeave,leaveRulesCard,teamLeave} from './leave'
import {printCard} from './print'
import {repeatCard} from './templates'
import {collisionNote,patternForm,patternList} from './patterns'

const range=(r:any,tz:string)=>`${h(when(r.start,tz))} – ${h(when(r.end,tz))}`
/** One shift as editable fields; the browser serializes every row into the hidden `shifts` field. */
function shiftRow(s:any,w:Week,x?:any) {
 const at=(v:string)=>x?h(wallInput(v,w.tz)):''
 return `<div class="shift-input">${staffSelect(s,x?.staffId??'').replace('name="staffId"','data-shift="staffId"').replace(' required','')}<label>Starts<input type="datetime-local" step="60" data-shift="start" value="${at(x?.start)}"></label><label>Ends<input type="datetime-local" step="60" data-shift="end" value="${at(x?.end)}"></label><label>Meal minutes<input type="number" data-shift="breakMinutes" min="0" max="1440" value="${h(x?x.breakMinutes:30)}"></label><label>Position<input data-shift="label" maxlength="120" placeholder="Barista" value="${h(x?.label??'')}"></label>${w.sites.length?`<label>Cafe<input data-shift="site" maxlength="80" list="cafes" value="${h(x?x.site??'':w.site)}"></label>`:''}<button type="button" data-remove-shift class="secondary small">Remove</button></div>`
}
function build(s:any,w:Week,back:string) {
 const current=[...w.shifts].sort((a,b)=>a.start.localeCompare(b.start)||String(a.staffId).localeCompare(String(b.staffId)))
 const sites=w.sites.length?`<datalist id="cafes">${w.sites.map(v=>`<option value="${h(v)}">`).join('')}</datalist>`:''
 const keep=current.length?`<label class="check"><input type="checkbox" data-keep checked> Keep this week’s ${h(current.length)} shifts and add the rows above</label><details class="current-shifts"><summary>Edit or remove this week’s ${h(current.length)} shifts</summary><div data-current-rows>${current.map(x=>shiftRow(s,w,x)).join('')}</div></details>`:''
 const body=form('roster.prepare',back,`${field('week','Week starting Monday',w.week,'date','required')}<p class="note">Times are ${h(zoneTime(w.tz))}. Each draft is a new revision; nothing reaches staff until you publish it.</p><noscript><p class="note">Building a week on this screen needs JavaScript. Agents prepare weeks with roster.prepare (Agent access).</p></noscript><div data-shift-rows>${shiftRow(s,w)}</div>${sites}<button type="button" data-add-shift class="secondary small">Add another shift</button>${keep}<input type="hidden" name="shifts" value="" data-shifts-output>`,'Prepare draft','data-roster-form','primary')
 return card(w.roster?'Edit this week':'Build this week',body,`<p class="card-note">${w.roster?`${h(w.shifts.length)} shifts in the ${h(w.view)} revision`:'No revision yet'}</p>`,'plan')
}
function forecastCard(s:any,w:Week,back:string) {
 const f=w.forecast
 const inputs=w.days.map((d,i)=>`<label>${h(weekday(d))} <span>${h(day(d,false))}</span><input name="days" inputmode="numeric" pattern="[0-9,$]*" value="${f?h(f.days[i]):''}" required></label>`).join('')
 const body=form('forecast.save',back,`${hidden('week',w.week)}${hidden('site',w.site)}<div class="forecast-days">${inputs}<label>Labor budget %<input name="budgetPercent" inputmode="decimal" value="${h(f?.budgetPercent??'')}" placeholder="25"></label></div><p class="note">Expected sales per day in whole dollars. The footer divides each day’s scheduled labor cost by it.</p>`,f?'Save forecast':'Add forecast','','secondary')
 return card('Sales forecast and labor budget',body,`<p class="card-note">${f?`${h(dollars(f.days.reduce((a:number,b:number)=>a+b,0)))} this week${w.site?` at ${h(w.site)}`:''}`:'Not set for this week'}</p>`)
}
function availability(s:any,back:string) {
 const tz=venue(s),list=rows(s,'availability').filter(r=>manager(s)||r.staffId===s.actor.staffId)
 const table=list.length?`<table class="list"><thead><tr><th>Person</th><th>Available</th><th><span class="sr-only">Edit</span></th></tr></thead><tbody>${list.map(r=>`<tr><td>${h(person(s,r.staffId))}</td><td>${range(r,tz)}</td><td>${disclosure('Edit',form('availability.save',back,exact(r)+hidden('staffId',r.staffId)+utc('start','Available from',r.start)+utc('end','Available until',r.end),'Save availability','','secondary'),false,'inline-menu')}</td></tr>`).join('')}</tbody></table>`:empty('No availability recorded yet. A shift can be published only inside its person’s availability.','calendar')
 const add=manager(s)?disclosure('Record availability',form('availability.save',back,staffSelect(s)+utc('start','Available from')+utc('end','Available until'),'Save availability','','secondary')):''
 const waiting=rows(s,'patterns').some(r=>r.status==='pending')
 return `<details class="card fold" id="availability"${waiting?' open':''}><summary><h2>Availability</h2><span class="card-note">${h(list.length)} window${list.length===1?'':'s'}</span></summary>${add}${manager(s)?patternForm(s,back,true):''}${table}${patternList(s,back)}</details>`
}
function timeOff(s:any,back:string) {
 const tz=venue(s),list=rows(s,'leave')
 const decide=(r:any)=>manager(s)&&r.status==='pending'&&r.staffId!==s.actor.staffId&&r.requestedBy!==s.actor.id?`<div class="row-actions">${approveLeave(s,r,back)}${form('leave.decide',back,exact(r)+hidden('decision','rejected'),'Decline','','secondary small')}</div>`:''
 const table=list.length?`<table class="list"><thead><tr><th>Person</th><th>Status</th><th>Off</th><th>Reason</th><th><span class="sr-only">Decide</span></th></tr></thead><tbody>${list.map(r=>`<tr><td>${h(person(s,r.staffId))}</td><td>${status(r.status,r.status==='rejected'?'declined':r.status)}</td><td>${range(r,tz)}</td><td>${h(r.reason)}${r.status==='pending'&&r.flags?.length?`<small>Needs an override: ${h(r.flags.join('; '))}</small>`:''}${r.override?`<small>Override: ${h(r.override.reason)}</small>`:''}</td><td>${decide(r)}</td></tr>`).join('')}</tbody></table>`:empty('No time off requested.','calendar')
 return card('Time off',table,`<p class="card-note">${h(list.filter(r=>r.status==='pending').length)} waiting</p>`,'time-off')
}
function mine(s:any,back:string) {
 const body=`<div class="split">${patternForm(s,back)}${disclosure('Add availability',form('availability.save',back,utc('start','Available from')+utc('end','Available until'),'Save availability','','secondary'))}${disclosure('Request time off',allowedNote(s)+form('leave.request',back,utc('start','Time off starts')+utc('end','Time off ends')+field('reason','Reason','','text','required maxlength="500"'),'Request time off','','secondary'))}</div>`
 return card('My availability and time off',body)
}
export function planner(s:any,w:Week,back:string,extras:any={}) {
 return [collisionNote(s,extras),manager(s)?'':whoIsWorking(s,w),self(s)?mine(s,back):'',manager(s)?build(s,w,back)+repeatCard(s,w,back)+printCard(s,w,back,extras)+forecastCard(s,w,back)+teamLeave(s,w):'',timeOff(s,back),manager(s)?leaveRulesCard(s,back):'',availability(s,back)].join('')
}
