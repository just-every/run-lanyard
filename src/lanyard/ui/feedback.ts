// FEEDBACK-001 screens: the employee's after-shift question and their answers with replies (on
// Time), the managers' feedback list by cafe, shift and manager with the week's trend (on Time),
// and the owner's anonymous-feedback switch (on People).
import {h,rows,form,hidden,card,empty,person,status,textarea,disclosure} from './shared'
import {addDays,dateKey,day,span} from './format'
import {type Week} from './week'

const FLAGS:[string,string][]=[['understaffed','Understaffed'],['equipment','Equipment'],['safety','Safety'],['conflict','Conflict']]
const flagText=(list:string[])=>list.map(f=>FLAGS.find(([k])=>k===f)?.[1]??f).join(', ')
const anonymousOn=(s:any)=>rows(s,'feedbackopts')[0]?.anonymous===true
const avg=(list:any[])=>{const r=list.filter(f=>typeof f.rating==='number');return r.length?(r.reduce((n,f)=>n+f.rating,0)/r.length).toFixed(1):null}

/** The newest clocked shift the employee has not answered yet, and their answers so far. */
export function myFeedbackCard(s:any,tz:string,back:string) {
 const mine=rows(s,'feedback').filter(f=>f.staffId===s.actor.staffId),answered=new Set(mine.map(f=>f.clockId))
 const next=rows(s,'timesheets').filter(t=>t.staffId===s.actor.staffId&&t.clockId&&!answered.has(t.clockId)).sort((a,b)=>b.start.localeCompare(a.start))[0]
 const ask=next?`<p class="note">How was your shift ${h(day(dateKey(next.start,tz)))}, ${h(span(next.start,next.end,tz))}? Your answer never affects pay, approval or scheduling.</p>${form('feedback.submit',back,`${hidden('timesheetId',next.id)}<label>Rating<select name="rating"><option value="">No rating</option>${[5,4,3,2,1].map(n=>`<option value="${n}">${n} of 5</option>`).join('')}</select></label><fieldset><legend>Flag an issue</legend>${FLAGS.map(([k,l])=>`<label class="check"><input type="checkbox" name="flags" value="${k}"> ${h(l)}</label>`).join('')}</fieldset>${textarea('comment','Comment (optional)','','maxlength="1000"')}${anonymousOn(s)?'<label class="check"><input type="checkbox" name="anonymous" value="true"> Hide my name from managers and the owner</label>':''}`,'Send feedback','','primary')}${form('feedback.submit',back,hidden('timesheetId',next.id)+hidden('skip','true'),'Skip','','secondary')}`:''
 const list=mine.filter(f=>!f.skipped).map(f=>`<li><strong>${h(f.date)}</strong> · ${f.rating?`${h(f.rating)} of 5`:'No rating'}${f.flags?.length?` · ${h(flagText(f.flags))}`:''}${f.anonymous?' · anonymous':''} · ${status(f.status)}${f.comment?`<p>${h(f.comment)}</p>`:''}${f.reply?`<p class="note">Reply: ${h(f.reply)}</p>`:''}</li>`).join('')
 if(!ask&&!list)return ''
 return card('Shift feedback',`${ask}${list?`<ul class="feedback-list">${list}</ul>`:''}`,'','my-feedback')
}

/** The cafe's feedback for the shown week, filtered by manager, with the trend against last week. */
export function feedbackCard(s:any,w:Week,q:URLSearchParams,back:string,tz:string) {
 const all=rows(s,'feedback').filter(f=>!f.skipped&&(!w.site||f.site===w.site)),who=q.get('manager')??''
 const week=all.filter(f=>w.days.includes(f.date)&&(!who||f.managerName===who)),before=all.filter(f=>f.date>=addDays(w.week,-7)&&f.date<w.week&&(!who||f.managerName===who))
 if(!week.length&&!before.length)return ''
 const managers=[...new Set(all.map(f=>f.managerName).filter(Boolean))] as string[]
 const pick=managers.length?`<form class="filter" method="get" action="/app/time">${hidden('week',w.week)}${hidden('site',w.site||'all')}<label>Manager<select name="manager"><option value="">All managers</option>${managers.map(m=>`<option value="${h(m)}" ${m===who?'selected':''}>${h(m)}</option>`).join('')}</select></label><button type="submit" class="secondary small">Show</button></form>`:''
 const now=avg(week),then=avg(before),flags=FLAGS.map(([k,l])=>[l,week.filter(f=>f.flags?.includes(k)).length] as const).filter(([,n])=>n)
 const trend=`<p class="feedback-trend">Average rating <strong>${now??'—'}</strong> this week (last week ${then??'—'})${now&&then?` · ${Number(now)>Number(then)?'up':Number(now)<Number(then)?'down':'steady'}`:''} · ${h(week.length)} response${week.length===1?'':'s'}${flags.length?` · ${flags.map(([l,n])=>`${h(l)} ${n}`).join(' · ')}`:''}</p>`
 const shiftOf=(f:any)=>f.shiftId?rows(s,'shifts').find(x=>x.id===f.shiftId):undefined
 const line=(f:any)=>{const x=shiftOf(f);return `<tr><td data-label="Cafe">${h(f.site||'Your cafe')}</td><td data-label="Shift">${h(day(f.date))}${x?` · ${h(span(x.start,x.end,tz))}`:''}</td><td data-label="Manager">${h(f.managerName??'—')}</td><td data-label="From">${f.anonymous?'Anonymous':h(person(s,f.staffId))}</td><td data-label="Feedback">${f.rating?`${h(f.rating)} of 5`:'No rating'}${f.flags?.length?`<small>Flagged: ${h(flagText(f.flags))}</small>`:''}${f.comment?`<small>${h(f.comment)}</small>`:''}${f.reply?`<small>Reply: ${h(f.reply)}</small>`:''}</td><td data-label="Status">${status(f.status)}</td><td>${f.status==='open'?disclosure('Reply',form('feedback.reply',back,`${hidden('id',f.id)}${hidden('revision',f.revision)}${textarea('reply','Reply the employee sees','','maxlength="1000"')}<label class="check"><input type="checkbox" name="resolve" value="true" checked> Mark resolved</label>`,'Send reply','','secondary'),false,'inline-menu'):''}</td></tr>`}
 const table=week.length?`<table class="list stack"><thead><tr><th>Cafe</th><th>Shift</th><th>Manager</th><th>From</th><th>Feedback</th><th>Status</th><th><span class="sr-only">Reply</span></th></tr></thead><tbody>${week.map(line).join('')}</tbody></table>`:empty('No feedback this week.')
 return card('Shift feedback',`${trend}${pick}${table}`,'','feedback')
}

export function feedbackSettingsCard(s:any) {
 const r=rows(s,'feedbackopts')[0]
 return card('Anonymous feedback',`<p class="note">When on, employees may hide their name on after-shift feedback, safety flags included. Managers and you then see the cafe, date and what was said, never who said it.</p>${form('feedback.settings','people',`${r?hidden('revision',r.revision):''}<label class="check"><input type="checkbox" name="anonymous" value="true" ${anonymousOn(s)?'checked':''}> Allow anonymous feedback</label>`,'Save','','secondary')}`,'','feedback-settings')
}
