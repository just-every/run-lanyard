import {t,languageOf} from '../localization'
import {emptyIcon} from './icons'
import {initials,stamp} from './format'
const escapes:Record<string,string> = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}
export const h = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => escapes[c])
export const manager = (s:any) => ['owner','manager'].includes(s.actor.role)
export const owner = (s:any) => s.actor.role === 'owner'
export const self = (s:any) => Boolean(s.actor.staffId) && ['staff','manager'].includes(s.actor.role)
export const rows = (s:any,key:string):any[] => Array.isArray(s[key]) ? s[key] : []
export const staffOf = (s:any,id:string) => rows(s,'staff').find(p=>p.id===id)
export const person = (s:any,id:string) => staffOf(s,id)?.name ?? 'Former staff'
export const venue = (s:any):string => s.settings?.timezone ?? 'America/Los_Angeles'
export const status = (v:any,label=v) => `<span class="status ${['published','approved','exported','acknowledged','Active','accepted'].includes(v)?'positive':['rejected','declined'].includes(v)?'negative':'neutral'}">${h(label)}</span>`
export const hidden = (name:string,value:any) => `<input type="hidden" name="${h(name)}" value="${h(value)}">`
export const field = (name:string,label:string,value:any='',type='text',extra='') => `<label>${h(label)}<input name="${h(name)}" type="${h(type)}" value="${h(value)}" ${extra}></label>`
// The browser presents venue wall time and serializes the corresponding UTC instant.
export const utc = (name:string,label:string,value:any='') => field(name,label,'','datetime-local',`required step="60" data-utc="${h(value)}"`)
export const moment = (v:any,tz:string,s?:any) => v ? `<time datetime="${h(v)}">${h(s&&languageOf(s)==='es'?new Intl.DateTimeFormat('es-US',{timeZone:tz,dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):stamp(v,tz,false))}</time>` : '—'
export const textarea = (name:string,label:string,value:any='',extra='') => `<label>${h(label)}<textarea name="${h(name)}" ${extra}>${h(value)}</textarea></label>`
/** A command form that posts back to the screen it came from (with its query, so the week and cafe stay put). */
export const form = (command:string,back:string,content:string,button:string,extra='',buttonClass='') => `<form method="post" action="/app/action?name=${encodeURIComponent(command)}&amp;returnTo=${encodeURIComponent(back.startsWith('/')?back:'/app/'+back)}" ${extra}>${content}<button type="submit"${buttonClass?` class="${h(buttonClass)}"`:''}>${h(button)}</button></form>`
export const exact = (row:any) => hidden('id',row.id)+hidden('revision',row.revision)
export const staffSelect = (s:any,value='',name='staffId',label='Person') => `<label>${h(label)}<select name="${h(name)}" required><option value="">Choose a person</option>${rows(s,'staff').filter(p=>p.active).map(p=>`<option value="${h(p.id)}" ${p.id===value?'selected':''}>${h(p.name)}</option>`).join('')}</select></label>`
export const empty = (text:string,icon:'calendar'|'document'='document',action='') => `<div class="empty">${emptyIcon(icon)}<p>${h(text)}</p>${action}</div>`
export const disclosure = (title:string,content:string,open=false,cls='') => `<details${cls?` class="${h(cls)}"`:''} ${open?'open':''}><summary>${h(title)}</summary><div class="detail-content">${content}</div></details>`
/** A white section card with a quiet sans heading (the screen title is the only serif). */
export const card = (title:string,body:string,aside='',id='') => `<section class="card"${id?` id="${h(id)}"`:''}><div class="card-head"><h2>${h(title)}</h2>${aside}</div>${body}</section>`
export const avatar = (name:string,cls='') => `<span class="avatar${cls?' '+h(cls):''}" aria-hidden="true">${h(initials(name))}</span>`
export const outcome = (extras:any) => extras.result?.result ?? extras.result
/** Screen title row: the claret serif title and the venue's current time. */
export const titleRow = (title:string,s:any,now:number) => `<div class="title-row"><h1>${h(title)}</h1><p class="now">${h(languageOf(s)==='es'?new Intl.DateTimeFormat('es-US',{timeZone:venue(s),dateStyle:'full',timeStyle:'short'}).format(new Date(now)):stamp(now,venue(s)))}</p></div>`

export const staffStatus=(s:any,value:any,label=value)=>status(value,t(s,label))
