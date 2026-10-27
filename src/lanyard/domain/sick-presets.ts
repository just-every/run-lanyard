// LEAVE-003: explicit employer-size tiers; the owner reviews applicability.
// Minutes throughout. null is an uncapped field, never zero.
const make=(id:string,name:string,denominator:number,accrual:number|null,bank:number|null,carry:number|null,use:number|null,wait:number,increment:number,source:string,reasons=['illness','care','safe'])=>({id,name,denominator,annualAccrual:accrual===null?null:accrual*60,bankCap:bank===null?null:bank*60,carry:carry===null?null:carry*60,annualUse:use===null?null:use*60,wait,increment,reasons,source,version:'2026-10-27',paid:true,label:'Employer-reviewed statutory preset; paid tier'})
// Keep categories broad: the request never collects diagnoses, family names or case details.
const health=['illness','care','safe','preventive care']
const oregon=[...health,'bereavement','parental leave','public health closure','public health exclusion','evacuation','emergency evacuation','hazardous air or heat','blood donation']
const washington=[...health,'public health closure','emergency closure','immigration proceeding']
const unpaid=(preset:ReturnType<typeof make>,name:string)=>({...preset,id:preset.id+'_UNPAID',name,paid:false,label:'Employer-reviewed statutory preset; unpaid protected time'})
type Preset=ReturnType<typeof make>&{grantMinutes?:number;grantDays?:number}
export const sickPresets:Preset[]=[
 make('CA','California',30,null,80,80,40,90,60,'https://www.dir.ca.gov/dlse/paid_sick_leave.htm',['illness','care','safe','preventive care','jury duty','court witness']),
 make('CO','Colorado',30,48,null,48,48,0,60,'https://cdle.colorado.gov/dlss/paid-leave-under-the-healthy-families-and-workplaces-act-hfwa',[...health,'public health closure','bereavement','school or care closure','evacuation']),
 make('IL','Illinois · Paid Leave for All Workers Act',40,40,null,40,40,90,60,'https://labor.illinois.gov/laws-rules/paidleave.html',['any']),
 make('NY40','New York State · 5–99 employees or small-employer paid tier',30,40,null,null,40,0,60,'https://www.ny.gov/programs/new-york-paid-sick-leave',health),
 make('NY','New York State · 100+ employee paid tier',30,56,null,null,56,0,60,'https://www.ny.gov/programs/new-york-paid-sick-leave',health),
 make('OR','Oregon · paid sick time',30,40,80,40,40,90,60,'https://www.oregon.gov/boli/workers/pages/sick-time.aspx',oregon),
 make('WA','Washington',40,null,null,40,null,90,60,'https://www.lni.wa.gov/workers-rights/leave/paid-sick-leave/',washington),
 make('NYC40','New York City · 5–99 employees or small-employer paid tier',30,40,null,40,40,0,60,'https://www.nyc.gov/site/dca/about/paid-sick-leave-law.page',[...health,'public health closure','childcare','child care','disability care','public disaster','housing or benefits proceeding','housing or benefits appointment','workplace violence']),
 make('NYC','New York City · 100+ employee paid tier',30,56,null,56,56,0,60,'https://www.nyc.gov/site/dca/about/paid-sick-leave-law.page',[...health,'public health closure','childcare','child care','disability care','public disaster','housing or benefits proceeding','housing or benefits appointment','workplace violence']),
 make('CHICAGO','Chicago · paid sick leave bank',35,40,null,80,null,30,60,'https://www.chicago.gov/city/en/depts/bacp/supp_info/paidleaveordinance.html',[...health,'public health closure','public health exclusion']),
 make('SEATTLE1','Seattle · tier 1 (1–49 full-time equivalents)',40,null,null,40,null,90,60,'https://www.seattle.gov/laborstandards/ordinances/paid-sick-and-safe-time',[...health,'public health closure','school or care closure']),
 make('SEATTLE2','Seattle · tier 2 (50–249 full-time equivalents)',40,null,null,56,null,90,60,'https://www.seattle.gov/laborstandards/ordinances/paid-sick-and-safe-time',[...health,'public health closure','school or care closure']),
 make('SEATTLE','Seattle · tier 3 standalone sick bank',30,null,null,72,null,90,60,'https://www.seattle.gov/laborstandards/ordinances/paid-sick-and-safe-time',[...health,'public health closure','school or care closure']),
 make('SEATTLE_PTO1','Seattle · tier 1 combined PTO',40,null,null,40,null,90,60,'https://www.seattle.gov/laborstandards/ordinances/paid-sick-and-safe-time',[...health,'public health closure','school or care closure','employer-approved PTO']),
 make('SEATTLE_PTO2','Seattle · tier 2 combined PTO',40,null,null,56,null,90,60,'https://www.seattle.gov/laborstandards/ordinances/paid-sick-and-safe-time',[...health,'public health closure','school or care closure','employer-approved PTO']),
 make('SEATTLE_PTO3','Seattle · tier 3 combined PTO',30,null,null,108,null,90,60,'https://www.seattle.gov/laborstandards/ordinances/paid-sick-and-safe-time',[...health,'public health closure','school or care closure','employer-approved PTO']),
 make('SF','San Francisco · state/local paid floor',30,null,80,80,null,90,60,'https://www.sf.gov/information/understanding-paid-sick-leave',['illness','care','safe','preventive care','jury duty','court witness','organ or tissue donation']),
 make('LA','Los Angeles · state/local paid floor',30,null,80,80,48,90,60,'https://wagesla.lacity.org/',['illness','care','safe','preventive care','jury duty','court witness']),
 make('PHILADELPHIA','Philadelphia · paid tier',40,40,null,40,40,90,60,'https://www.phila.gov/documents/paid-sick-leave-information/',health)
]
sickPresets.push({...make('NY_PRENATAL','New York State and NYC · separate paid prenatal bank',1,0,20,0,20,0,60,'https://www.nyc.gov/site/dca/about/paid-sick-leave-FAQs.page',['prenatal care']),label:'Employer-reviewed separate paid prenatal bank',grantMinutes:1200,grantDays:364})
sickPresets.push({...make('NYC_UPFRONT','New York City · additional 32 immediately available unpaid hours',1,0,32,0,32,0,60,'https://www.nyc.gov/site/dca/about/paid-sick-leave-FAQs.page',[...health,'public health closure','childcare','child care','disability care','public disaster','housing or benefits proceeding','housing or benefits appointment','workplace violence']),paid:false,label:'Employer-reviewed NYC supplemental unpaid bank',grantMinutes:1920})
// Small employers still owe a protected bank even when their tier does not require pay.
// Oregon's threshold is ten employees statewide, or six with a Portland location.
// New York's unpaid tier additionally requires prior-year net income at most $1 million.
for(const [base,name] of [
 ['NY40','New York State · 1–4 employees, net income at most $1 million · unpaid'],
 ['NYC40','New York City · 1–4 employees, income below $1 million, non-domestic · unpaid base bank'],
 ['OR','Oregon · fewer than 10 without Portland, fewer than 6 with Portland · unpaid'],
 ['PHILADELPHIA','Philadelphia · fewer than 10 employees, non-chain · unpaid']
])sickPresets.push(unpaid(sickPresets.find(p=>p.id===base)!,name))

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

