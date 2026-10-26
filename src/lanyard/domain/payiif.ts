import {type Context,type Row,need,keys,object,text,canonical} from './model'
import {localDate} from './settings'

export const quickbooksPreset='quickbooks-desktop'
const source='https://support.quickbooks.intuit.com/support/pages/executable/iif/iif_import_kit.zip'
const cell=(value:unknown,label:string)=>{const v=text(value,label,120);need(/^[\x20-\x7e]+$/.test(v),`${label} must contain printable ASCII without tabs or line endings`);return v}
const map=(value:unknown,label:string)=>Object.fromEntries(Object.entries(object(value)).map(([k,v])=>[k,cell(v,label)]))
export function iifOptions(value:unknown){
 const p=object(value);keys(p,['companyName','companyCreateTime','version','release','serviceItems'])
 const companyCreateTime=cell(p.companyCreateTime,'Company creation time');need(/^\d{1,12}$/.test(companyCreateTime),'Use the company creation time from its exported Timer header')
 const version=cell(p.version,'Timer version'),release=cell(p.release,'Timer release');need(/^\d+$/.test(version)&&/^\d+$/.test(release),'Use numeric Timer version and release from the company export')
 return {companyName:cell(p.companyName,'QuickBooks company name'),companyCreateTime,version,release,serviceItems:map(p.serviceItems,'Service item'),source,sourceVersion:'Intuit IIF Import Kit, Timer Activity, 18 April 2008',exportOnly:true}
}
/** The native Settings form supplies named mappings, never guessed provider names. */
export function iifForm(c:Context,p:Record<string,any>){
 if(p.preset!==quickbooksPreset||!Object.hasOwn(p,'companyName'))return p
 const staff=c.s.staff.filter(s=>s.active),jobs=['',...c.s.jobs.map(j=>j.id)],sites=[...new Set(['',...c.s.staff.map(s=>s.site??'')])]
 keys(p,['id','revision','name','preset','companyName','companyCreateTime','version','release','regular','overtime','doubleTime','PTO','approved',...staff.map(s=>'employee:'+s.id),...jobs.flatMap(j=>['customer:'+j,'service:'+j]),...sites.map(s=>'class:'+s)])
 const selected=(prefix:string,ids:string[])=>Object.fromEntries(ids.filter(id=>String(p[prefix+id]??'').trim()).map(id=>[id,String(p[prefix+id]).trim()]))
 return {id:p.id,revision:p.revision,name:p.name,preset:quickbooksPreset,approved:p.approved===true||p.approved==='on',employees:Object.fromEntries(staff.filter(s=>String(p['employee:'+s.id]??'').trim()).map(s=>[s.id,{id:p['employee:'+s.id],workflow:'W-2'}])),codes:Object.fromEntries([['regular',p.regular],['overtime',p.overtime],['double time',p.doubleTime],['PTO',p.PTO]].filter(([,v])=>String(v??'').trim())),jobs:selected('customer:',jobs),locations:selected('class:',sites),iif:{companyName:p.companyName,companyCreateTime:p.companyCreateTime,version:p.version,release:p.release,serviceItems:selected('service:',jobs)}}
}
export function iifFile(c:Context,lines:any[],t:Row){
 need(t.preset===quickbooksPreset&&t.classification==='policy','QuickBooks time export requires its policy-classified preset',409)
 const groups=new Map<string,any>()
 const mapped=(m:any,k:string,label:string)=>{need(Object.hasOwn(m,k),`Unmapped ${label}: ${k||'No job'}`,409);return cell(m[k],label)}
 for(const l of lines){
  const e=t.employees[l.staffId];need(e&&e.workflow==='W-2','QuickBooks time export needs a mapped employee with reviewed W-2 treatment',409)
  const code=l.earningCode??l.payCode??'regular',item=mapped(t.codes,code,'payroll item')
  need(l.classifiedWorked||code==='PTO','This IIF preset supports classified worked hours and PTO only; review other earnings separately',409)
  need(Number.isInteger(l.minutes)&&l.minutes>=0,'IIF cannot safely import negative time corrections; reconcile them in QuickBooks before a new export',409)
  if(!l.minutes)continue
  const job=l.job??l.rateBasis?.job??'',site=l.site??l.rateBasis?.site??'',customer=mapped(t.jobs,job,'customer job'),service=mapped(t.iif.serviceItems,job,'service item'),klass=t.locations[site]?cell(t.locations[site],'Class'):''
  const date=l.date??localDate(l.start,c.s.timezone),employee=cell(e.id,'Employee name'),key=canonical([employee,date,item,customer,service,klass])
  const old=groups.get(key);if(old)old.minutes+=l.minutes;else groups.set(key,{date,employee,item,customer,service,klass,minutes:l.minutes})
 }
 const header=['!TIMERHDR','VER','REL','COMPANYNAME','IMPORTEDBEFORE','FROMTIMER','COMPANYCREATETIME'].join('\t')+'\r\n'+['TIMERHDR',t.iif.version,t.iif.release,t.iif.companyName,'N','Y',t.iif.companyCreateTime].join('\t')+'\r\n!TIMEACT\tDATE\tJOB\tEMP\tITEM\tPITEM\tDURATION\tPROJ\tNOTE\tXFERTOPAYROLL\tBILLINGSTATUS\r\n'
 return header+[...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,r])=>{need(r.minutes<=1439,'A grouped IIF activity exceeds 23:59; review its daily mapping',409);const [year,month,day]=r.date.split('-');return ['TIMEACT',`${month}/${day}/${year.slice(2)}`,r.customer,r.employee,r.service,r.item,`${Math.floor(r.minutes/60)}:${String(r.minutes%60).padStart(2,'0')}`,r.klass,'','Y','0'].join('\t')}).join('\r\n')+'\r\n'
}
