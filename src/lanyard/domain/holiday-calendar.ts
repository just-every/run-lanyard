// PAYRULE-002: editable employer calendar; the federal seed is an observed-date starting point.
// Source: https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/
import {type Context,keys,text,need,integer,get,exact,put} from './model'
import {date,dayAfter} from './aca'
export function federalHolidays(year:number) {
 const fixed=(month:number,day:number)=>`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
 const nth=(month:number,weekday:number,n:number)=>{const first=fixed(month,1);return dayAfter(first,(weekday-new Date(first+'T12:00Z').getUTCDay()+7)%7+(n-1)*7)}
 const observed=(d:string)=>{const w=new Date(d+'T12:00Z').getUTCDay();return dayAfter(d,w===6?-1:w===0?1:0)}
 const mayLast=fixed(5,31)
 return [[observed(fixed(1,1)),"New Year's Day"],[nth(1,1,3),'Martin Luther King Jr. Day'],[nth(2,1,3),"Washington’s Birthday"],[dayAfter(mayLast,-((new Date(mayLast+'T12:00Z').getUTCDay()+6)%7)),'Memorial Day'],[observed(fixed(6,19)),'Juneteenth National Independence Day'],[observed(fixed(7,4)),'Independence Day'],[nth(9,1,1),'Labor Day'],[nth(10,1,2),'Columbus Day'],[year<1978?nth(10,1,4):observed(fixed(11,11)),'Veterans Day'],[nth(11,4,4),'Thanksgiving Day'],[observed(fixed(12,25)),'Christmas Day']].filter(([,name])=>!(name==='Martin Luther King Jr. Day'&&year<1986)&&!(name==='Juneteenth National Independence Day'&&year<2021)).map(([date,name])=>({date,name}))
}
export function holidayCalendar(c:Context,name:string,p:Record<string,any>) {
 if(!['holiday.seed','holiday.save','holidayrule.save'].includes(name))return undefined
 need(c.a.role==='owner','Only the payroll administrator (the owner) can do this',403)
 const site=text(p.site,'site',80,true)
 if(name==='holiday.seed') {
  keys(p,['site','year']);const year=integer(Number(p.year),'year',1971,9998),created=[]
  for(const h of federalHolidays(year))if(!c.s.holidays.some(r=>r.site===site&&r.date===h.date))created.push(put(c,'holidays',{...h,site,enabled:true,source:'federal',by:c.a.id,at:c.now}))
  return {created}
 }
 if(name==='holiday.save') {
  keys(p,['id','revision','site','date','name','enabled']);const old=p.id?get(c.s,'holidays',p.id):undefined;if(old)exact(old,p)
  const on=date(p.date,'holiday date'),enabled=p.enabled===true||p.enabled==='true'||p.enabled==='on'
  need(!c.s.holidays.some(r=>r.id!==old?.id&&r.site===site&&r.date===on),'One holiday per site and date; edit the existing holiday',409)
  return put(c,'holidays',{site,date:on,name:text(p.name,'holiday name',80),enabled,source:old?.source??'company',by:c.a.id,at:c.now,versions:old?[...(old.versions??[]),{...old,versions:undefined}]:[]},old)
 }
 keys(p,['id','revision','site','from','mode','value','nonWorkMinutes','beforeAfter','code']);const old=p.id?get(c.s,'holidayrules',p.id):undefined;if(old)exact(old,p)
 const from=date(p.from,'effective date');need(['multiplier','added'].includes(p.mode),'Choose multiplier or added rate')
 const value=Number(p.value);need(Number.isFinite(value)&&(p.mode==='multiplier'?value>=1&&value<=10&&Number(value.toFixed(2))===value:Number.isSafeInteger(value)&&value>=0&&value<=999999),'Use a multiplier from 1–10 (two decimals) or added USD cents per hour')
 need(!c.s.holidayrules.some(r=>r.id!==old?.id&&r.site===site&&r.from===from),'A rule already starts on this site/date',409)
 return put(c,'holidayrules',{site,from,mode:p.mode,value,nonWorkMinutes:integer(Number(p.nonWorkMinutes),'non-work paid minutes',0,1440),beforeAfter:p.beforeAfter===true||p.beforeAfter==='true'||p.beforeAfter==='on',code:text(p.code,'pay code',80),by:c.a.id,at:c.now,versions:old?[...(old.versions??[]),{...old,versions:undefined}]:[]},old)
}
