// TIME-008 on the Time screen: filter the waiting timesheets by cafe, position, period and
// state, approve the shown list in one action (each pinned to its revision) and read the result.
import {h,rows,form,hidden,field,staffOf,person,venue,outcome,disclosure} from './shared'
import {dateKey,day} from './format'
import {STATES,statesOf} from '../domain/approvals'

const label=(v:string)=>v.charAt(0).toUpperCase()+v.slice(1)
export function filterOf(q:URLSearchParams) {
 return {site:q.get('cafe')??'',position:q.get('position')??'',from:q.get('from')??'',to:q.get('to')??'',state:q.get('state')??''}
}
/** The same filter the command re-checks: home cafe, People position, inclusive venue dates, review state. */
export function shown(s:any,waiting:any[],f:ReturnType<typeof filterOf>) {
 const tz=venue(s),p=(r:any)=>staffOf(s,r.staffId)
 return waiting.filter(r=>(!f.site||(p(r)?.site??'')===f.site)&&(!f.position||(p(r)?.position??'')===f.position)&&(!f.from||dateKey(r.start,tz)>=f.from)&&(!f.to||dateKey(r.start,tz)<=f.to)&&(!f.state||statesOf(r).includes(f.state)))
}
function select(name:string,title:string,values:string[],current:string,any:string) {
 return `<label>${h(title)}<select name="${h(name)}"><option value="">${h(any)}</option>${values.map(v=>`<option value="${h(v)}" ${v===current?'selected':''}>${h(label(v))}</option>`).join('')}</select></label>`
}
export function bulkControls(s:any,list:any[],f:ReturnType<typeof filterOf>,q:URLSearchParams,back:string) {
 const staff=rows(s,'staff'),sites=[...new Set(staff.map(p=>p.site).filter(Boolean))].sort() as string[],positions=[...new Set(staff.map(p=>p.position).filter(Boolean))].sort() as string[]
 const keep=['week','site'].filter(k=>q.has(k)).map(k=>hidden(k,q.get(k))).join('')
 const filter=`<form class="filter" method="get" action="/app/time">${keep}<div class="fields">${select('cafe','Cafe',sites,f.site,'All cafes')}${select('position','Position',positions,f.position,'All positions')}${field('from','From',f.from,'date')}${field('to','To',f.to,'date')}${select('state','State',[...STATES],f.state,'Any state')}</div><button type="submit" class="secondary small">Filter</button></form>`
 const pins=JSON.stringify(list.map(r=>({id:r.id,revision:r.revision})))
 const bulk=list.length?form('time.approveMany',back,`${hidden('site',f.site)}${hidden('position',f.position)}${hidden('from',f.from)}${hidden('to',f.to)}${hidden('state',f.state)}${hidden('items',pins)}<p class="note">Approves exactly the revisions listed below. Anything changed since, flagged with an exception or your own is skipped and named.</p>`,`Approve ${list.length} shown`,'','primary'):''
 return disclosure('Filter and approve many',filter+bulk,Object.values(f).some(Boolean))
}
/** What the last bulk approval did: how many were approved and each skip with its reason. */
export function bulkResult(s:any,extras:any) {
 const r=outcome(extras);if(!Array.isArray(r?.approved)||!Array.isArray(r?.skipped))return ''
 const tz=venue(s),when=(id:string)=>{const t=rows(s,'timesheets').find(v=>v.id===id);return t?` · ${h(day(dateKey(t.start,tz)))}`:''}
 return `<div class="banner${r.skipped.length?' warn':''}" role="status"><div><p>Approved ${h(r.approved.length)} · skipped ${h(r.skipped.length)}</p>${r.skipped.length?`<ul class="conflicts">${r.skipped.map((x:any)=>`<li><strong>${h(x.staffId?person(s,x.staffId):'Timesheet')}</strong>${when(x.id)} · ${h(x.reason)}</li>`).join('')}</ul>`:''}</div></div>`
}
