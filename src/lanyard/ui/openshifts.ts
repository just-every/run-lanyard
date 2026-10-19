// COVER-002 on the schedule: staff see the open shifts they may pick up (cafe, position, times
// and their own rate) and their requests; managers post open shifts, choose approved pickup or
// manager approval and an optional pool, and approve one request.
import {h,rows,form,field,hidden,utc,exact,card,disclosure,manager,person,status,staffOf} from './shared'
import {dateKey,day,hours,money,span} from './format'
import {sitesOf} from './week'

const when=(o:any,tz:string)=>`${day(dateKey(o.start,tz))} · ${span(o.start,o.end,tz)}`
const where=(o:any)=>[o.site,o.position,o.label].filter(Boolean).map(h).join(' · ')
function postForm(s:any,back:string) {
 const team=rows(s,'staff').filter(p=>p.active)
 return disclosure('Post an open shift',form('openshift.post',back,`<div class="fields"><label>Cafe<select name="site">${(sitesOf(s).length?sitesOf(s):['']).map(v=>`<option value="${h(v)}">${h(v||'Your cafe')}</option>`).join('')}</select></label>${field('position','Position (blank for anyone at the cafe)','','text','maxlength="80" list="positions"')}${utc('start','Starts')}${utc('end','Ends')}${field('breakMinutes','Meal minutes',0,'number','required min="0" max="1440"')}${field('label','Label (optional)','','text','maxlength="120"')}<label>Pickup<select name="approval"><option value="manager">A manager approves one request</option><option value="auto">First eligible request is approved</option></select></label><label>Offer only to (optional)<select name="pool" multiple>${team.map(p=>`<option value="${h(p.id)}">${h(p.name)}</option>`).join('')}</select></label></div>`,'Post open shift','','secondary'))
}
export function openShiftCards(s:any,tz:string,back:string) {
 const list=rows(s,'openshifts'),asks=rows(s,'pickups')
 if(manager(s)) {
  const open=list.filter(o=>o.status==='open')
  const items=open.map(o=>{const waiting=asks.filter(x=>x.openShiftId===o.id&&x.status==='requested')
   return `<li><strong>${h(when(o,tz))}</strong> · ${where(o)||'Any position'} · ${o.approval==='auto'?'approved on pickup':'manager approves'}${o.pool?` · ${h(o.pool.length)} in pool`:''}${waiting.map(x=>`<div class="request">${h(person(s,x.staffId))} · ${h(hours(x.after))} hrs that week${x.overtime?' · overtime':''}${form('openshift.approve',back,exact(x),`Approve ${person(s,x.staffId).split(/\s+/)[0]}`,'','primary small')}</div>`).join('')}</li>`}).join('')
  return card('Open shifts',`${items?`<ul class="swap-list">${items}</ul>`:'<p class="note">No open shifts are posted.</p>'}${postForm(s,back)}`,'','open-shifts')
 }
 const mine=new Map(asks.map(x=>[x.openShiftId,x]))
 const items=list.map(o=>{const x=mine.get(o.id);return `<li><strong>${h(when(o,tz))}</strong> · ${where(o)}${typeof o.hourlyRateCents==='number'?` · ${h(money(o.hourlyRateCents))}/hr`:''}${x?` · ${status(x.status==='requested'?'requested':x.status)}`:form('openshift.request',back,exact(o),o.approval==='auto'?'Pick up':'Request','','primary small')}</li>`}).join('')
 const done=asks.filter(x=>x.status!=='requested'&&!list.some(o=>o.id===x.openShiftId)).map(x=>`<li>Request ${status(x.status)}</li>`).join('')
 return items||done?card('Open shifts',`<ul class="swap-list">${items}${done}</ul>`,'','open-shifts'):''
}
