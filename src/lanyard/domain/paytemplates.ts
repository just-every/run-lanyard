import {quickbooksPreset,iifOptions,iifFile,iifForm} from './payiif'
import {xlsx,base64} from './payxlsx'
// PAY-002: retained, explicitly mapped files over approved payroll sources.
import {type Context,type Row,keys,text,need,object,get,exact,put,canonical} from './model'
import {localDate} from './settings'
const fields=['periodId','week','rateCents','multiplier','employee','workflow','code','date','start','end','minutes','hours','amount','job','location','timeId','revision']
const own=(map:any,key:string)=>Object.hasOwn(map,key)?map[key]:undefined
const mapping=(v:unknown,label:string)=>Object.fromEntries(Object.entries(object(v)).map(([k,x])=>[k,text(x,label,120)]))
export function templateCommand(c:Context,name:string,p:Record<string,any>){
 if(name!=='payroll.template.save')return
 need(c.a.role==='owner','Only the payroll administrator (the owner) maintains export templates',403)
 if(p.mappingEdit==='true'){
  const old=get(c.s,'paytemplates',p.id);exact(old,p)
  keys(p,['id','revision','mappingEdit','approved',...Object.keys(p).filter(k=>/^(employee|workflow|code|job|location):/.test(k))])
  need(!old.preset,'Use the maintained preset editor for this template',409)
  const result=Object.fromEntries(['name','delimiter','header','columns','groupBy','dateFormat','decimals','employees','codes','jobs','locations','classification','format','timeFormat'].map(k=>[k,old[k]]))
  for(const [prefix,kind] of [['code','codes'],['job','jobs'],['location','locations']]){
   result[kind]={...result[kind]};for(const [key,value] of Object.entries(p))if(key.startsWith(prefix+':')){const id=key.slice(prefix.length+1);if(String(value).trim())result[kind][id]=value;else delete result[kind][id]}
  }
  result.employees=structuredClone(old.employees)
  for(const [key,value] of Object.entries(p))if(key.startsWith('employee:')){const id=key.slice(9);if(String(value).trim())result.employees[id]={id:value,workflow:p['workflow:'+id]};else delete result.employees[id]}
  p={...result,id:old.id,revision:old.revision,approved:p.approved==='on'||p.approved===true}
 }
 p=iifForm(c,p)
 keys(p,['id','revision','name','delimiter','header','columns','groupBy','dateFormat','decimals','employees','codes','jobs','locations','classification','format','timeFormat','approved','preset','iif'])
 const old=p.id?get(c.s,'paytemplates',p.id):undefined;if(old)exact(old,p)
 const approved=p.approved??false;need(typeof approved==='boolean','Choose explicit template approval')
 const preset=p.preset;need(preset===undefined||preset===quickbooksPreset,'Unknown maintained preset')
 if(preset){p={...p,classification:'policy',format:'iif',header:true,columns:[{field:'hours',header:'Duration'}],groupBy:['date','job','location'],dateFormat:'us',decimals:4}}
 const classification=p.classification??'source';need(['source','policy'].includes(classification),'Choose source or policy classification')
 const format=p.format??'csv';need(['csv','tsv','delimited','xlsx','iif'].includes(format),'Choose CSV, TSV, delimited text, XLSX or the QuickBooks preset')
 need(format!=='iif'||preset===quickbooksPreset,'IIF requires the maintained QuickBooks preset')
 const iif=preset?iifOptions(p.iif):undefined
 const timeFormat=p.timeFormat??'iso';need(['iso','utc-minute','utc-time'].includes(timeFormat),'Choose ISO UTC, UTC date and minute, or UTC time')
 const delimiter=format==='tsv'?'\t':p.delimiter??',';need(typeof delimiter==='string'&&delimiter.length===1&&!/["\r\n]/.test(delimiter),'Choose a single delimiter other than a quote or line ending')
 need(typeof p.header==='boolean','Choose whether to include a header')
 need(Array.isArray(p.columns)&&p.columns.length>0&&p.columns.length<=30,'Provide 1–30 columns')
 const columns=p.columns.map((x:any)=>{keys(object(x),['field','header']);need(fields.includes(x.field),'Unknown export column');return {field:x.field,header:text(x.header,'column header',80)}})
 need(new Set(columns.map((x:any)=>x.header)).size===columns.length,'Duplicate column header')
 need(Array.isArray(p.groupBy)&&p.groupBy.every((k:any)=>['date','job','location'].includes(k))&&new Set(p.groupBy).size===p.groupBy.length,'Choose date, job or location grouping')
 const dateFormat=p.dateFormat??'iso';need(['iso','us','eu'].includes(dateFormat),'Unsupported date format')
 const decimals=p.decimals??4;need(Number.isInteger(decimals)&&decimals>=0&&decimals<=6,'Choose 0–6 decimal places')
 const employees=Object.fromEntries(Object.entries(object(p.employees)).map(([id,v])=>{const x=object(v);keys(x,['id','workflow']);need(c.s.staff.some(s=>s.id===id),'Employee not found',404);need(['W-2','1099','unclassified'].includes(x.workflow),'Choose W-2, 1099 or unclassified; classification requires owner review');return [id,{id:text(x.id,'provider employee ID',120),workflow:x.workflow}]}))
 need(new Set(Object.values(employees).map((e:any)=>e.id)).size===Object.keys(employees).length,'Provider employee IDs must be unique')
 return put(c,'paytemplates',{...(preset?{preset,iif}:{}),name:text(p.name,'template name',80),approved,classification,format,timeFormat,delimiter,header:p.header,columns,groupBy:p.groupBy,dateFormat,decimals,employees,codes:mapping(p.codes,'earning code'),jobs:mapping(p.jobs,'job code'),locations:mapping(p.locations,'location code'),by:c.a.id,at:c.now,versions:old?[...(old.versions??[]),{...old,versions:undefined}]:[]},old)
}
export function templateSnapshot(c:Context,id:unknown){
 need(c.a.role==='owner','Only the payroll administrator (the owner) prepares mapped payroll',403)
 const {versions,...t}=get(c.s,'paytemplates',id);need(t.approved===true,'Template is not owner-approved; review and approve this revision before output',409);return t
}
export function templateMappingIssues(t:Row,lines:any[]) {
 const issues:{kind:string;key:string;staffId:string;timeId?:string;message:string}[]=[]
 const add=(kind:string,key:string,l:any,message:string)=>{if(!issues.some(x=>x.kind===kind&&x.key===key))issues.push({kind,key,staffId:l.staffId,timeId:l.timeId,message})}
 for(const l of lines){
  const e=own(t.employees,l.staffId),code=l.earningCode??l.payCode??'regular',job=l.job??l.rateBasis?.job??'',site=l.site??l.rateBasis?.site??''
  if(!e)add('employee',l.staffId,l,'Unmapped employee; update the template')
  else if(!['W-2','1099'].includes(e.workflow))add('classification',l.staffId,l,'Worker classification is unclassified; owner review is required before output')
  if(!own(t.codes,code))add('code',code,l,`Unmapped earning code: ${code}`)
  if(job&&!own(t.jobs,job))add('job',job,l,'Unmapped job; update the template')
  if(site&&!own(t.locations,site)&&t.format!=='iif')add('location',site,l,'Unmapped location; update the template')
 }
 return issues
}
function escaped(v:any,delimiter:string,numeric=false){
 let value=String(v??'');if(!numeric&&/^[\s]*[=+\-@\t\r]/.test(value))value="'"+value
 return value.includes(delimiter)||/["\r\n]/.test(value)?'"'+value.replaceAll('"','""')+'"':value
}
/** Separate workflows and retained rates never collapse into a blended amount.
 * Contractor exports support worked regular time only; no tax treatment is applied. */
function mappedTable(c:Context,lines:any[],t:Row){
 const groups=new Map<string,any>()
 const issues=templateMappingIssues(t,lines);need(!issues.length,issues[0]?.message??'Template mapping requires review',409)
 for(const l of lines){
  const employee=own(t.employees,l.staffId);need(employee,'Unmapped employee; update the template',409)
  need(['W-2','1099'].includes(employee.workflow),'Worker classification is unclassified; owner review is required before output',409)
  const sourceCode=l.earningCode??l.payCode??'regular',code=own(t.codes,sourceCode);need(code,`Unmapped earning code: ${sourceCode}`,409)
  need(employee.workflow!=='1099'||sourceCode==='regular','Contractor workflow supports regular worked time only; review other earnings separately',409)
  const job=l.job??l.rateBasis?.job??'',location=l.site??l.rateBasis?.site??''
  const columns=t.columns.map((x:any)=>x.field)
  const mappedJob=job?own(t.jobs,job):'',mappedLocation=location?own(t.locations,location):''
  need(!job||mappedJob,'Unmapped job; update the template',409)
  need(!location||mappedLocation,'Unmapped location; update the template',409)
  const date=l.date??localDate(l.start,c.s.timezone),parts=date.split('-'),formatted=t.dateFormat==='us'?`${parts[1]}/${parts[2]}/${parts[0]}`:t.dateFormat==='eu'?`${parts[2]}/${parts[1]}/${parts[0]}`:date
  // A source's approved earnings amount is authoritative. Worked-time amounts
  // require the retained source rate; unknown amounts are refused when requested.
  const rates=l.rateBasis?.segments??[],known=rates.length&&rates.every((r:any)=>r.cents!==null),total=rates.reduce((n:number,r:any)=>n+r.minutes,0)
  need(!columns.includes('amount')||l.classifiedWorked||l.payCode||!l.corrects,'Signed worked-time amount reconciliation is not supported; export minutes instead',409)
  const amount=l.costCents??(known&&total?Math.round(l.minutes*rates.reduce((n:number,r:any)=>n+r.minutes*r.cents,0)/total/60):null)
  need(!columns.includes('amount')||amount!==null,'Missing retained earnings amount',409)
  const time=(v:string)=>t.timeFormat==='utc-minute'?v.slice(0,16).replace('T',' '):t.timeFormat==='utc-time'?v.slice(11,19):v
  const r={periodId:l.periodId??'',week:l.week??'',rateCents:l.rateCents??'',multiplier:l.multiplier??'',employee:employee.id,workflow:employee.workflow,code,date:formatted,start:time(l.sourceStart??l.start),end:time(l.sourceEnd??l.end),minutes:l.minutes,amount,job:mappedJob,location:mappedLocation,timeId:l.timeId,revision:l.revision}
  const key=canonical([r.employee,r.workflow,sourceCode,...t.groupBy.map((k:string)=>k==='date'?date:r[k as keyof typeof r]),...columns.filter((k:string)=>!['minutes','hours','amount'].includes(k)).map((k:string)=>r[k as keyof typeof r])])
  const prior=groups.get(key);if(prior){prior.minutes+=r.minutes;prior.amount=prior.amount===null||r.amount===null?null:prior.amount+r.amount}else groups.set(key,r)
 }
 const rows=[...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,r])=>r)
 for(const r of rows)need(!t.columns.some((x:any)=>x.field==='hours')||Math.round(Number((r.minutes/60).toFixed(t.decimals))*60)===r.minutes,'Number format loses payable minutes; increase decimal places',409)
 return {headers:t.columns.map((x:any)=>x.header),fields:t.columns.map((x:any)=>x.field),rows:rows.map(r=>t.columns.map((x:any)=>x.field==='hours'?(r.minutes/60).toFixed(t.decimals):x.field==='amount'?(r.amount/100).toFixed(2):r[x.field]))}
}
export function mappedFile(c:Context,lines:any[],t:Row){
 if(t.format==='iif')return iifFile(c,lines,t)
 const table=mappedTable(c,lines,t)
 const render=(row:any[],header=false)=>row.map((value,i)=>escaped(value,t.delimiter,t.format==='xlsx'||!header&&['minutes','hours','amount','revision','rateCents','multiplier'].includes(table.fields[i]))).join(t.delimiter)
 return (t.header?render(table.headers,true)+'\r\n':'')+table.rows.map(row=>render(row)).join('\r\n')+'\r\n'
}
export function mappedWorkbook(c:Context,lines:any[],t:Row){
 const table=mappedTable(c,lines,t);return base64(xlsx(table.headers,table.rows,table.fields,t.decimals,t.header))
}
export const fileExtension=(t?:Row)=>t?.format==='iif'?'iif':t?.format==='xlsx'?'xlsx':t?.format==='tsv'?'tsv':t?.format==='delimited'?'txt':'csv'

export function reviewedFile(c:Context,b:Row){
 if(!b.exportTemplate)return undefined
 need(c.a.role==='owner','Only the payroll administrator (the owner) exports mapped payroll',403)
 need(canonical(templateSnapshot(c,b.exportTemplate.id))===canonical(b.exportTemplate),'Export template changed; prepare again',409)
 return mappedFile(c,b.classificationLines??b.lines,b.exportTemplate)
}
