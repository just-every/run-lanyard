// The call-out, handled where it happens: the note under the uncovered block, the
// shortlist popover anchored in that cell, and the offer card a teammate answers.
import {h,avatar,rows,staffOf,person,form,exact,field} from './shared'
import {type Week} from './week'
import {clock,dateKey,day,hours,span,money} from './format'

export function calloutNote(x:any,tz:string) {
 const c=x.callout;if(!c?.at)return ''
 return `<p class="callout-note">${c.note?`<span class="said">${h(c.note)}</span>`:'<span class="said">Called out</span>'}<span class="at">${h(clock(c.at,tz))}</span></p>`
}
export const coverageFor=(s:any,x:any)=>rows(s,'coverageCases').find(c=>c.shiftId===x.id)
const first=(name:string)=>name.split(/\s+/)[0]
function badge(o:any,tz:string) {
 if(!Number.isInteger(o.shiftRevision))return '<span class="badge wait" aria-label="Legacy offer; refresh required" title="Legacy offer; refresh required">?</span>'
 if(o.status==='accepted'||o.status==='approved')return `<span class="badge yes" aria-label="Accepted">✓</span><span class="at">${h(clock(o.respondedAt,tz))}</span>`
 if(o.status==='expired')return '<span class="badge no" aria-label="Expired" title="Expired">!</span>'
 if(o.status==='closed')return '<span class="badge wait" aria-label="Closed" title="Closed">—</span>'
 if(o.status==='declined')return `<span class="badge no" aria-label="Declined">×</span><span class="at">${h(clock(o.respondedAt,tz))}</span>`
 if(o.opensAt&&o.opensAt>new Date().toISOString())return `<span class="badge wait" aria-label="Not offered yet">T${h(o.tier)}</span><span class="at">opens ${h(clock(o.opensAt,tz))}</span>`
 return `<span class="badge wait" aria-label="No reply yet">···</span>`
}
function leftOut(s:any,w:Week,list:any[]) {
 if(!list.length)return ''
 const named=list.filter(f=>f.reason==='overtime'||f.reason==='already on').slice(0,2).map(f=>{
  const shift=f.shiftId&&rows(s,'shifts').find(x=>x.id===f.shiftId)
  return `<strong>${h(person(s,f.staffId))}</strong> ${f.reason==='overtime'?`${h(hours(f.after))} · overtime`:`already on${shift?` ${h(span(shift.start,shift.end,w.tz))}`:''}`}`
 }),rest=list.length-named.length
 return `<p class="left-out">Left out: ${named.join(' · ')}${rest?`${named.length?' · ':''}${h(rest)} ${named.length?'more ':''}on shift or unavailable`:''}</p>`
}
/** The shortlist for one uncovered shift: who was offered it, their answers, and the manager's decision. */
export function coverPopover(s:any,w:Week,x:any,back:string,waitLink:string) {
 const c=x.callout,qualified:any[]=c.qualified??[],at=new Date().toISOString(),coverage=coverageFor(s,x)
 const offers=rows(s,'offers').filter(o=>o.shiftId===x.id).map(o=>({...o,status:['sent','accepted'].includes(o.status)&&x.end<=at?'expired':o.status}))
 const current=(o:any)=>o.shiftRevision===x.revision&&['sent','accepted'].includes(o.status)?1:0
 offers.sort((a,b)=>current(b)-current(a)||(b.createdAt??b.sentAt).localeCompare(a.createdAt??a.sentAt)||(b.shiftRevision??0)-(a.shiftRevision??0))
 const rank:Record<string,number>={approved:0,accepted:0,declined:1,sent:2,closed:3,expired:4}
 const ordered=qualified.map(f=>({f,o:offers.find(o=>o.staffId===f.staffId)})).filter(v=>v.o).sort((a,b)=>rank[a.o.status]-rank[b.o.status])
 const list=ordered.map(({f,o})=>{
  const p=staffOf(s,o.staffId),site=p?.site&&p.site!==w.site?`<span class="from">${h(p.site)}</span>`:''
  const projection=coverage?.offers.find((v:any)=>v.id===o.id)?.cost
  const cost=projection?`<span class="quote">Shift ${projection.shiftCents===null?'rate not set':h(money(projection.shiftCents))}${projection.differenceCents===null?' · cost difference unknown':` · ${projection.differenceCents>=0?'+':'−'}${h(money(Math.abs(projection.differenceCents)))} vs original`} · ${h(hours(projection.overtimeMinutes))} projected overtime hrs${projection.premiumCents===null?' · premium unknown':` · ${h(money(projection.premiumCents))} premium`}</span>`:''
  const legacy=!Number.isInteger(o.shiftRevision)?'<span class="quote">Legacy offer: shift revision was not recorded. Refresh the case for fresh acceptance and approval.</span>':''
  const quote=o.note?`<q>${h(o.note)}</q>`:o.status==='sent'&&!(o.opensAt>new Date().toISOString())?'<span class="waiting">No reply yet</span>':''
  return `<li class="candidate ${h(o.status)}">${avatar(p?.name??'?',site?'cross':'')}<span class="who"><strong>${h(p?.name??'Former staff')}</strong>${site}</span><span class="hrs">${h(hours(f.before))} → ${h(hours(f.after))}</span><span class="reply">${badge(o,w.tz)}</span>${quote?`<span class="quote">${quote}</span>`:''}${cost}${legacy}</li>`
 }).join('')
 const accepted=ordered.filter(v=>v.o.status==='accepted'&&v.o.shiftRevision===x.revision),pending=ordered.filter(v=>v.o.status==='sent'&&v.o.shiftRevision===x.revision)
 const approve=accepted.map(v=>form('cover.approve',back,exact(v.o),`Approve ${first(person(s,v.o.staffId))}`,'class="approve"','primary')).join('')
 const wait=pending.length?`<a class="button secondary" href="${h(waitLink)}">${pending.length===1?`Wait for ${h(first(person(s,pending[0].o.staffId)))}`:'Wait for replies'}</a>`:''
 const reopen=(coverage?.status==='reopened'||coverage?.status==='waiting')&&!accepted.length&&!pending.length?form('cover.reopen',back,exact(x),'Offer to eligible replacements','class="approve"','primary'):''
 const escalation=coverage?.status==='reopened'?`<p class="left-out"><strong>Coverage reopened</strong> · ${h(person(s,x.staffId))} has no recorded clock-in at the configured no-show point. The assignment stays until another replacement is approved.</p>`:''
 const side=w.days.indexOf(dateKey(x.start,w.tz))<3?' to-right':''
 return `<aside class="cover${side}" aria-label="Cover for ${h(person(s,x.staffId))}, ${h(day(dateKey(x.start,w.tz)))}"><div class="cover-head"><strong>${qualified.length?`${h(qualified.length)} qualified · no overtime`:'No one qualifies without overtime'}</strong><a class="close" href="${h(waitLink)}" aria-label="Close">×</a></div>${escalation}${list?`<ul>${list}</ul>`:''}${leftOut(s,w,c.leftOut??[])}${approve||wait||reopen?`<div class="cover-actions">${reopen}${approve}${wait}</div>`:''}</aside>`
}
/** Offers waiting on the signed-in teammate's answer. */
export function offerCards(s:any,tz:string,back:string) {
 const at=new Date().toISOString(),mine=rows(s,'offers').filter(o=>o.staffId===s.actor.staffId&&o.status==='sent'&&(!o.opensAt||o.opensAt<=at))
 return mine.map(o=>{
  const x=rows(s,'shifts').find(v=>v.id===o.shiftId);if(!x||x.end<=at||o.shiftRevision!==x.revision)return ''
  // One answer form: the message goes with whichever button is pressed (its decision).
  const answer=`<form class="offer-actions" method="post" action="/app/action?name=cover.respond&amp;returnTo=${encodeURIComponent(back)}">${exact(o)}${field('note','Message (optional)','','text','maxlength="280"')}<button type="submit" name="decision" value="accepted" class="primary">Accept</button><button type="submit" name="decision" value="declined" class="secondary">Decline</button></form>`
  return `<section class="offer"><div><p class="eyebrow">Cover a shift?</p><h2>${h(day(dateKey(x.start,tz)))} · ${h(span(x.start,x.end,tz))}${x.label?` · ${h(x.label)}`:''}</h2><p>${x.site?`${h(x.site)} · `:''}Your week ${h(hours(o.before))} → ${h(hours(o.after))} hrs, no overtime. A manager approves the cover.</p></div>${answer}</section>`
 }).join('')
}
