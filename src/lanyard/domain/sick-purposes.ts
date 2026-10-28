import {type Row} from './model'

// Broad categories avoid diagnoses, names of relatives and case details. The
// retained guidance describes applicability without collecting that evidence.
const health:Record<string,string>={
 illness:'Your mental or physical illness, injury or health condition, including diagnosis, treatment and recovery.',
 care:'Care, diagnosis, treatment or preventive care for a person covered by this jurisdiction’s family definition.',
 safe:'Qualifying violence, abuse, assault, stalking or trafficking: medical or victim services, counseling, safety planning, relocation, legal assistance and related proceedings, as allowed by the cited rule.',
 'preventive care':'Preventive healthcare for you or a covered family member.',
 'jury duty':'Required jury service.',
 'court witness':'An appearance required by subpoena or court order as a witness.',
 'victim proceeding':'Qualifying judicial proceedings for you or a covered family member who is a crime victim.',
 bereavement:'A covered family member’s death: grieving, funeral arrangements and related financial or legal needs.',
 'parental leave':'Care for a new child following birth, adoption or foster placement within the applicable first year.',
 'public health closure':'An authorized health-related workplace closure, or care for a child whose school or place of care is closed.',
 'public health exclusion':'A qualifying public-health determination or order that presence would jeopardize others; includes required isolation or quarantine.',
 'emergency closure':'Workplace, child school or care closure following a declared government emergency.',
 'school or care closure':'Care for a covered family member following a qualifying school or place-of-care closure.',
 evacuation:'Evacuating your home because of a qualifying emergency, weather event or loss of essential services.',
 'hazardous air or heat':'Qualifying dangerous heat, air quality or evacuation conditions under the Oregon rule.',
 'blood donation':'Voluntary blood donation under the Oregon sick-time rule.',
 'immigration proceeding':'Preparing for or participating in a judicial or administrative immigration proceeding involving you or a covered family member.',
 childcare:'Care for your child, including a child under 18 or an older child incapable of self-care because of disability.',
 'public disaster':'Remaining home during a qualifying public disaster under the NYC rule.',
 'housing or benefits proceeding':'A qualifying appointment, hearing or proceeding for subsistence benefits or housing involving you, a family member or care recipient.',
 'business safety closure':'A tier-three Seattle employer’s workplace closure for any health or safety reason.',
 'organ or tissue donation':'Your organ or bone-marrow donation, or care for a covered donor under the San Francisco rule.',
 'prenatal care':'Healthcare during or related to your own pregnancy, including fertility treatment and end-of-pregnancy care; not a partner’s care or postnatal care.',
 any:'Any reason you choose. No explanation or documentation is requested.',
 'employer-approved PTO':'Any purpose permitted by the combined employer PTO policy.',
 'employer-approved':'A purpose permitted by the employer’s unmaintained policy.'
}
const family:Record<string,string>={
 CA:'Care includes a designated person identified by the employee, as well as covered family. Safe and victim leave depends on the applicable violence-related rule and employer coverage.',
 LA:'Care includes a person related by blood or affinity whose close association is equivalent to family, as well as California covered family and a designated person.',
 SF:'Care includes covered family and a designated person under the applicable state or local rule.',
 CO:'Family includes a person for whom you provide or arrange health or safety care, as well as covered relatives.',
 IL:'No purpose or family relationship needs to be disclosed.',
 NY:'Use New York State’s covered-family definition. Safe leave includes domestic violence, a family offense, sexual offense, stalking or human trafficking.',
 NYC:'Family includes a person whose close association is equivalent to family; covered benefit and housing proceedings may also involve a care recipient.',
 OR:'Family includes a person related by blood or affinity whose close association is equivalent to family. Closure, exclusion, parental and bereavement conditions follow the Oregon source.',
 WA:'Family includes a person who regularly resides in your home in a care relationship, and a person whose relationship creates an expectation of care and who depends on you for care.',
 SEATTLE:'Seattle family protection includes its local definition and Washington’s applicable state floor. Tier-three employers also cover any health or safety workplace closure.',
 CHICAGO:'Family includes a person related by blood or whose close association is equivalent to family. Safe leave includes sex offenses, stalking and trafficking.',
 PHILADELPHIA:'Use Philadelphia’s covered-family definition. Safe leave covers domestic abuse, sexual assault and stalking; the health-related care categories do not authorize unrelated time off.'
}
export function sickJurisdiction(id:string){
 if(id==='NY_PRENATAL')return 'NY'
 if(id.startsWith('NYC'))return 'NYC'
 if(id.startsWith('NY'))return 'NY'
 if(id.startsWith('SEATTLE'))return 'SEATTLE'
 return id.replace('_UNPAID','')
}
export function sickPurposeRules(id:string,reasons:string[]){
 const jurisdiction=sickJurisdiction(id)
 return Object.fromEntries(reasons.map(purpose=>[purpose,{
  description:health[purpose]??health['employer-approved'],
  guidance:family[jurisdiction]??'Employer-configured, unmaintained.',
  from:purpose==='blood donation'?'2026-01-01':purpose==='immigration proceeding'?'2025-07-27':purpose==='victim proceeding'?'2025-10-01':id==='NYC_UPFRONT'||['childcare','public disaster','housing or benefits proceeding'].includes(purpose)?'2026-02-22':id==='NY_PRENATAL'?'2025-01-01':'',
 }]))
}
export function sickReasons(rule:Row,on:string):string[]{return rule.reasons.filter((purpose:string)=>!rule.purposeRules?.[purpose]?.from||rule.purposeRules[purpose].from<=on)}
