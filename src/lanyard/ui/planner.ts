// Under the week: how a manager builds and publishes it (shift rows, the forecast and
// budget), and the availability and time off the schedule is checked against.
import {h,rows,manager,self,form,field,hidden,utc,exact,staffSelect,textarea,disclosure,card,status,empty,person,venue} from './shared'
import {type Week} from './week'
import {day,dollars,when,weekday} from './format'

const range=(r:any,tz:string)=>`${h(when(r.start,tz))} – ${h(when(r.end,tz))}`
function shiftRows(s:any,w:Week) {
 const sites=w.sites.length?`<datalist id="cafes">${w.sites.map(v=>`<option value="${h(v)}">`).join('')}</datalist>`:''
 return `<div data-shift-rows><div class="shift-input">${staffSelect(s).replace('name="staffId"','data-shift="staffId"').replace(' required','')}<label>Starts<input type="datetime-local" step="60" data-shift="start"></label><label>Ends<input type="datetime-local" step="60" data-shift="end"></label><label>Meal minutes<input type="number" data-shift="breakMinutes" min="0" max="1440" value="30"></label><label>Position<input data-shift="label" maxlength="120" placeholder="Barista"></label>${w.sites.length?`<label>Cafe<input data-shift="site" maxlength="80" list="cafes" value="${h(w.site)}"></label>`:''}<button type="button" data-remove-shift class="secondary small">Remove</button></div></div>${sites}`
}
function build(s:any,w:Week,back:string) {
 const current=w.shifts.map(x=>({staffId:x.staffId,start:x.start,end:x.end,breakMinutes:x.breakMinutes,...(x.label?{label:x.label}:{}),...(x.site?{site:x.site}:{})}))
 const keep=current.length?`<label class="check"><input type="checkbox" data-keep checked> Keep this week’s ${h(current.length)} shifts and add the rows above</label>`:''
 const body=form('roster.prepare',back,`${field('week','Week starting Monday',w.week,'date','required')}<p class="note">Times are ${h(venue(s))} wall time. Each draft is a new revision; nothing reaches staff until you publish it.</p>${shiftRows(s,w)}<button type="button" data-add-shift class="secondary small">Add another shift</button>${keep}${disclosure('Shift data (JSON)',textarea('shifts','Shifts (UTC timestamps, for agents and bulk edits)',JSON.stringify(current),'data-shifts-output rows="5" spellcheck="false"'))}`,'Prepare draft','data-roster-form','primary')
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
 return `<details class="card fold"><summary><h2>Availability</h2><span class="card-note">${h(list.length)} window${list.length===1?'':'s'}</span></summary>${add}${table}</details>`
}
function timeOff(s:any,back:string) {
 const tz=venue(s),list=rows(s,'leave')
 const decide=(r:any)=>manager(s)&&r.status==='pending'&&r.staffId!==s.actor.staffId&&r.requestedBy!==s.actor.id?`<div class="row-actions">${form('leave.decide',back,exact(r)+hidden('decision','approved'),'Approve','','primary small')}${form('leave.decide',back,exact(r)+hidden('decision','rejected'),'Decline','','secondary small')}</div>`:''
 const table=list.length?`<table class="list"><thead><tr><th>Person</th><th>Status</th><th>Off</th><th>Reason</th><th><span class="sr-only">Decide</span></th></tr></thead><tbody>${list.map(r=>`<tr><td>${h(person(s,r.staffId))}</td><td>${status(r.status,r.status==='rejected'?'declined':r.status)}</td><td>${range(r,tz)}</td><td>${h(r.reason)}</td><td>${decide(r)}</td></tr>`).join('')}</tbody></table>`:empty('No time off requested.','calendar')
 return card('Time off',table,`<p class="card-note">${h(list.filter(r=>r.status==='pending').length)} waiting</p>`)
}
function mine(s:any,back:string) {
 const body=`<div class="split">${disclosure('Add availability',form('availability.save',back,utc('start','Available from')+utc('end','Available until'),'Save availability','','secondary'))}${disclosure('Request time off',form('leave.request',back,utc('start','Time off starts')+utc('end','Time off ends')+field('reason','Reason','','text','required maxlength="500"'),'Request time off','','secondary'))}</div>`
 return card('My availability and time off',body)
}
export function planner(s:any,w:Week,back:string) {
 return [self(s)?mine(s,back):'',manager(s)?build(s,w,back)+forecastCard(s,w,back):'',timeOff(s,back),availability(s,back)].join('')
}
