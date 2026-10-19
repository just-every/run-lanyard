// The week shift calendar: people rows by Mon–Sun under one header, group bands by
// position, the call-out handled in its own cell, and the labor footer.
import {h,avatar,manager,self,form,exact,field,rows,person} from './shared'
import {type Week,type Row} from './week'
import {clock,dateKey,day,dollars,hours,money,percent,span,weekday} from './format'
import {coverPopover,calloutNote} from './callout'

const keyOf=(date:string)=>weekday(date).toLowerCase()
export const link=(w:Week,extra:Record<string,string|null>={})=>{
 const q=new URLSearchParams();q.set('week',w.week);if(w.site)q.set('site',w.site);if(w.view==='draft'&&w.published)q.set('view','draft')
 for(const [k,v] of Object.entries(extra)){if(v===null)q.delete(k);else q.set(k,v)}
 return '/app/schedule?'+q.toString()
}
function startsIn(x:any,now:number,tz:string) {
 const min=Math.round((Date.parse(x.start)-now)/60000)
 if(min<=0)return `started ${clock(x.start,tz)}`
 if(min<=120)return `starts in ${min} min`
 return dateKey(x.start,tz)===dateKey(now,tz)?`starts ${clock(x.start,tz)}`:`starts ${weekday(dateKey(x.start,tz))} ${clock(x.start,tz)}`
}
/** One shift block; published blocks the viewer can act on open a small menu. */
function block(s:any,w:Week,x:any,now:number,back:string,guest:boolean) {
 const tz=w.tz,time=`<span class="t">${h(span(x.start,x.end,tz))}</span>`,label=x.label?`<span class="l">${h(x.label)}</span>`:''
 if(x.ghost) {
  const cover=x.callout.coveredBy,inAt=rows(s,'clocks').find(c=>c.staffId===cover&&c.start>=new Date(Date.parse(x.start)-7200000).toISOString()&&c.start<=x.end)
  return `<div class="shift ghost">${time}<span class="l">Called out ${h(clock(x.callout.at,tz))}</span><span class="note-line">${cover?`Covered by ${h(person(s,cover))}`:'Covered'}${inAt?` · <span class="done">in ${h(clock(inAt.start,tz))} ✓</span>`:' · closes at clock-in'}</span></div>`
 }
 const open=x.callout&&!x.callout.coveredBy
 const tone=open?' alert':w.view==='draft'?' draft':guest||(w.site&&x.site&&x.site!==w.site)?' cross':''
 const where=w.site&&x.site&&x.site!==w.site?`<span class="where">at ${h(x.site)}</span>`:''
 const summary=`${time}${label}${where}${open?`<span class="state">Uncovered · ${h(startsIn(x,now,tz))}</span><span class="mark" aria-hidden="true">!</span>`:''}`
 const mine=self(s)&&x.staffId===s.actor.staffId,canCall=x.status==='published'&&!x.callout&&x.end>new Date(now).toISOString()&&(mine||manager(s))
 const actions=[mine&&x.status==='published'&&!x.confirmedAt&&!x.callout?form('shift.confirm',back,exact(x),'Confirm shift'):'',
  canCall?form('shift.callout',back,exact(x)+field('note',mine?'Note for your manager (optional)':'Note from the call (optional)','','text','maxlength="280"'),mine?'I can’t make this shift':'Record a call-out','','quiet'):''].filter(Boolean)
 const facts=`<p class="menu-head">${h(person(s,x.staffId))} · ${h(day(dateKey(x.start,tz)))}</p><p>${h(span(x.start,x.end,tz))}${x.breakMinutes?` · ${h(x.breakMinutes)} min meal`:''} · ${h(hours(x.minutes))} hrs${x.site?` · ${h(x.site)}`:''}</p><p>${x.status==='draft'?'Draft, not published':x.confirmedAt?'<span class="done">Confirmed ✓</span>':'Not confirmed yet'}</p>`
 const note=open?calloutNote(x,tz):''
 return `<details class="shift${tone}"><summary>${summary}</summary><div class="shift-menu">${facts}${actions.join('')}</div></details>${note}`
}
function personCell(r:Row,w:Week) {
 const p=r.person,sub=r.guest&&p.site?`<small class="from">from ${h(p.site)}</small>`:p.role==='manager'?`<small>${p.site?'Site manager':'Manager'}</small>`:''
 return `<div class="wk-cell who" role="rowheader">${avatar(p.name,r.guest?'cross':'')}<span class="name"><strong>${h(p.name)}</strong>${sub}</span></div>`
}
function personRow(s:any,w:Week,r:Row,now:number,back:string,cover?:{shift:any;html:string}) {
 const cells=w.days.map((d,i)=>{
  const list=r.cells[i],today=d===w.today?' today':'',here=cover&&list.includes(cover.shift)
  const body=list.length?list.map(x=>block(s,w,x,now,back,r.guest)).join(''):r.guest?'<div class="slot" aria-hidden="true"></div>':''
  return `<div class="wk-cell day${today}${here?' has-cover':''}" role="cell" data-day="${keyOf(d)}">${body}${here?cover!.html:''}</div>`
 }).join('')
 const total=r.cover?`<div class="wk-cell total note" role="cell">Closes only at clock-in.</div>`:`<div class="wk-cell total" role="cell">${h(hours(r.minutes))}</div>`
 return `<div class="wk-row${r.guest?' guest':''}${r.extra?' extra':''}" role="row">${personCell(r,w)}${cells}${total}</div>`
}
function header(w:Week) {
 return `<div class="wk-row head" role="row"><div class="wk-cell" role="columnheader">Staff</div>${w.days.map(d=>`<div class="wk-cell day${d===w.today?' today':''}" role="columnheader" data-day="${keyOf(d)}"><strong>${h(weekday(d))}</strong><small>${h(day(d,false))}</small>${d===w.today?'<em>Today</em>':''}</div>`).join('')}<div class="wk-cell total" role="columnheader"><strong>Week</strong><small>Hours</small></div></div>`
}
function footer(w:Week) {
 const f=w.forecast?.days as number[]|undefined,total=w.labor.reduce((a,b)=>a+b,0),sales=f?f.reduce((a,b)=>a+b,0):0
 const days=w.days.map((d,i)=>`<div class="wk-cell day${d===w.today?' today':''}" role="cell" data-day="${keyOf(d)}"><span>${f?h(dollars(f[i])):'—'}</span><span>${h(money(w.labor[i]))}</span><span>${f?h(percent(w.labor[i]/100,f[i])):'—'}</span></div>`).join('')
 const budget=w.forecast?.budgetPercent?` · budget ${h(w.forecast.budgetPercent)}%`:''
 const summary=f?`<span><strong>${h(money(total))}</strong> of ${h(dollars(sales))}</span><span>${h(percent(total/100,sales))}${budget}</span>`:`<span><strong>${h(money(total))}</strong> scheduled</span><span>No forecast yet</span>`
 return `<div class="wk-row foot" role="row"><div class="wk-cell" role="rowheader"><span>Forecast</span><span>Labor cost</span><span>Labor %</span></div>${days}<div class="wk-cell total" role="cell">${summary}</div></div>${w.unrated?`<p class="wk-aside">${h(w.unrated)} scheduled ${w.unrated===1?'person has':'people have'} no hourly rate yet, so their hours are not in labor cost. Set rates in People.</p>`:''}`
}
export function grid(s:any,w:Week,now:number,back:string,q:URLSearchParams) {
 const parts:string[]=[header(w)];let shown=false
 for(const g of w.groups) {
  parts.push(`<div class="wk-row band" role="row"><div class="wk-cell" role="cell"><strong>${h(g.name)}</strong>${g.rate!==null&&manager(s)?`<span class="rate">${h(money(g.rate))}/hr</span>`:''}</div></div>`)
  for(const r of g.rows) {
   // The first uncovered call-out a manager can decide opens its shortlist in place.
   const open=!shown&&manager(s)&&q.get('cover')!=='wait'?r.cells.flat().find(x=>x.callout&&!x.callout.coveredBy&&!x.ghost):undefined
   if(open)shown=true
   parts.push(personRow(s,w,r,now,back,open?{shift:open,html:coverPopover(s,w,open,back,link(w,{cover:'wait'}))}:undefined))
  }
 }
 if(!w.groups.length)parts.push(`<div class="wk-row" role="row"><div class="wk-cell blank" role="cell">${w.roster?`<p>No one is scheduled${w.site?` at ${h(w.site)}`:''} this week.</p>`:`<p>No schedule yet for the week of ${h(day(w.week))}.</p>`}${manager(s)?`<a class="text-link" href="#plan">${w.roster?'Edit this week':'Build this week'}</a>`:''}</div></div>`)
 if(w.extraCount||q.has('all'))parts.push(`<div class="wk-row more" role="row"><div class="wk-cell" role="cell"><a href="${h(link(w,{all:q.has('all')?null:'1'}))}" data-more="${w.extraCount}"><span class="chev" aria-hidden="true"></span>${q.has('all')?'Show fewer staff':`+ ${h(w.extraCount)} more staff`}</a></div></div>`)
 if(manager(s)&&w.roster)parts.push(footer(w))
 // Phones open on the day an uncovered call-out needs a decision, else today, else Monday; that day's tab is marked.
 const uncovered=(d:string)=>w.callouts.filter(x=>dateKey(x.start,w.tz)===d).length
 const asked=q.get('day')??'',first=w.days.find(uncovered)
 const show=keyOf(w.days.includes(asked)?asked:first??(w.days.includes(w.today)?w.today:w.week))
 const picker=`<nav class="day-picker" aria-label="Day">${w.days.map(d=>{const n=uncovered(d);return `<a href="${h(link(w,{day:d}))}" data-show="${keyOf(d)}"${keyOf(d)===show?' aria-current="true"':''}${n?` class="uncovered" aria-label="${h(day(d))}, ${h(n)} uncovered"`:''}><strong>${h(weekday(d))}</strong><small>${h(day(d,false))}</small>${n?'<i class="flag" aria-hidden="true"></i>':''}</a>`}).join('')}</nav>`
 return `${picker}<div class="week${w.view==='draft'?' is-draft':''}" role="table" aria-label="Week of ${h(day(w.week))}" data-show="${show}">${parts.join('')}</div>`
}
