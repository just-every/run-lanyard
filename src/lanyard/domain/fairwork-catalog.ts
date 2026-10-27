/** Source-reviewed core coverage. These releases are retained in each employer decision. */
export const FAIRWORK_VERSION='2026-10-27'
export const fairworkPresets=[
 {id:'Seattle',name:'Seattle Secure Scheduling',industries:['retail','food-service','full-service-restaurant'],employees:500,locations:40,noticeDays:14,restMinutes:600,accessToHours:true,source:'https://www.seattle.gov/laborstandards/ordinances/secure-scheduling'},
 {id:'Oregon',name:'Oregon predictive scheduling',industries:['retail','hospitality','food-service'],employees:500,locations:0,noticeDays:14,restMinutes:600,accessToHours:false,source:'https://www.oregon.gov/boli/workers/pages/predictive-scheduling.aspx'},
 {id:'San-Jose',name:'San Jose Opportunity to Work',industries:['all'],employees:36,locations:0,noticeDays:0,restMinutes:0,accessToHours:true,source:'https://www.sanjoseca.gov/your-government/departments-offices/public-works/labor-compliance/opportunity-to-work'},
] as const
export function fairworkCoverage(preset:string,industry:string,employees:number,locations:number,localEmployees:number,subjectToBusinessTax:boolean){
 const rule=fairworkPresets.find(r=>r.id===preset)
 if(!rule)return {covered:false,label:'Employer-configured, unmaintained',rule:null}
 const covered=employees>=rule.employees&&(rule.id==='San-Jose'?localEmployees>0&&subjectToBusinessTax:(rule.industries as readonly string[]).includes(industry)&&(industry!=='full-service-restaurant'||locations>=rule.locations))
 return {covered,label:covered?'Covered by selected core preset':'Below coverage or outside selected industry',rule:{...rule,version:FAIRWORK_VERSION}}
}
