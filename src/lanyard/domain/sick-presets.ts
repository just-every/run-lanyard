// LEAVE-003: explicit conservative paid-tier defaults; employer reviews applicability.
// Minutes throughout. null is an uncapped field, never zero.
const make=(id:string,name:string,denominator:number,accrual:number|null,bank:number|null,carry:number|null,use:number|null,wait:number,increment:number,source:string,reasons=['illness','care','safe'])=>({id,name,denominator,annualAccrual:accrual===null?null:accrual*60,bankCap:bank===null?null:bank*60,carry:carry===null?null:carry*60,annualUse:use===null?null:use*60,wait,increment,reasons,source,version:'2026-10-23',label:'Employer-reviewed statutory preset; paid tier'})
export const sickPresets=[
 make('CA','California',30,null,80,80,40,90,60,'https://www.dir.ca.gov/dlse/paid_sick_leave.htm'),
 make('CO','Colorado',30,48,null,48,48,0,60,'https://cdle.colorado.gov/dlss/paid-leave-under-the-healthy-families-and-workplaces-act-hfwa'),
 make('IL','Illinois · Paid Leave for All Workers Act',40,40,null,40,40,90,60,'https://labor.illinois.gov/laws-rules/paidleave.html',['any']),
 make('NY40','New York State · 5–99 employees or small-employer paid tier',30,40,null,null,40,0,60,'https://www.ny.gov/programs/new-york-paid-sick-leave'),
 make('NY','New York State · 100+ employee paid tier',30,56,null,null,56,0,60,'https://www.ny.gov/programs/new-york-paid-sick-leave'),
 make('OR','Oregon · paid sick time',30,40,80,40,40,90,60,'https://www.oregon.gov/boli/workers/pages/sick-time.aspx'),
 make('WA','Washington',40,null,null,40,null,90,60,'https://www.lni.wa.gov/workers-rights/leave/paid-sick-leave/'),
 make('NYC40','New York City · 5–99 employees or small-employer paid tier',30,40,null,40,40,0,60,'https://www.nyc.gov/site/dca/about/paid-sick-leave-law.page'),
 make('NYC','New York City · 100+ employee paid tier',30,56,null,56,56,0,60,'https://www.nyc.gov/site/dca/about/paid-sick-leave-law.page'),
 make('CHICAGO','Chicago · paid sick leave bank',35,40,null,80,null,30,60,'https://www.chicago.gov/city/en/depts/bacp/supp_info/paidleaveordinance.html'),
 make('SEATTLE1','Seattle · tier 1 (1–49 full-time equivalents)',40,null,null,40,null,90,60,'https://www.seattle.gov/laborstandards/ordinances/paid-sick-and-safe-time'),
 make('SEATTLE2','Seattle · tier 2 (50–249 full-time equivalents)',40,null,null,56,null,90,60,'https://www.seattle.gov/laborstandards/ordinances/paid-sick-and-safe-time'),
 make('SEATTLE','Seattle · tier 3 standalone sick bank',30,null,null,72,null,90,60,'https://www.seattle.gov/laborstandards/ordinances/paid-sick-and-safe-time'),
 make('SF','San Francisco · state/local paid floor',30,null,80,80,null,90,60,'https://www.sf.gov/information/understanding-paid-sick-leave'),
 make('LA','Los Angeles · state/local paid floor',30,null,80,80,48,90,60,'https://wagesla.lacity.org/'),
 make('PHILADELPHIA','Philadelphia · paid tier',40,40,null,40,40,90,60,'https://www.phila.gov/documents/paid-sick-leave-information/')
]

/** California's day floor also applies under its local ordinances. The owner
 * supplies at least the longest normal workday covered by this site policy;
 * over-granting shorter-day employees cannot undercut their statutory floor. */
export function sickPreset(id:string,normalDayMinutes:number){
 const preset=sickPresets.find(p=>p.id===id)
 if(!preset)return undefined
 if(!['CA','SF','LA'].includes(id))return {...preset,normalDayMinutes}
 const bankCap=Math.max(preset.bankCap??0,normalDayMinutes*10)
 return {...preset,normalDayMinutes,bankCap,carry:bankCap,annualUse:preset.annualUse===null?null:Math.max(preset.annualUse,normalDayMinutes*5)}
}
