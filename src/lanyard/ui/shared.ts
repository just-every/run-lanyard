import {emptyIcon} from './icons'
const escapes:Record<string,string> = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}
export const h = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => escapes[c])
export const manager = (s:any) => ['owner','manager'].includes(s.actor.role)
export const owner = (s:any) => s.actor.role === 'owner'
export const self = (s:any) => Boolean(s.actor.staffId) && ['staff','manager'].includes(s.actor.role)
export const rows = (s:any,key:string):any[] => Array.isArray(s[key]) ? s[key] : []
export const person = (s:any,id:string) => rows(s,'staff').find(p=>p.id===id)?.name ?? id
export const stamp = (v:any) => v ? h(String(v).replace('T',' ').replace(/\.\d{3}Z$/,' UTC').replace(/Z$/,' UTC')) : '—'
export const status = (v:any) => `<span class="status ${['published','approved','exported','acknowledged','Active'].includes(v)?'positive':'neutral'}">${h(v)}</span>`
export const hidden = (name:string,value:any) => `<input type="hidden" name="${h(name)}" value="${h(value)}">`
export const field = (name:string,label:string,value:any='',type='text',extra='') => `<label>${h(label)}<input name="${h(name)}" type="${h(type)}" value="${h(value)}" ${extra}></label>`
// The browser presents venue wall time and serializes the corresponding UTC instant.
export const utc = (name:string,label:string,value:any='') => field(name,`${label} (venue time)`,'','datetime-local',`required step="1" data-utc="${h(value)}"`)
export const venue = (s:any):string => s.settings?.timezone ?? 'Australia/Brisbane'
export const moment = (v:any) => v ? `<time datetime="${h(v)}">${stamp(v)}</time>` : '—'
export const textarea = (name:string,label:string,value:any='',extra='') => `<label>${h(label)}<textarea name="${h(name)}" ${extra}>${h(value)}</textarea></label>`
export const form = (command:string,tab:string,content:string,button:string,extra='') => `<form method="post" action="/app/action?name=${encodeURIComponent(command)}&amp;returnTo=/app/${h(tab)}" ${extra}>${content}<button type="submit">${h(button)}</button></form>`
export const exact = (row:any) => hidden('id',row.id)+hidden('revision',row.revision)
export const staffSelect = (s:any,value='',name='staffId') => `<label>Person<select name="${h(name)}" required><option value="">Choose a person</option>${rows(s,'staff').filter(p=>p.active).map(p=>`<option value="${h(p.id)}" ${p.id===value?'selected':''}>${h(p.name)}</option>`).join('')}</select></label>`
export const empty = (text:string,icon:'calendar'|'document'='document') => `<div class="empty">${emptyIcon(icon)}<p>${h(text)}</p></div>`
export const disclosure = (title:string,content:string,open=false) => `<details ${open?'open':''}><summary>${h(title)}</summary><div class="detail-content">${content}</div></details>`
const panelClass = (title:string) => 'panel panel-'+title.toLowerCase().replace(/[^a-z0-9]+/g,'-')
export const panel = (title:string,body:string) => `<section class="${panelClass(title)}"><h2>${h(title)}</h2>${body}</section>`
export const collapsiblePanel = (title:string,body:string,open=false) => `<details class="${panelClass(title)}" ${open?'open':''}><summary><h2>${h(title)}</h2></summary><div class="detail-content">${body}</div></details>`
export const range = (r:any) => `<p class="range">${moment(r.start)}<br>to ${moment(r.end)}</p>`
export const outcome = (extras:any) => extras.result?.result ?? extras.result
