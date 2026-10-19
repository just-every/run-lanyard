// SALES-001 screen: a cafe's entered sales and workload for the week beside its scheduled labor
// (labor % and sales per labor hour), each value labelled Manual with its earlier values, a form for
// one value and a CSV upload previewed with its column mapping, duplicates and row errors.
import {h,rows,form,field,hidden,card,disclosure,outcome} from './shared'
import {type Week} from './week'
import {day,money} from './format'
import {daypartsBlock} from './intervals'

const shown=(e:any)=>e.metric==='sales'?money(e.value):String(e.value)
const when=(e:any)=>e.hour===null?'day':`${String(e.hour).padStart(2,'0')}:00`
function preview(extras:any,site:string,back:string) {
 const v=outcome(extras),raw=extras.result;if(!v?.fingerprint)return ''
 const problems=[...v.duplicates.map((d:any)=>`Line ${d.line}: duplicate, ${d.reason}`),...v.errors.map((e:any)=>`Line ${e.line}: ${e.message}`)]
 const go=problems.length?'<p class="note">Remove the duplicate rows and fix the errors, then preview again.</p>':form('sales.import',back,hidden('csv',raw.csv??'')+hidden('mapping',raw.mapping??'')+hidden('site',site)+hidden('fingerprint',v.fingerprint),`Import ${v.entries.length} values`,'','primary small')
 return `<div class="banner"><p><strong>Preview:</strong> ${h(v.entries.length)} values from the file.</p>${problems.length?`<ul class="conflicts">${problems.map(p=>`<li>${h(p)}</li>`).join('')}</ul>`:''}${go}</div>`
}
export function salesCard(s:any,w:Week,back:string,extras:any) {
 const site=w.site,list=rows(s,'sales').filter(r=>(r.site??'')===site&&w.days.includes(r.date))
 const metrics=[...new Set(['sales','transactions','covers',...list.map(r=>r.metric)])]
 const total=(date:string,m:string)=>{const x=list.filter(r=>r.date===date&&r.metric===m);return x.length?x.reduce((n,r)=>n+r.value,0):null}
 const body=w.days.map((d,i)=>{
  const sales=total(d,'sales'),labor=w.labor[i],minutes=w.laborMinutes[i]
  const cells=metrics.map(m=>{const v=total(d,m);return `<td data-label="${h(m)}">${v===null?'—':h(m==='sales'?money(v):String(v))}</td>`}).join('')
  const ratio=`<td data-label="Labor %">${sales?h((Math.round(labor/sales*1000)/10).toFixed(1))+'%':'—'}</td><td data-label="Sales per labor hour">${sales&&minutes?h(money(Math.round(sales*60/minutes))):'—'}</td>`
  const entries=list.filter(r=>r.date===d).sort((a,b)=>a.metric.localeCompare(b.metric)||(a.hour??-1)-(b.hour??-1))
  const detail=entries.length?disclosure('Manual · correct',`<ul class="swap-list">${entries.map(e=>`<li>${h(e.metric)} · ${h(when(e))}: <strong>${h(shown(e))}</strong> <small>Manual (${h(e.source==='csv'?'CSV':'form')})</small>${e.versions.length?` · earlier: ${e.versions.map((v:any)=>h(shown({...e,value:v.value}))).join(', ')}`:''}${form('sales.save',back,hidden('id',e.id)+hidden('revision',e.revision)+field('value','Corrected value','','text','required maxlength="20"'),'Correct','','secondary small')}</li>`).join('')}</ul>`,false,'inline-menu'):''
  return `<tr><td data-label="Day">${h(day(d))}</td>${cells}${ratio}<td>${detail}</td></tr>`
 }).join('')
 const table=`<table class="list stack"><thead><tr><th>Day</th>${metrics.map(m=>`<th>${h(m[0].toUpperCase()+m.slice(1))}</th>`).join('')}<th>Labor %</th><th>Sales per labor hour</th><th><span class="sr-only">Entries</span></th></tr></thead><tbody>${body}</tbody></table>`
 const one=form('sales.save',back,`<div class="fields">${hidden('site',site)}<label>Day<select name="date">${w.days.map(d=>`<option value="${h(d)}">${h(day(d))}</option>`).join('')}</select></label>${field('hour','Hour (blank for the whole day)','','text','maxlength="5" placeholder="14"')}<label>Metric<input name="metric" list="sales-metrics" value="sales" required maxlength="40"></label><datalist id="sales-metrics"><option value="sales"><option value="transactions"><option value="covers"></datalist>${field('value','Value (sales in dollars)','','text','required maxlength="20"')}</div>`,'Save value','','secondary')
 const upload=form('sales.preview',back,`${hidden('site',site)}<label>CSV<textarea name="csv" rows="5" required placeholder="date,hour,sales,transactions">${h(outcome(extras)?.fingerprint?extras.result.csv??'':'')}</textarea></label><label>Column mapping (field=Column, one per line; optional when headers match)<textarea name="mapping" rows="2" placeholder="sales=Net sales">${h(outcome(extras)?.fingerprint?extras.result.mapping??'':'')}</textarea></label>`,'Preview upload','','secondary')
 return card('Sales and workload',`<p class="note">Entered by hand or from a CSV, labelled Manual. Labor % is scheduled labor cost over entered sales; sales per labor hour divides entered sales by scheduled hours.</p>${preview(extras,site,back)}${table}<div class="split">${disclosure('Enter a value',one)}${disclosure('Upload a CSV',upload,Boolean(outcome(extras)?.fingerprint))}${disclosure('Labor by interval and daypart targets',daypartsBlock(s,site,w.days.includes(w.today)?w.today:w.days[0],back))}</div>`,`<p class="card-note">${h(site||'Your cafe')}</p>`,'sales')
}
