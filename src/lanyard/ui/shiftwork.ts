import {localDay,localWeekday,html,t as tr} from '../localization'
// SCHEDULE-004: operational handover in the existing Schedule cards.
import {h,rows,manager,card,hidden,form,textarea,field,disclosure,person} from './shared'
import {day,dateKey,span,hours} from './format'
import {type Week} from './week'
const pin=(x:any,w:any)=>hidden('shiftId',x.id)+hidden('shiftRevision',x.revision)+(w?hidden('revision',w.revision):'')
const link=(a:any)=>a.attachment?`<a class="text-link" href="/api/lanyard/handover/${h(a.id)}/files/${h(a.attachment.id)}">${h(a.attachment.name)}</a>`:''
const response=(s:any,a:any)=>html(s)`<li>${h(person(s,a.staffId))} · instruction revision ${h(a.workRevision)}<ul>${a.completed.map((t:any)=>html(s)`<li>Completed: ${h(t.text)}</li>`).join('')}</ul>${a.blocker?html(s)`<p>Blocker: ${h(a.blocker)}</p>`:''}${link(a)}</li>`
function segmentRow(s:any,p:any={}) {
 return `<div class="fields" data-area-row><label>Job<select name="segmentJob"><option value="">Choose job</option>${rows(s,'jobs').map(j=>`<option value="${h(j.id)}" ${p.job===j.id?'selected':''}>${h(j.name)}</option>`).join('')}</select></label>${field('segmentArea','Work area',p.area??'','text','maxlength="80"')}${field('segmentUntil','Ends at minute',p.until??'','number','min="1" max="2880"')}<button type="button" class="secondary" data-remove-area>Remove area</button></div>`
}
export function shiftworkCard(s:any,w:Week,back:string) {
 const manages=(x:any)=>s.actor.role==='owner'||s.actor.role==='manager'&&(rows(s,'staff').find(p=>p.id===s.actor.staffId)?.site??'')===(x.site||rows(s,'staff').find(p=>p.id===x.staffId)?.site||'')
 const shifts=rows(s,'shifts').filter(x=>x.status==='published'&&w.days.includes(dateKey(x.start,w.tz))&&(!w.site||(x.site||rows(s,'staff').find(p=>p.id===x.staffId)?.site||'')===w.site)&&(manages(x)||x.staffId===s.actor.staffId))
 const rendered=shifts.map(x=>{
  const work=rows(s,'shiftwork').find(r=>r.lineage===(x.lineage??x.id)),answers=rows(s,'taskanswers').filter(a=>a.lineage===(x.lineage??x.id))
  if(!work&&!manages(x))return ''
  const segments=work?.segments??[]
  const content=work?html(s)`<p>${h(work.notes)}</p>${segments.length?html(s)`<ol>${segments.map((p:any)=>html(s)`<li>${h(rows(s,'jobs').find(j=>j.id===p.job)?.name??tr(s,'Former job'))} · ${h(p.area)} · ${h(p.from)}–${h(p.until)} minutes</li>`).join('')}</ol>`:''}${work.tasks.length?html(s)`<ul>${work.tasks.map((t:any)=>html(s)`<li>${h(t.text)}</li>`).join('')}</ul>`:''}`:html(s)`<p class="note">No instructions yet.</p>`
  const edit=manages(x)?disclosure(tr(s,'Edit handover'),form('shiftwork.save',back,pin(x,work)+textarea('notes',tr(s,'Operational notes'),work?.notes??'','maxlength="4000"')+textarea('taskLines',tr(s,'Checklist — one task per line'),(work?.tasks??[]).map((t:any)=>t.text).join('\n'),'maxlength="8430"')+html(s)`<p class="note">Areas cover the entire shift (${h((Date.parse(x.end)-Date.parse(x.start))/60000)} elapsed minutes). Use increasing end minutes from shift start. Unpaid minutes are shared proportionally.</p><div data-area-list>${(segments.length?segments:[{},{}]).map((p:any)=>segmentRow(s,p)).join('')}</div><template data-area-template>${segmentRow(s)}</template><button type="button" class="secondary" data-add-area>Add work area</button>`,tr(s,'Save handover'),'data-handover-editor','secondary')):''
  const completed=new Set(answers.filter(a=>a.workRevision===work?.revision).flatMap(a=>a.completed.map((t:any)=>t.id)))
  const respond=work&&x.staffId===s.actor.staffId?html(s)`<form method="post" enctype="multipart/form-data" action="/app/action?name=shiftwork.respond&amp;returnTo=${encodeURIComponent(back)}">${pin(x,work)}${work.tasks.map((t:any)=>html(s)`<label class="check"><input type="checkbox" name="completed" value="${h(t.id)}" ${completed.has(t.id)?'checked':''}>${h(t.text)}</label>`).join('')}${textarea('blocker',tr(s,'Report a blocker'),'','maxlength="2000"')}<label>Blocker attachment (optional, 1 MB)<input type="file" name="attachment"></label><button class="secondary" type="submit">Send handover</button></form>`:''
  return html(s)`<article class="handover-entry"><h3>${h(person(s,x.staffId))} · ${h(localDay(s,dateKey(x.start,w.tz)))} · ${h(span(x.start,x.end,w.tz))}</h3>${content}${respond}${answers.length?html(s)`<ul class="journal">${answers.map(a=>response(s,a)).join('')}</ul>`:''}${edit}</article>`
 }).join('')
 const visible=new Set(shifts.map(x=>x.lineage??x.id)),prior=rows(s,'taskanswers').filter(a=>!visible.has(a.lineage))
 if(!rendered&&!prior.length)return ''
 return card(tr(s,'Shift handover'),rendered+(prior.length?disclosure(tr(s,'Prior handover responses'),html(s)`<ul class="journal">${prior.map(a=>response(s,a)).join('')}</ul>`):''),'','handover')
}
// Each segment's job (and its cafe after a CLOCK-008 change), minutes, pay code and retained rate.
const rateOf=(b:any)=>{const v=[...new Set((b?.segments??[]).map((x:any)=>x.cents))];return v.length&&v.every(x=>typeof x==='number')?` · ${v.map((x:any)=>`$${(x/100).toFixed(2)}`).join('–')}/hr`:''}
export function segmentTime(s:any,t:any) {
 if(!t.workSegments?.length)return ''
 const moved=t.segmentPlan?.transfers
 return html(s)`<small>${moved?tr(s,'Job segments'):tr(s,'Work areas')}</small>${t.workSegments.map((p:any)=>html(s)`<small>${h(rows(s,'jobs').find(j=>j.id===p.job)?.name??(p.job?tr(s,'Former job'):tr(s,'No job')))}${moved?(p.site?html(s)` at ${h(p.site)}`:''):` / ${h(p.area)}`}: ${h(hours(p.minutes))} hrs · regular${rateOf(p.rateBasis)}${typeof p.rateBasis?.costCents==='number'?` · $${h((p.rateBasis.costCents/100).toFixed(2))}`:p.rateBasis?tr(s,' · cost incomplete'):''}</small>`).join('')}<small>Total ${h(hours(t.workSegments.reduce((n:number,p:any)=>n+p.minutes,0)))} hrs; enclosing time ${h(hours(t.minutes))} hrs.</small>`
}
