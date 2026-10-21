// SCHEDULE-002 under the week: copy days from another week, save or apply a template,
// and the recurring shifts that can be added to the shown week. Each makes a new draft.
import {h,rows,form,field,hidden,exact,staffSelect,card,disclosure,empty,person} from './shared'
import {type Week} from './week'
import {addDays,day,weekday} from './format'

const NAMES=[0,1,2,3,4,5,6]
/** "06:00" as "6:00 am". */
const t12=(hm:string)=>{const [H,M]=hm.split(':').map(Number);return `${H%12||12}:${String(M).padStart(2,'0')} ${H<12?'am':'pm'}`}
const dayBoxes=(w:Week,checked:number[]=NAMES)=>`<div class="fields">${NAMES.map(i=>`<label class="check"><input type="checkbox" name="days" value="${i}" ${checked.includes(i)?'checked':''}> ${h(weekday(w.days[i]))}</label>`).join('')}</div>`

export function repeatCard(s:any,w:Week,back:string) {
 const list=rows(s,'templates'),recurring=rows(s,'recurrences').filter(r=>!r.removed)
 const copy=disclosure('Copy from another week',form('roster.copy',back,`${hidden('week',w.week)}${field('fromWeek','Copy from the week starting',addDays(w.week,-7),'date','required')}${dayBoxes(w)}`,'Copy into this week','','secondary'))
 const save=w.shifts.length||rows(s,'openshifts').some(o=>o.week===w.week&&['open','draft'].includes(o.status))?disclosure('Save this week as a template',form('template.save',back,`${hidden('week',w.week)}${field('name','Template name','','text','required maxlength="80" placeholder="Standard week"')}`,'Save template','','secondary')):''
 const apply=list.length?disclosure('Apply a template',form('template.apply',back,`${hidden('week',w.week)}<label>Template<select name="id" required>${list.map(t=>`<option value="${h(t.id)}">${h(t.name)} (${h(t.slots.length)} shifts)</option>`).join('')}</select></label>${dayBoxes(w)}`,'Apply to this week','','secondary')):''
 const table=recurring.length?`<table class="list"><thead><tr><th>Person</th><th>Repeats</th><th>From – until</th><th><span class="sr-only">Remove</span></th></tr></thead><tbody>${recurring.map(r=>`<tr><td>${h(person(s,r.staffId))}</td><td>${h(r.days.map((i:number)=>weekday(w.days[i])).join(', '))} · ${h(t12(r.start))} – ${h(t12(r.end))}</td><td>${h(day(r.from))} – ${h(day(r.until))}${r.except.length?`<small>Skips ${h(r.except.map((d:string)=>day(d)).join(', '))}</small>`:''}</td><td>${form('recurrence.save',back,exact(r)+hidden('removed','true'),'Remove','','secondary small')}</td></tr>`).join('')}</tbody></table>${form('recurrence.apply',back,hidden('week',w.week),'Add this week’s recurring shifts','','secondary')}`:empty('No recurring shifts.','calendar')
 const add=disclosure('Add a recurring shift',form('recurrence.save',back,`${staffSelect(s)}${dayBoxes(w,[])}<div class="fields">${field('start','Starts','07:00','time','required')}${field('end','Ends','15:00','time','required')}${field('breakMinutes','Meal minutes',30,'number','min="0" max="1440"')}${field('label','Position','','text','maxlength="120"')}${field('from','First day',w.week,'date','required')}${field('until','Last day','','date','required')}${field('except','Skip dates (YYYY-MM-DD, comma separated)','','text','maxlength="1100"')}</div>`,'Save recurring shift','','secondary'))
 return card('Copy and repeat',`<p class="note">Each of these makes a new draft of this week, rechecked against availability, approved time off and overlaps. Nothing is published or confirmed until you publish.</p><div class="split">${copy}${save}${apply}</div><h3>Recurring shifts</h3>${table}${add}`,'','repeat')
}
