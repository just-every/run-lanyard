// ROSTER-004 screens: the staff "Who's working" card under their week, and the
// manager's per-cafe choice of what that card shows (whole cafe or own position, hidden people).
import {h,rows,form,hidden,card,empty} from './shared'
import {type Week,sitesOf} from './week'
import {dateKey,day,span} from './format'

export function whoIsWorking(s:any,w:Week) {
 const t=s.team;if(!t)return ''
 const list=rows(t,'shifts').filter((x:any)=>w.days.includes(dateKey(x.start,w.tz)))
 const table=list.length?`<table class="list"><thead><tr><th>Day</th><th>Person</th><th>Position</th><th>Shift</th></tr></thead><tbody>${list.map((x:any)=>`<tr><td>${h(day(dateKey(x.start,w.tz)))}</td><td>${h(x.name)}</td><td>${h(x.position??'—')}</td><td>${h(span(x.start,x.end,w.tz))}</td></tr>`).join('')}</tbody></table>`:empty('No published shifts at your cafe this week yet.','calendar')
 return card('Who’s working',table,`<p class="card-note">${t.scope==='position'?'Your position':'Your whole cafe'} · published shifts</p>`,'team-view')
}

function siteForm(s:any,site:string) {
 const rule=rows(s,'teamviews').find(v=>v.site===site),scope=rule?.scope??'site',hiddenIds:string[]=rule?.hidden??[]
 const people=rows(s,'staff').filter(p=>!p.erasedAt&&((p.active&&(p.site??'')===site)||hiddenIds.includes(p.id)))
 const option=(value:string,label:string)=>`<option value="${value}" ${scope===value?'selected':''}>${h(label)}</option>`
 const hide=people.length?`<p class="note">Hide for safety: hidden people never appear in any staff team view, at any cafe.</p>${people.map(p=>`<label class="check"><input type="checkbox" name="hidden" value="${h(p.id)}" ${hiddenIds.includes(p.id)?'checked':''}> Hide ${h(p.name)}</label>`).join('')}`:''
 const back=`/app/people?site=${encodeURIComponent(site||'all')}`
 return form('team.visibility',back,`${hidden('site',site)}${rule?hidden('revision',rule.revision):''}<label>Staff at ${h(site||'your cafe')} see<select name="scope">${option('site','Everyone published at this cafe')}${option('position','Only people in their own position')}</select></label>${hide}`,'Save team view','','secondary')
}
/** The People card where a manager sets each cafe's staff team view. */
export function teamViewCard(s:any,site:string) {
 const sites=site?[site]:sitesOf(s).length?sitesOf(s):['']
 return card('Staff team view',`<p class="note">Staff see coworkers’ published shifts at their home cafe: name, position and times only, never drafts, pay, contact details or other cafes.</p>${sites.map(v=>siteForm(s,v)).join('')}`,'','team-view')
}
