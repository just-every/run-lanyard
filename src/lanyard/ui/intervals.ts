// REPORT-003 screen: one cafe's day by interval, scheduled and actual labor against hourly sales, with
// daypart targets and exceeded intervals flagged; incomplete sales hours never read as zero.
import {h,card,form,field,hidden,rows,titleRow} from './shared'
import {money} from './format'

const hrs=(m:number)=>(m/60).toFixed(2)
const pct=(v:number|null)=>v===null?'—':`${v.toFixed(1)}%`
export function intervalsPage(s:any,r:any,now:number) {
 const pick=`<form class="filter" method="get" action="/app/intervals">${hidden('site',r.site)}<label>Day<input type="date" name="date" value="${h(r.date)}"></label><label>Interval<select name="size">${[15,30,60].map(n=>`<option value="${n}"${n===r.size?' selected':''}>${n} minutes</option>`).join('')}</select></label><button class="button secondary" type="submit">Show</button></form>`
 const shown=r.intervals.filter((x:any)=>x.salesCents!==null||x.scheduled.minutes||x.actual.minutes||x.forecast?.salesCents||x.forecast?.requiredMinutes)
 const line=(x:any)=>`<tr${x.exceeded?' class="warning"':''}><td data-label="Interval">${h(x.time)}</td><td data-label="Sales">${x.incomplete?'<em>incomplete</em>':`${h(money(x.salesCents))}${r.size<60?' <small>split from the hour</small>':''}`}</td>${r.forecast?`<td data-label="Forecast hours">${x.forecast.requiredMinutes===null?'<em>incomplete</em>':h(hrs(x.forecast.requiredMinutes))}${r.size<60?' <small>hourly forecast split evenly</small>':''}</td>`:''}<td data-label="Scheduled hours">${h(hrs(x.scheduled.minutes))}</td><td data-label="Scheduled labor %">${h(pct(x.scheduled.laborPercent))}</td><td data-label="Actual hours">${h(hrs(x.actual.minutes))}</td><td data-label="Actual labor %">${h(pct(x.actual.laborPercent))}</td><td data-label="Sales per labor hour">${x.actual.salesPerLaborHour===null?'—':h(money(x.actual.salesPerLaborHour))}</td><td data-label="Target">${x.daypart?`${h(x.daypart.name)} ${h(pct(x.daypart.targetPercent))}${x.exceeded?' · <strong>over target</strong>':''}`:'—'}</td></tr>`
 const table=shown.length?`<table class="list stack"><thead><tr><th>Interval</th><th>Sales</th>${r.forecast?`<th>Forecast hrs (v${r.forecast.version})</th>`:''}<th>Scheduled hrs</th><th>Scheduled labor %</th><th>Actual hrs</th><th>Actual labor %</th><th>Sales per labor hour</th><th>Daypart target</th></tr></thead><tbody>${shown.map(line).join('')}</tbody></table>`:'<p class="note">No sales or labor this day.</p>'
 return `${titleRow(`Labor by interval · ${r.site||'Your cafe'}`,s,now)}${card(`${r.date} · ${r.size}-minute intervals`,`<p class="note">Scheduled and actual (worked) hours at each person’s hourly rate against entered hourly sales (SALES-001). Hours without hourly sales are incomplete, never zero.</p>${r.wagesVisible===false?'<p>Wage-based figures are hidden for this access level.</p>':''}${pick}${table}`,`<p class="card-note">${h(shown.filter((x:any)=>x.exceeded).length)} over target</p>`,'intervals')}`
}
/** Dayparts and their target labor %, on the Sales card; links to a day's interval report. */
export function daypartsBlock(s:any,site:string,date:string,back:string) {
 const list=rows(s,'dayparts').filter(r=>(r.site??'')===site)
 const items=list.map(d=>`<li>${h(d.name)} ${h(d.start)}–${h(d.end)} · target ${h(pct(d.targetPercent))}</li>`).join('')
 const add=form('daypart.save',back,`<div class="fields">${hidden('site',site)}${field('name','Daypart','','text','required maxlength="40" placeholder="Dinner"')}${field('start','From','','time','required')}${field('end','Until','','time','required')}${field('targetPercent','Target labor %','','text','required maxlength="6" placeholder="28"')}</div>`,'Save daypart target','','secondary')
 return `<p><a class="text-link" href="/app/intervals?site=${encodeURIComponent(site)}&amp;date=${h(date)}&amp;size=60">Labor by interval for ${h(date)}</a> · <a class="text-link" href="/app/demand?site=${encodeURIComponent(site)}&amp;date=${h(date)}">Demand forecast for ${h(date)}</a></p>${items?`<ul class="swap-list">${items}</ul>`:''}${add}`
}
