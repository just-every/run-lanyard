import {BREAK_VERSION,breakSources} from './policy-breaks'
export const VERSION='2026-10-26'
export const POLICY_VERSIONS=['2026-10-24',VERSION] as const
export const sources:Record<string,string>={
 federal:'https://www.dol.gov/agencies/whd/overtime',
 CA:'https://www.dir.ca.gov/dlse/faq_overtime.htm',
 AK:'https://labor.alaska.gov/lss/whact.htm',
 NV:'https://labor.nv.gov/Employer/Employer_Information/',
 CO:'https://cdle.colorado.gov/dlss/home-page/wage-and-hour-law/overtime',
 OR:'https://www.oregon.gov/boli/employers/pages/overtime.aspx',
 WA:'https://www.lni.wa.gov/workers-rights/wages/overtime/',
 NY:'https://dol.ny.gov/overtime-pay',
 IL:'https://labor.illinois.gov/faqs/overtime-faq.html',
}
export const policyPresets=Object.entries(sources).map(([id,source])=>({id,source,version:VERSION,effectiveFrom:'2026-10-26',breakVersion:breakSources[id]?BREAK_VERSION:null,breakSources:breakSources[id]??[],scope:'Nonexempt overtime core; selected break review estimates; exemptions, alternate workdays and premium payroll incomplete'}))
