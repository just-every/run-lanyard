import {need,integer} from './model'

// Owners record the statutory count basis, not merely this installation's roster.
// Missing facts never select an unpaid tier; domestic workers retain paid leave.
export function sickCoverage(preset:string,p:Record<string,any>){
 if(!['NY_UNPAID','NYC_UNPAID','OR_UNPAID','PHILADELPHIA_UNPAID'].includes(preset))return undefined
 const employeeCount=integer(Number(p.employeeCount),'covered employer employee count',1,1000000)
 const yesNo=(value:any,label:string)=>{need([true,false,'true','false'].includes(value),'Explicit '+label+' required');return value===true||value==='true'}
 if(preset==='NY_UNPAID'||preset==='NYC_UNPAID'){
  need(['below1m','exact1m','above1m'].includes(p.incomeBand),'Choose prior tax-year net income band')
  const domesticWorkers=yesNo(p.domesticWorkers,'domestic-worker status')
  need(employeeCount<=4&&!domesticWorkers&&(preset==='NY_UNPAID'?p.incomeBand!=='above1m':p.incomeBand==='below1m'),'This employer requires paid protection; choose a paid tier',409)
  return {employeeCount,incomeBand:p.incomeBand,domesticWorkers}
 }
 if(preset==='OR_UNPAID'){
  const portlandLocation=yesNo(p.portlandLocation,'Portland-location status')
  need(employeeCount<(portlandLocation?6:10),'This employer requires paid protection; choose a paid tier',409)
  return {employeeCount,portlandLocation}
 }
 const chainLocations=integer(Number(p.chainLocations),'chain establishment count',1,1000000)
 need(employeeCount<10&&chainLocations<15,'This employer requires paid protection; choose a paid tier',409)
 return {employeeCount,chainLocations}
}
