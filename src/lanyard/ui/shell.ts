// One white top bar on every app screen: the apron mark and wordmark, the cafe picker,
// the four tabs, the week stepper, the week's publish state and the signed-in person.
import {h,avatar,owner,rows,staffOf} from './shared'
import {addDays,dateKey,day,when} from './format'
import {type Week} from './week'

export type Tab={key:string;label:string}
function sitePicker(sites:string[],site:string,path:string,q:URLSearchParams) {
 const to=(value:string)=>{const p=new URLSearchParams(q);p.set('site',value||'all');p.delete('all');p.delete('cover');return `${path}?${p}`}
 const label=site||'All cafes'
 if(sites.length<2)return sites.length?`<span class="site-pick"><span>${h(label)}</span></span>`:''
 return `<details class="site-pick menu"><summary><span>${h(label)}</span><span class="chev" aria-hidden="true"></span></summary><div class="menu-list">${[...sites,''].map(v=>`<a href="${h(to(v))}"${v===site?' aria-current="true"':''}>${h(v||'All cafes')}</a>`).join('')}</div></details>`
}
function weekStepper(w:Week,path:string,q:URLSearchParams) {
 const to=(week:string)=>{const p=new URLSearchParams(q);p.set('week',week);for(const k of ['view','day','cover'])p.delete(k);return `${path}?${p}`}
 return `<div class="week-nav"><a href="${h(to(addDays(w.week,-7)))}" aria-label="Previous week"><span class="chev left" aria-hidden="true"></span></a><span>Week of ${h(day(w.week))}</span><a href="${h(to(addDays(w.week,7)))}" aria-label="Next week"><span class="chev right" aria-hidden="true"></span></a></div>`
}
function publishState(w:Week) {
 if(w.view==='published'&&w.published)return `<p class="pub-state done">Published ${h(w.published.publishedAt?day(dateKey(w.published.publishedAt,w.tz)):day(w.week))} · ${h(w.confirmed)} of ${h(w.people)} confirmed${w.confirmed===w.people?' ✓':''}</p>`
 if(w.view==='draft'&&w.draft)return `<p class="pub-state">Draft · revision ${h(w.draft.revision)} · not published</p>`
 return '<p class="pub-state quiet">Not scheduled yet</p>'
}
function me(s:any) {
 const name=staffOf(s,s.actor.staffId)?.name??s.actor.email,links=[...(owner(s)?[['/app/import','Import staff'],['/app/agent','Agent access'],['/auth/settings/identity','Sign-in settings']]:[])]
 return `<details class="me menu"><summary aria-label="Account">${avatar(name)}</summary><div class="menu-list right"><p class="menu-head"><strong>${h(name)}</strong><span>${h(s.actor.email)} · ${h(s.actor.role)}</span></p>${links.map(([href,label])=>`<a href="${href}">${h(label)}</a>`).join('')}<button type="button" data-signout class="link">Sign out</button></div></details>`
}
export function topbar(s:any,tabs:Tab[],tab:string,w:Week,q:URLSearchParams) {
 const path=`/app/${tab==='roster'?'schedule':tab}`,dated=['schedule','time'].includes(tab)
 return `<header class="topbar"><a class="brand" href="/app"><img src="/brand/mark.svg" alt="" width="50" height="38"><span>Lanyard</span></a>${['schedule','time','people'].includes(tab)?sitePicker(w.sites,w.site,path,q):''}<nav class="tabs" aria-label="Lanyard">${tabs.map(t=>`<a href="/app/${h(t.key)}"${t.key===tab?' aria-current="page"':''}>${h(t.label)}</a>`).join('')}</nav>${dated?weekStepper(w,path,q):''}${tab==='schedule'?publishState(w):''}${me(s)}</header>`
}
/** Readable draft conflicts: who, when and why. */
export function conflictList(s:any,list:any[],tz:string,shifts:any[]) {
 return `<ul class="conflicts">${list.map(c=>{const x=shifts.find(v=>v.id===c.shiftId)??rows(s,'shifts').find(v=>v.id===c.shiftId);return `<li><strong>${h(staffOf(s,c.staffId)?.name??'Former staff')}</strong>${x?` · ${h(when(x.start,tz))}`:''} · ${h(c.reason)}</li>`}).join('')}</ul>`
}
