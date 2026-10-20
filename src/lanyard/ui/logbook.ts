// LOG-001 screens: the cafe logbook on Time for the owner and managers — entries by category with
// mentions, links, an attachment, read receipts and earlier versions; search by category and
// month; a new or corrected entry (multipart, for the attachment); an incident's text export.
import {h,rows,card,empty,person,disclosure,textarea,field,exact} from './shared'
import {entryFiles} from '../domain/logbook'
import {day} from './format'
import {sitesOf} from './week'

const LABELS:[string,string][]=[['sales','Sales notes'],['incident','Incident'],['maintenance','Maintenance'],['staffing','Staffing'],['menu','Menu outage']]
const label=(v:string)=>LABELS.find(([k])=>k===v)?.[1]??v
const logForm=(content:string,button:string)=>`<form method="post" enctype="multipart/form-data" action="/app/action?name=log.save&amp;returnTo=%2Fapp%2Ftime">${content}<button type="submit" class="secondary">${h(button)}</button></form>`
const ack=(r:any)=>`<form method="post" action="/app/action?name=log.read&amp;returnTo=%2Fapp%2Ftime">${exact(r)}<button type="submit" class="secondary small">Mark read</button></form>`
function fields(s:any,r:any={}) {
 const managers=rows(s,'staff').filter(p=>p.active&&p.role==='manager'&&(!r.site||p.site===r.site))
 const link=(key:string,label:string,list:any[],name:(x:any)=>string)=>`<label>${label} (optional)<select name="${key}"><option value="">None</option>${list.map(x=>`<option value="${h(x.id)}" ${r.links?.[key]===x.id?'selected':''}>${h(name(x))}</option>`).join('')}</select></label>`
 const links=link('staffId','Person',rows(s,'staff'),p=>p.name)+link('shiftId','Shift',rows(s,'shifts').filter(x=>x.status==='published'),x=>`${person(s,x.staffId)} · ${x.start}`)+link('timesheetId','Attendance exception',rows(s,'timesheets').filter(x=>x.exceptions?.length),x=>`${person(s,x.staffId)} · ${x.start}`)
 const where=r.id?'':`<label>Cafe<select name="site">${(sitesOf(s).length?sitesOf(s):['']).map(v=>`<option value="${h(v)}">${h(v||'Your cafe')}</option>`).join('')}</select></label>`
 return `<div class="fields">${where}${field('date','Date',r.date??'','date','required')}<label>Category<select name="category">${LABELS.map(([k,l])=>`<option value="${k}" ${k===r.category?'selected':''}>${h(l)}</option>`).join('')}</select></label><label>Mention (optional)<select name="mentions" multiple>${managers.map(p=>`<option value="${h(p.id)}" ${(r.mentions??[]).includes(p.id)?'selected':''}>${h(p.name)}</option>`).join('')}</select></label><label>Attachments (up to 5, 10 MB each)<input type="file" name="attachments" multiple></label>${links}</div>${textarea('text','Entry',r.text??'','required maxlength="4000" rows="3"')}`
}
function entry(s:any,r:any) {
 const me=s.actor.id,read=r.reads.some((x:any)=>x.by===me&&x.revision===(r.contentRevision??r.revision))
 const file=entryFiles(r).map(f=>` · <a class="text-link" href="/api/lanyard/logbook/${h(r.id)}/files/${h(f.id)}">${h(f.name)}</a>`).join('')
 const links=[r.links.staffId?`about ${h(person(s,r.links.staffId))}`:'',r.links.shiftId?'linked shift':'',r.links.timesheetId?'attendance exception':''].filter(Boolean).join(' · ')
 const mentioned=r.mentions.includes(s.actor.staffId)?' · <strong>mentions you</strong>':r.mentions.length?` · mentions ${r.mentions.map((m:string)=>h(person(s,m))).join(', ')}`:''
 const receipts=r.reads.length?`<p class="note">Read by ${r.reads.map((x:any)=>`${h(person(s,x.staffId))} (revision ${h(x.revision)})`).join(', ')}</p>`:''
 const history=r.versions.length?disclosure(`${r.versions.length} earlier version${r.versions.length===1?'':'s'}`,`<ul>${r.versions.map((v:any)=>`<li>${h(v.byName)} · ${h(v.text)}${entryFiles(v).map(f=>` · <a href="/api/lanyard/logbook/${h(r.id)}/files/${h(f.id)}">${h(f.name)}</a>`).join('')}</li>`).join('')}</ul>`,false,'inline-menu'):''
 return `<li><strong>${h(day(r.date))} · ${h(r.site||'Your cafe')} · ${h(label(r.category))}</strong> · ${h(r.byName)}${mentioned}${links?` · ${links}`:''}${file}<p>${h(r.text)}</p>${receipts}${r.author!==me&&!read?ack(r):''}${r.category==='incident'?`<a class="text-link" href="/api/lanyard/logbook/${h(r.id)}/export">Export incident</a>`:''}${history}${disclosure('Correct',logForm(exact(r)+fields(s,r),'Save correction'),false,'inline-menu')}</li>`
}
export function logbookCard(s:any,q:URLSearchParams) {
 const cat=q.get('logcat')??'',month=q.get('logmonth')??''
 const list=rows(s,'logbook').filter(r=>(!cat||r.category===cat)&&(!month||r.date.startsWith(month))).sort((a,b)=>b.date.localeCompare(a.date)||b.at.localeCompare(a.at))
 const search=`<form class="filter" method="get" action="/app/time" role="search"><label>Category<select name="logcat"><option value="">All</option>${LABELS.map(([k,l])=>`<option value="${k}" ${k===cat?'selected':''}>${h(l)}</option>`).join('')}</select></label><label>Month<input type="month" name="logmonth" value="${h(month)}"></label><button type="submit" class="secondary small">Search</button></form>`
 return card('Logbook',`${search}${list.length?`<ul class="swap-list">${list.map(r=>entry(s,r)).join('')}</ul>`:empty('No logbook entries match.')}${disclosure('Write an entry',logForm(fields(s),'Save entry'))}`,'','logbook')
}