/** Refuse a selected base tier that would withhold the required paid entitlement.
 * Larger paid tiers may always be chosen voluntarily. Headcounts are employer
 * records, never inferred from how many people happen to be installed here. */
export function sickCoverage(id:string,p:Record<string,any>,need:(v:unknown,m:string,status?:number)=>void,integer:(v:unknown,l:string,min:number,max:number)=>number){
 const reviewed=['NY40','NYC40','NY40_UNPAID','NYC40_UNPAID','OR_UNPAID','PHILADELPHIA_UNPAID'].includes(id)
 if(!reviewed)return undefined
 const employeeCount=integer(Number(p.employeeCount),'employer employee count',1,10000000)
 const flag=(key:string)=>{need(['yes','no'].includes(p[key]),'Review '+key);return p[key]==='yes'}
 const coverage:Record<string,any>={employeeCount}
 if(id.startsWith('NY')){
  need(employeeCount<100,'Employers with 100 or more employees must choose the 56-hour tier')
  if(id.endsWith('_UNPAID')){
   coverage.incomeAboveMillion=flag('incomeAboveMillion')
   need(employeeCount<5&&!coverage.incomeAboveMillion,'This employer requires a paid New York tier')
   if(id.startsWith('NYC')){coverage.domesticWorkers=flag('domesticWorkers');need(!coverage.domesticWorkers,'NYC domestic workers require a paid tier')}
  }
 }
 if(id==='OR_UNPAID'){coverage.portland=flag('portland');need(employeeCount<(coverage.portland?6:10),'This employer requires paid Oregon sick time')}
 if(id==='PHILADELPHIA_UNPAID'){coverage.chainLocations=integer(Number(p.chainLocations),'chain establishments',0,10000000);need(employeeCount<10&&coverage.chainLocations<15,'This employer requires paid Philadelphia sick time')}
 return coverage
}
