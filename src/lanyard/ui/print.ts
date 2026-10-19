// SCHEDULE-005 screens: the manager's print card (PDF by cafe, position or person, with
// each printed copy current or superseded) and the read-only wall display for a cafe.
import {h,rows,form,hidden,card,empty,outcome,venue,titleRow} from './shared'
import {type Week} from './week'
import {dateKey,day,span,stamp} from './format'
import {postingState,rowsOf,weekRevision} from '../domain/postings'

const options=(values:[string,string][],current='')=>values.map(([v,l])=>`<option value="${h(v)}" ${v===current?'selected':''}>${h(l)}</option>`).join('')
const scopeOf=(s:any,f:any)=>[f.site||'All cafes',f.position,f.staffId&&rows(s,'staff').find(p=>p.id===f.staffId)?.name].filter(Boolean).join(' · ')

export function printCard(s:any,w:Week,back:string,extras:any) {
 if(!w.published)return ''
 const tz=venue(s),staff=rows(s,'staff').filter(p=>p.active),positions=[...new Set(staff.map(p=>p.position).filter(Boolean))].sort() as string[]
 const made=outcome(extras),fresh=made?.rows&&made?.rosterId?`<div class="banner" role="status"><p>Printed revision ${h(made.rosterRevision)} · <a class="text-link" href="/api/lanyard/postings/${h(made.id)}.pdf">Download the PDF</a></p></div>`:''
 const print=form('schedule.post',back,`${hidden('week',w.week)}<div class="fields"><label>Cafe<select name="site">${options([['','All cafes'],...w.sites.map(v=>[v,v] as [string,string])],w.site)}</select></label><label>Position<select name="position">${options([['','Every position'],...positions.map(v=>[v,v] as [string,string])])}</select></label><label>Person<select name="staffId">${options([['','Everyone'],...staff.map(p=>[p.id,p.name] as [string,string])])}</select></label></div><p class="note">Prints names, positions and shift times of the published week, never pay, notes or time-off reasons. Each copy is recorded and marked superseded when the week changes.</p>`,'Print PDF','','secondary')
 const list=rows(s,'postings').filter(p=>p.week===w.week).sort((a,b)=>b.postedAt.localeCompare(a.postedAt))
 const state=(p:any)=>{const v=postingState(rows(s,'staff'),rows(s,'shifts'),rows(s,'rosters'),p);return v.current?'<span class="status positive">Current</span>':`<span class="status negative">Superseded${v.supersededAt?` ${h(stamp(v.supersededAt,tz,false))}`:''}</span>`}
 const table=list.length?`<table class="list"><thead><tr><th>Printed</th><th>Copy</th><th>Revision</th><th>Status</th><th><span class="sr-only">Download</span></th></tr></thead><tbody>${list.map(p=>`<tr><td>${h(stamp(p.postedAt,tz,false))}</td><td>${h(scopeOf(s,p.filter))}</td><td>${h(p.rosterRevision)} · published ${h(stamp(p.publishedAt,tz,false))}</td><td>${state(p)}</td><td><a class="text-link" href="/api/lanyard/postings/${h(p.id)}.pdf">PDF</a></td></tr>`).join('')}</tbody></table>`:empty('No printed copies of this week yet.','document')
 const wall=`/app/wall?site=${encodeURIComponent(w.site||'all')}`
 return card('Print and post',`${fresh}${print}${table}`,`<a class="text-link" href="${h(wall)}">Open the wall display</a>`,'print')
}
/** The wall display: this week's published schedule for one cafe, read-only, reloading every minute. */
export function wallPage(s:any,w:Week,now:number) {
 const tz=venue(s),r=w.published
 if(!r)return `${titleRow(`${w.site||'All cafes'} · week of ${day(w.week)}`,s,now)}${empty('This week is not published yet.','calendar')}`
 const list=rowsOf(rows(s,'staff'),rows(s,'shifts'),r.id,{site:w.site,position:'',staffId:''})
 const days=w.days.map(d=>({d,list:list.filter(x=>dateKey(x.start,tz)===d)})).filter(v=>v.list.length)
 const table=days.length?`<table class="list banded"><thead><tr><th>Person</th><th>Position</th><th>Shift</th></tr></thead>${days.map(v=>`<tbody><tr class="band"><th colspan="3">${h(day(v.d))}</th></tr>${v.list.map(x=>`<tr><td>${h(x.name)}</td><td>${h(x.position||'—')}</td><td>${h(span(x.start,x.end,tz))}</td></tr>`).join('')}</tbody>`).join('')}</table>`:empty('No shifts at this cafe this week.','calendar')
 return `${titleRow(`${w.site||'All cafes'} · week of ${day(w.week)}`,s,now)}<p class="note" data-wall-revision="${h(weekRevision(rows(s,'rosters'),r))}">Published revision ${h(weekRevision(rows(s,'rosters'),r))}, ${h(stamp(r.publishedAt,tz))} · updates every minute</p>${card('Schedule',table)}`
}
