import {h,disclosure,person} from './shared'
import {money} from './format'

const estimate=(cents:any)=>cents===null||cents===undefined?'Unknown':money(cents)
function calculation(r:any){
 const issues=[...(r.coverage?.issues??[]),...(r.alternateReviews??[]).filter((v:any)=>v.reviewRequired).map((v:any)=>v.reviewReason),...(r.breakReviews??[]).flatMap((b:any)=>b.issues.map((i:any)=>`${b.date} · ${i.state}: ${i.message}`))]
 return `<p>${h(r.regularMinutes)} regular · ${h(r.overtimeMinutes)} overtime · ${h(r.doubleMinutes)} double-time minutes</p><p>Wage estimate <strong>${h(estimate(r.estimateCents))}</strong> · break premium estimate ${h(estimate(r.breakPremiumEstimateCents))}</p><p>${h(issues.length)} meal and rest review issues · ${h((r.weeklyRestReviews??[]).length)} weekly-rest review issues${r.classificationIncomplete?' · classification incomplete':''}</p>${issues.length?`<ul>${issues.map((i:string)=>`<li>${h(i)}</li>`).join('')}</ul>`:''}${(r.weeklyRestReviews??[]).map((i:any)=>`<p>${h(i.message)}</p>`).join('')}`
}

export function policyWorkweeks(s:any,review:any){
 return review.calculations.length?review.calculations.map((r:any)=>`<article data-policy-workweek><h3>${h(person(s,r.staffId))} · workweek ${h(r.week)}</h3><table class="list stack"><thead><tr><th>Before</th><th>After applying</th></tr></thead><tbody><tr><td data-label="Before">${calculation(r.before)}</td><td data-label="After applying">${calculation(r.after)}</td></tr></tbody></table>${disclosure('Calculation inputs and retained sources',`<pre>${h(JSON.stringify({before:{parts:r.before.parts,coverage:r.before.coverage},after:{parts:r.after.parts,coverage:r.after.coverage}},null,2))}</pre>`)}</article>`).join(''):'<p>No recorded open workweeks are affected. Pending work and open captures still bind this review.</p>'
}

