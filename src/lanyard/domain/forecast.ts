// A manager's sales forecast for one cafe's week (Mon–Sun, whole dollars) and its
// labor budget; the schedule's footer divides scheduled labor cost by it.
import {type Context,keys,text,need,manager,integer,put} from './model'
import {salesSite} from './sales'

export function forecast(c:Context,name:string,p:Record<string,any>) {
 if(name!=='forecast.save')return undefined
 manager(c.a);keys(p,['week','site','days','budgetPercent','burdenPercent','burdenPerHourCents','revision'])
 const site=text(p.site,'site',80,true);need(salesSite(c.s,c.a,site),'Not found',404)
 const week=text(p.week,'week',10),monday=new Date(week+'T00:00:00Z')
 need(/^\d{4}-\d{2}-\d{2}$/.test(week)&&monday.toISOString().slice(0,10)===week&&monday.getUTCDay()===1,'Week must be a Monday YYYY-MM-DD')
 need(Array.isArray(p.days)&&p.days.length===7,'Provide seven daily forecasts, Monday to Sunday')
 const days=p.days.map((v:unknown)=>integer(typeof v==='string'&&v.trim()!==''?Number(v.replace(/[$,]/g,'')):v,'daily forecast',0,10_000_000))
 const budgetPercent=p.budgetPercent===undefined||p.budgetPercent===''?null:Number(p.budgetPercent)
 need(budgetPercent===null||(Number.isFinite(budgetPercent)&&budgetPercent>0&&budgetPercent<=100),'Invalid labor budget')
 const old=c.s.forecasts.find(f=>f.week===week&&f.site===site)
 if(p.revision!==undefined)need(Number(p.revision)===(old?.revision??0),'Forecast or burden changed; reload before saving',409)
 const percent=p.burdenPercent===undefined?old?.burdenPercent:p.burdenPercent===''?undefined:Number(p.burdenPercent)
 const hourly=p.burdenPerHourCents===undefined?old?.burdenPerHourCents:p.burdenPerHourCents===''?undefined:Number(p.burdenPerHourCents)
 need(percent===undefined||Number.isFinite(percent)&&percent>=0&&percent<=100&&Math.round(percent*100)/100===percent,'Burden percentage must be 0 to 100 with up to two decimals')
 need(hourly===undefined||Number.isSafeInteger(hourly)&&hourly>=0&&hourly<=999999,'Burden per hour must be whole USD cents')
 const previous=old?Object.fromEntries(Object.entries(old).filter(([key])=>key!=='versions')):null
 return put(c,'forecasts',{week,site,days,budgetPercent,...(percent===undefined?{}:{burdenPercent:percent}),...(hourly===undefined?{}:{burdenPerHourCents:hourly}),savedBy:c.a.id,savedAt:c.now,versions:old?[...(old.versions??[]),previous]:[]},old)
}
