import {html,t} from '../localization'
// One white top bar on every app screen: the apron mark and wordmark, the cafe picker,
// the four tabs, the week stepper, the week's publish state and the signed-in person.
import {h,avatar,owner,manager,rows,staffOf} from './shared'
import {addDays,dateKey,day,when} from './format'
import {type Week} from './week'

export type Tab={key:string;label:string}
function sitePicker(s:any,sites:string[],site:string,path:string,q:URLSearchParams) {
 const to=(value:string)=>{const p=new URLSearchParams(q);p.set('site',value||'all');p.delete('all');p.delete('cover');return `${path}?${p}`}
 const label=site||t(s,'All cafes')
 if(sites.length<2)return sites.length?html(s)`<span class="site-pick"><span>${h(label)}</span></span>`:''
 return html(s)`<details class="site-pick menu"><summary><span>${h(label)}</span><span class="chev" aria-hidden="true"></span></summary><div class="menu-list">${[...sites,''].map(v=>html(s)`<a href="${h(to(v))}"${v===site?' aria-current="true"':''}>${h(v||t(s,'All cafes'))}</a>`).join('')}</div></details>`
}
function weekStepper(s:any,w:Week,path:string,q:URLSearchParams) {
 const to=(week:string)=>{const p=new URLSearchParams(q);p.set('week',week);for(const k of ['view','day','cover'])p.delete(k);return `${path}?${p}`}
 return html(s)`<div class="week-nav"><a href="${h(to(addDays(w.week,-7)))}" aria-label="Previous week" data-tooltip="Previous week"><span class="chev left" aria-hidden="true"></span></a><span>Week of ${h(day(w.week))}</span><a href="${h(to(addDays(w.week,7)))}" aria-label="Next week" data-tooltip="Next week"><span class="chev right" aria-hidden="true"></span></a></div>`
}
function publishState(s:any,w:Week) {
 if(w.view==='published'&&w.published)return html(s)`<p class="pub-state done">Published ${h(w.published.publishedAt?day(dateKey(w.published.publishedAt,w.tz)):day(w.week))} · ${h(w.confirmed)} of ${h(w.people)} confirmed${w.confirmed===w.people?' ✓':''}</p>`
 if(w.view==='draft'&&w.draft)return html(s)`<p class="pub-state">Draft · revision ${h(w.draft.revision)} · not published</p>`
 return html(s)`<p class="pub-state quiet">Not scheduled yet</p>`
}
function me(s:any) {
 const name=staffOf(s,s.actor.staffId)?.name??(s.actor.name||String(s.actor.email).split('@')[0].split(/[._-]+/).map((w:string)=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ')),links=[...(manager(s)?[['/app/reports',t(s,'Operational reports')]]:[]),...(s.actor.staffId&&!owner(s)?[['/app/settings',t(s,'Settings')]]:[]),...(owner(s)?[['/app/settings',t(s,'Settings')],['/app/import',t(s,'Import staff')],['/app/agent',t(s,'Agent access')],['/auth/settings/identity',t(s,'Sign-in settings')]]:[])]
 return html(s)`<details class="me menu"><summary aria-label="Account" data-tooltip="Account menu">${avatar(name)}</summary><div class="menu-list right"><p class="menu-head"><strong>${h(name)}</strong><span>${h(s.actor.email)} · ${h(s.actor.role)}</span></p>${links.map(([href,label])=>html(s)`<a href="${href}">${h(label)}</a>`).join('')}<button type="button" data-signout class="link">Sign out</button></div></details>`
}
export function topbar(s:any,tabs:Tab[],tab:string,w:Week,q:URLSearchParams) {
 const path=`/app/${tab==='roster'?'schedule':tab}`,dated=['schedule','time'].includes(tab)
 return html(s)`<header class="topbar"><a class="brand" href="${s.auditOnly?h(path+'?'+q):'/app'}"><img src="/brand/mark.svg" alt="" width="50" height="38"><span>Lanyard</span></a>${['schedule','time','people'].includes(tab)?sitePicker(s,w.sites,w.site,path,q):''}<nav class="tabs" aria-label="Lanyard">${tabs.map(tabItem=>html(s)`<a href="/app/${h(tabItem.key)}${s.auditOnly?'?'+h(q.toString()):''}"${tabItem.key===tab?' aria-current="page"':''}>${h(t(s,tabItem.label))}</a>`).join('')}</nav>${dated?weekStepper(s,w,path,q):''}${tab==='schedule'?publishState(s,w):''}${me(s)}</header>`
}
/** Readable draft conflicts: who, when and why. */
export function conflictList(s:any,list:any[],tz:string,shifts:any[]) {
 return html(s)`<ul class="conflicts">${list.map(c=>{const x=shifts.find(v=>v.id===c.shiftId)??rows(s,'shifts').find(v=>v.id===c.shiftId);return html(s)`<li><strong>${h(staffOf(s,c.staffId)?.name??t(s,'Former staff'))}</strong>${x?` · ${h(when(x.start,tz))}`:''} · ${h(c.reason)}</li>`}).join('')}</ul>`
}
