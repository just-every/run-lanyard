type Issue={kind:string;state:'unknown'|'exception';message:string}

/** WAC 296-126-092(3) is additional to the five-hour meal spacing rule.
 * A shift's length alone never establishes the employee's normal workday. */
export function washingtonExtraMeal(normalMinutes:number|undefined,workedMinutes:number,timed:boolean,qualifyingMeals:number,issues:Issue[]){
 if(!normalMinutes)return {kind:'meal eligibility' as const,state:'unknown' as const,message:'Additional Washington meal eligibility requires the employer-reviewed normal workday; no normal length is inferred from this shift'}
 if(workedMinutes-normalMinutes<180)return null
 if(!timed)return {kind:'meal' as const,state:'unknown' as const,message:'At least one additional 30-minute meal is required before or during work three or more hours beyond the reviewed normal workday; timing is not recorded'}
 if(qualifyingMeals<2&&!issues.some(i=>i.kind==='meal'&&/^Meal [2-9]:/.test(i.message)))return {kind:'meal' as const,state:'exception' as const,message:'Missed or short additional 30-minute meal before or during work three or more hours beyond the reviewed normal workday'}
 return null
}
