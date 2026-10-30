import {localDay,localWeekday,html,t as tr} from '../localization'
// The week shift calendar: people rows by Mon–Sun under one header, group bands by
// position, the call-out handled in its own cell, and the labor footer.
import {h,avatar,manager,self,form,exact,field,rows,person} from './shared'
import {type Week,type Row} from './week'
import {clock,dateKey,day,dollars,hours,money,percent,span,weekday} from './format'
import {coverPopover,calloutNote,coverageFor} from './callout'
import {contactLink} from './contacts'

const keyOf=(date:string)=>weekday(date).toLowerCase()
export const link=(w:Week,extra:Record<string,string|null>={})=>{
 const q=new URLSearchParams();q.set('week',w.week);if(w.site)q.set('site',w.site);if(w.view==='draft'&&w.published)q.set('view','draft')
 for(const [k,v] of Object.entries(extra)){if(v===null)q.delete(k);else q.set(k,v)}
 return '/app/schedule?'+q.toString()
}
function startsIn(s:any,x:any,now:number,tz:string) {
 const min=Math.round((Date.parse(x.start)-now)/60000)
 if(min<=0)return html(s)`started ${clock(x.start,tz)}`
 if(min<=120)return html(s)`starts in ${min} min`
 return dateKey(x.start,tz)===dateKey(now,tz)?html(s)`starts ${clock(x.start,tz)}`:html(s)`starts ${localWeekday(s,dateKey(x.start,tz))} ${clock(x.start,tz)}`
}
/** One shift block; published blocks the viewer can act on open a small menu. */
function block(s:any,w:Week,x:any,now:number,back:string,guest:boolean) {
 const tz=w.tz,time=html(s)`<span class="t">${h(span(x.start,x.end,tz))}</span>`,label=x.label?html(s)`<span class="l">${h(x.label)}</span>`:''
 if(x.ghost) {
  const cover=x.callout.coveredBy,coverage=coverageFor(s,x),inAt=coverage?.clock
  const state=coverage?.status==='reopened'?tr(s,' · coverage reopened'):coverage?.status==='expired'?tr(s,' · expired without a recorded clock-in'):inAt?html(s)` · <span class="done">in ${h(clock(inAt.start,tz))} ✓</span>`:tr(s,' · closes at clock-in')
  return html(s)`<div class="shift ghost">${time}<span class="l">Called out ${h(clock(x.callout.at,tz))}</span><span class="note-line">${cover?html(s)`Covered by ${h(person(s,cover))}`:tr(s,'Covered')}${state}</span></div>`
 }
 const coverage=coverageFor(s,x),reopened=coverage?.status==='reopened',open=x.callout&&(!x.callout.coveredBy||reopened)&&x.end>new Date(now).toISOString()
 const tone=open?' alert':w.view==='draft'?' draft':guest||(w.site&&x.site&&x.site!==w.site)?' cross':''
 const where=w.site&&x.site&&x.site!==w.site?html(s)`<span class="where">at ${h(x.site)}</span>`:''
 const summary=html(s)`${time}${label}${where}${open?html(s)`<span class="state">${reopened?tr(s,'Coverage reopened'):tr(s,'Uncovered')} · ${h(startsIn(s,x,now,tz))}</span><span class="mark" aria-hidden="true">!</span>`:''}`
 const mine=self(s)&&x.staffId===s.actor.staffId,canCall=x.status==='published'&&!x.callout&&x.end>new Date(now).toISOString()&&(mine||manager(s))
 const actions=[mine&&x.status==='published'&&!x.confirmedAt&&!x.callout?form('shift.confirm',back,exact(x),tr(s,'Confirm shift')):'',
  canCall?form('shift.callout',back,exact(x)+field('note',mine?tr(s,'Note for your manager (optional)'):tr(s,'Note from the call (optional)'),'','text','maxlength="280"'),mine?tr(s,'I can’t make this shift'):tr(s,'Record a call-out'),'','quiet'):''].filter(Boolean)
 const facts=html(s)`<p class="menu-head">${h(person(s,x.staffId))} · ${h(localDay(s,dateKey(x.start,tz)))}</p><p>${h(span(x.start,x.end,tz))}${x.breakMinutes?html(s)` · ${h(x.breakMinutes)} min meal`:''} · ${h(hours(x.minutes))} hrs${x.site?` · ${h(x.site)}`:''}</p><p>${x.status==='draft'?tr(s,'Draft, not published'):x.confirmedAt?html(s)`<span class="done">Confirmed ✓</span>`:tr(s,'Not confirmed yet')}</p>${x.status==='published'&&contactLink(s,x.staffId)?html(s)`<p>${contactLink(s,x.staffId)}</p>`:''}`
 const note=open?calloutNote(x,tz):''
 return html(s)`<details class="shift${tone}"><summary>${summary}</summary><div class="shift-menu">${facts}${actions.join('')}</div></details>${note}`
}
function personCell(s:any,r:Row,w:Week) {
 const p=r.person,sub=r.guest&&p.site?html(s)`<small class="from">from ${h(p.site)}</small>`:p.role==='manager'?html(s)`<small>${p.site?tr(s,'Site manager'):tr(s,'Manager')}</small>`:''
 return html(s)`<div class="wk-cell who" role="rowheader">${avatar(p.name,r.guest?'cross':'')}<span class="name"><strong>${h(p.name)}</strong>${sub}</span></div>`
}
function personRow(s:any,w:Week,r:Row,now:number,back:string,cover?:{shift:any;html:string}) {
 const cells=w.days.map((d,i)=>{
  const list=r.cells[i],today=d===w.today?' today':'',here=cover&&list.includes(cover.shift)
  const body=list.length?list.map(x=>block(s,w,x,now,back,r.guest)).join(''):r.guest?html(s)`<div class="slot" aria-hidden="true"></div>`:''
  return html(s)`<div class="wk-cell day${today}${here?' has-cover':''}" role="cell" data-day="${keyOf(d)}">${body}${here?cover!.html:''}</div>`
 }).join('')
 const total=r.cover?html(s)`<div class="wk-cell total note" role="cell">Closes only at clock-in.</div>`:html(s)`<div class="wk-cell total" role="cell">${h(hours(r.minutes))}</div>`
 return html(s)`<div class="wk-row${r.guest?' guest':''}${r.extra?' extra':''}" role="row">${personCell(s,r,w)}${cells}${total}</div>`
}
function header(s:any,w:Week) {
 return html(s)`<div class="wk-row head" role="row"><div class="wk-cell" role="columnheader">Staff</div>${w.days.map(d=>html(s)`<div class="wk-cell day${d===w.today?' today':''}" role="columnheader" data-day="${keyOf(d)}"><strong>${h(localWeekday(s,d))}</strong><small>${h(localDay(s,d,false))}</small>${d===w.today?html(s)`<em>Today</em>`:''}</div>`).join('')}<div class="wk-cell total" role="columnheader"><strong>Week</strong><small>Hours</small></div></div>`
}
function footer(s:any,w:Week) {
 const f=w.forecast?.days as number[]|undefined,total=w.labor.reduce((a,b)=>a+b,0),sales=f?f.reduce((a,b)=>a+b,0):0
 const days=w.days.map((d,i)=>html(s)`<div class="wk-cell day${d===w.today?' today':''}" role="cell" data-day="${keyOf(d)}"><span>${f?h(dollars(f[i])):'—'}</span><span>${h(money(w.labor[i]))}</span><span>${f?h(percent(w.labor[i]/100,f[i])):'—'}</span></div>`).join('')
 const budget=w.forecast?.budgetPercent?html(s)` · budget ${h(w.forecast.budgetPercent)}%`:''
 const summary=f?html(s)`<span><strong>${h(money(total))}</strong> of ${h(dollars(sales))}</span><span>${h(percent(total/100,sales))}${budget}</span>`:html(s)`<span><strong>${h(money(total))}</strong> scheduled</span><span>No forecast yet</span>`
 return html(s)`<div class="wk-row foot" role="row"><div class="wk-cell" role="rowheader"><span>Forecast</span><span>Labor cost</span><span>Labor %</span></div>${days}<div class="wk-cell total" role="cell">${summary}</div></div>${w.unrated?html(s)`<p class="wk-aside">${h(w.unrated)} scheduled ${w.unrated===1?tr(s,'person has'):tr(s,'people have')} no hourly rate yet, so their hours are not in labor cost. Set rates in People.</p>`:''}`
}
export function grid(s:any,w:Week,now:number,back:string,q:URLSearchParams) {
 const parts:string[]=[header(s,w)];let shown=false
 for(const g of w.groups) {
  parts.push(html(s)`<div class="wk-row band" role="row"><div class="wk-cell" role="cell"><strong>${h(g.name)}</strong>${g.rate!==null&&manager(s)?html(s)`<span class="rate">${h(money(g.rate))}/hr</span>`:''}</div></div>`)
  for(const r of g.rows) {
   // The first uncovered call-out a manager can decide opens its shortlist in place.
   const open=!shown&&manager(s)&&q.get('cover')!=='wait'?r.cells.flat().find(x=>x.callout&&(!x.callout.coveredBy||coverageFor(s,x)?.status==='reopened')&&x.end>new Date(now).toISOString()&&!x.ghost):undefined
   if(open)shown=true
   parts.push(personRow(s,w,r,now,back,open?{shift:open,html:coverPopover(s,w,open,back,link(w,{cover:'wait'}))}:undefined))
  }
 }
 if(!w.groups.length)parts.push(html(s)`<div class="wk-row" role="row"><div class="wk-cell blank" role="cell">${w.roster?html(s)`<p>No one is scheduled${w.site?html(s)` at ${h(w.site)}`:''} this week.</p>`:html(s)`<p>No schedule yet for the week of ${h(localDay(s,w.week))}.</p>`}${manager(s)?html(s)`<a class="text-link" href="#plan">${w.roster?tr(s,'Edit this week'):tr(s,'Build this week')}</a>`:''}</div></div>`)
 if(w.extraCount||q.has('all'))parts.push(html(s)`<div class="wk-row more" role="row"><div class="wk-cell" role="cell"><a href="${h(link(w,{all:q.has('all')?null:'1'}))}" data-more="${w.extraCount}"><span class="chev" aria-hidden="true"></span>${q.has('all')?tr(s,'Show fewer staff'):html(s)`+ ${h(w.extraCount)} more staff`}</a></div></div>`)
 if(manager(s)&&w.roster)parts.push(footer(s,w))
 // Phones open on the day an uncovered call-out needs a decision, else today, else Monday; that day's tab is marked.
 const uncovered=(d:string)=>w.callouts.filter(x=>dateKey(x.start,w.tz)===d).length
 const asked=q.get('day')??'',first=w.days.find(uncovered)
 const show=keyOf(w.days.includes(asked)?asked:first??(w.days.includes(w.today)?w.today:w.week))
 const picker=html(s)`<nav class="day-picker" aria-label="Day">${w.days.map(d=>{const n=uncovered(d);return html(s)`<a href="${h(link(w,{day:d}))}" data-show="${keyOf(d)}"${keyOf(d)===show?' aria-current="true"':''}${n?` class="uncovered" aria-label="${h(localDay(s,d))}, ${h(n)} uncovered"`:''}><strong>${h(localWeekday(s,d))}</strong><small>${h(localDay(s,d,false))}</small>${n?html(s)`<i class="flag" aria-hidden="true"></i>`:''}</a>`}).join('')}</nav>`
 return html(s)`${picker}<div class="week${w.view==='draft'?' is-draft':''}" role="table" aria-label="Week of ${h(localDay(s,w.week))}" data-show="${show}">${parts.join('')}</div>`
}
