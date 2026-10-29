import {localDay,localWeekday,html,t as tr} from '../localization'
// COVER-002 on the schedule: staff see the open shifts they may pick up (cafe, position, times
// and their own rate) and their requests; managers post open shifts, choose approved pickup or
// manager approval and an optional pool, and approve one request.
import {h,rows,form,field,hidden,utc,exact,card,disclosure,manager,person,staffStatus,staffOf} from './shared'
import {dateKey,day,hours,money,span} from './format'
import {sitesOf} from './week'
import {costNote} from './overtime'
import {orderFields,orderLabel,offerLog,accessLine} from './offerorder'

const when=(s:any,o:any,tz:string)=>`${localDay(s,dateKey(o.start,tz))} · ${span(o.start,o.end,tz)}`
const where=(s:any,o:any)=>[o.site,o.position,o.label].filter(Boolean).map(h).join(' · ')
function postForm(s:any,back:string) {
 const team=rows(s,'staff').filter(p=>p.active)
 return disclosure(tr(s,'Post an open shift'),form('openshift.post',back,html(s)`<div class="fields"><label>Cafe<select name="site">${(sitesOf(s).length?sitesOf(s):['']).map(v=>html(s)`<option value="${h(v)}">${h(v||tr(s,'Your cafe'))}</option>`).join('')}</select></label>${field('position',tr(s,'Position (blank for anyone at the cafe)'),'','text','maxlength="80" list="positions"')}${utc('start',tr(s,'Starts'))}${utc('end',tr(s,'Ends'))}${field('breakMinutes',tr(s,'Meal minutes'),0,'number','required min="0" max="1440"')}${field('label',tr(s,'Label (optional)'),'','text','maxlength="120"')}<label>Pickup<select name="approval"><option value="manager">A manager approves one request</option><option value="auto">First eligible request is approved (first come)</option></select></label>${orderFields(s)}<label>Offer only to (optional)<select name="pool" multiple>${team.map(p=>html(s)`<option value="${h(p.id)}">${h(p.name)}</option>`).join('')}</select></label></div>`,tr(s,'Post open shift'),'','secondary'))
}
export function openShiftCards(s:any,tz:string,back:string) {
 const list=rows(s,'openshifts'),asks=rows(s,'pickups')
 if(manager(s)) {
  const open=list.filter(o=>o.status==='open')
  const items=open.map(o=>{const waiting=asks.filter(x=>x.openShiftId===o.id&&x.status==='requested')
   return html(s)`<li><strong>${h(when(s,o,tz))}</strong> · ${where(s,o)||tr(s,'Any position')} · ${o.approval==='auto'?tr(s,'approved on pickup'):tr(s,'manager approves')}${o.pool?html(s)` · ${h(o.pool.length)} in pool`:''} · ${h(orderLabel(o))}${accessLine(s,o)}${offerLog(s,o,tz)}${waiting.map(x=>html(s)`<div class="request">${h(person(s,x.staffId))} · ${h(hours(x.after))} hrs that week${x.overtime?html(s)` · overtime`:''}${costNote(s,x.cost?[x.cost]:[])}${form('openshift.approve',back,exact(x),html(s)`Approve ${person(s,x.staffId).split(/\s+/)[0]}`,'','primary small')}</div>`).join('')}</li>`}).join('')
  return card(tr(s,'Open shifts'),html(s)`${items?html(s)`<ul class="swap-list">${items}</ul>`:html(s)`<p class="note">No open shifts are posted.</p>`}${postForm(s,back)}`,'','open-shifts')
 }
 const mine=new Map(asks.map(x=>[x.openShiftId,x]))
 const items=list.map(o=>{const x=mine.get(o.id);return html(s)`<li><strong>${h(when(s,o,tz))}</strong> · ${where(s,o)}${typeof o.hourlyRateCents==='number'?html(s)` · ${h(money(o.hourlyRateCents))}/hr`:''}${x&&x.status!=='declined'?` · ${staffStatus(s,x.status==='requested'?'requested':x.status)}`:`${x?` · ${staffStatus(s,'declined')}`:form('openshift.decline',back,exact(o),tr(s,'Decline'),'','secondary small')}${form('openshift.request',back,exact(o),o.approval==='auto'?tr(s,'Pick up'):tr(s,'Request'),'','primary small')}`}</li>`}).join('')
 const done=asks.filter(x=>x.status!=='requested'&&!list.some(o=>o.id===x.openShiftId)).map(x=>html(s)`<li>Request ${staffStatus(s,x.status)}</li>`).join('')
 return items||done?card(tr(s,'Open shifts'),html(s)`<ul class="swap-list">${items}${done}</ul>`,'','open-shifts'):''
}
