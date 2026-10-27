// LEAVE-003: explicit employer-reviewed tiers; applicability is never inferred.
// Minutes throughout. null is an uncapped field, never zero.
const make=(id:string,name:string,denominator:number,accrual:number|null,bank:number|null,carry:number|null,use:number|null,wait:number,increment:number,source:string,reasons=['illness','care','safe'])=>({id,name,denominator,annualAccrual:accrual===null?null:accrual*60,bankCap:bank===null?null:bank*60,carry:carry===null?null:carry*60,annualUse:use===null?null:use*60,wait,increment,reasons,source,version:'2026-10-27',paid:true,label:'Employer-reviewed statutory preset; paid tier'})
const nycReasons=['illness','care','safe','preventive care','public health closure','child care','disability care','housing or benefits appointment','public disaster','workplace violence']
const paidPresets=[
 make('CA','California',30,null,80,80,40,90,60,'https://www.dir.ca.gov/dlse/paid_sick_leave.htm',['illness','care','safe','preventive care','jury duty','court witness']),
 make('CO','Colorado',30,48,null,48,48,0,60,'https://cdle.colorado.gov/dlss/paid-leave-under-the-healthy-families-and-workplaces-act-hfwa'),
 make('IL','Illinois · Paid Leave for All Workers Act',40,40,null,40,40,90,60,'https://labor.illinois.gov/laws-rules/paidleave.html',['any']),
 make('NY40','New York State · 5–99 employees or small-employer paid tier',30,40,null,null,40,0,60,'https://www.ny.gov/programs/new-york-paid-sick-leave'),
 make('NY','New York State · 100+ employee paid tier',30,56,null,null,56,0,60,'https://www.ny.gov/programs/new-york-paid-sick-leave'),
 make('OR','Oregon · paid sick time',30,40,80,40,40,90,60,'https://www.oregon.gov/boli/workers/pages/sick-time.aspx',['illness','care','safe','preventive care','bereavement','parental leave','public health closure','public health exclusion','emergency evacuation','hazardous air or heat','blood donation']),
 make('WA','Washington',40,null,null,40,null,90,60,'https://www.lni.wa.gov/workers-rights/leave/paid-sick-leave/',['illness','care','safe','preventive care','public health closure','immigration proceeding']),
 make('NYC40','New York City · 5–99 employees or small-employer paid tier',30,40,null,40,40,0,60,'https://www.nyc.gov/site/dca/about/paid-sick-leave-FAQs.page',nycReasons),
 make('NYC','New York City · 100+ employee paid tier',30,56,null,56,56,0,60,'https://www.nyc.gov/site/dca/about/paid-sick-leave-FAQs.page',nycReasons),
 make('CHICAGO','Chicago · paid sick leave bank',35,40,null,80,null,30,60,'https://www.chicago.gov/city/en/depts/bacp/supp_info/paidleaveordinance.html'),
 make('SEATTLE1','Seattle · tier 1 (1–49 full-time equivalents)',40,null,null,40,null,90,60,'https://www.seattle.gov/laborstandards/ordinances/paid-sick-and-safe-time'),
 make('SEATTLE2','Seattle · tier 2 (50–249 full-time equivalents)',40,null,null,56,null,90,60,'https://www.seattle.gov/laborstandards/ordinances/paid-sick-and-safe-time'),
 make('SEATTLE','Seattle · tier 3 standalone sick bank',30,null,null,72,null,90,60,'https://www.seattle.gov/laborstandards/ordinances/paid-sick-and-safe-time'),
 make('SEATTLE_PTO1','Seattle · tier 1 combined PTO',40,null,null,40,null,90,60,'https://www.seattle.gov/laborstandards/ordinances/paid-sick-and-safe-time',['illness','care','safe','employer-approved PTO']),
 make('SEATTLE_PTO2','Seattle · tier 2 combined PTO',40,null,null,56,null,90,60,'https://www.seattle.gov/laborstandards/ordinances/paid-sick-and-safe-time',['illness','care','safe','employer-approved PTO']),
 make('SEATTLE_PTO3','Seattle · tier 3 combined PTO',30,null,null,108,null,90,60,'https://www.seattle.gov/laborstandards/ordinances/paid-sick-and-safe-time',['illness','care','safe','employer-approved PTO']),
 make('SF','San Francisco · state/local paid floor',30,null,80,80,null,90,60,'https://www.sf.gov/information/understanding-paid-sick-leave',['illness','care','safe','preventive care','jury duty','court witness']),
 make('LA','Los Angeles · state/local paid floor',30,null,80,80,48,90,60,'https://wagesla.lacity.org/',['illness','care','safe','preventive care','jury duty','court witness']),
 make('PHILADELPHIA','Philadelphia · paid tier',40,40,null,40,40,90,60,'https://www.phila.gov/documents/paid-sick-leave-information/')
]

// Unpaid protection accrues and consumes the same bank, without creating paid
// service or a payroll source. The owner selects the cited applicability tier.
const unpaid=(base:string,id:string,name:string,coverage:string)=>{
 const p=paidPresets.find(p=>p.id===base)!
 return {...p,id,name,paid:false,label:'Employer-reviewed statutory preset; unpaid tier',coverage}
}
export const sickPresets=[
 ...paidPresets,
 unpaid('NY40','NY_UNPAID','New York State · unpaid small-employer tier','1–4 employees and prior tax-year net income of $1 million or less; domestic workers require the paid tier.'),
 unpaid('NYC40','NYC_UNPAID','New York City · unpaid small-employer tier','1–4 employees and prior tax-year net income below $1 million; domestic workers require the paid tier.'),
 unpaid('OR','OR_UNPAID','Oregon · unpaid small-employer tier','Below 10 Oregon employees, or below 6 if the employer has a Portland location, under the cited 20-week count rule.'),
 unpaid('PHILADELPHIA','PHILADELPHIA_UNPAID','Philadelphia · unpaid small-employer tier','Fewer than 10 employees; chain establishments and other coverage exceptions require review of the cited source.'),
 {...unpaid('NYC40','NYC_SUPPLEMENTAL','New York City · 32 immediately available unpaid hours','Additional bank for covered NYC employees, from February 22, 2026; renewed January 1 independently of the accrued bank.'),bank:'supplemental',grantMinutes:1920,notBefore:'2026-02-22',annualAccrual:0,bankCap:1920,carry:0,annualUse:1920,wait:0}
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
