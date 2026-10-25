import {coverageKinds,coverageLabels} from '../domain/policy-coverage'
import {h,card,form,field,hidden,textarea,exact,disclosure,staffSelect,person} from './shared'
import {policyWorkweeks} from './policy-review'

export function workerPolicySettings(s:any,p:any,q:URLSearchParams,extras:any,back:string){
 if(!p)return ''
 const input=extras.result?.workerInput,preview=extras.result?.workerPreview
 const staffId=String(input?.staffId??q.get('worker')??''),profile=p.coverage?.find((r:any)=>r.staffId===staffId)
 const pick=`<form method="get" action="/app/settings">${hidden('site',p.site)}${hidden('preset',p.preset)}${staffSelect(s,staffId,'worker','Review a person').replace('<select ', '<select aria-label="Review a person" ')}<button type="submit" class="secondary">Open applicability review</button></form>`
 const v={from:p.from,...Object.fromEntries(coverageKinds.map(k=>[k,profile?.[k]??'covered'])),legalBasis:profile?.legalBasis??'',evidenceReference:profile?.evidenceReference??'',reviewReason:'',...input}
 const statuses=(['covered','reviewed-not-applicable'] as const)
 const fields=exact(p)+hidden('site',p.site)+hidden('staffId',staffId)+field('from','Effective from',v.from,'date','required')+`<div class="fields">${coverageKinds.map(k=>`<label>${h(coverageLabels[k])}<select aria-label="${h(coverageLabels[k])}" name="${k}" required>${statuses.map(status=>`<option value="${status}"${v[k]===status?' selected':''}>${status==='covered'?'Covered':'Reviewed as not applicable'}</option>`).join('')}</select></label>`).join('')}</div>`+textarea('legalBasis','Legal basis for any rule not applied',v.legalBasis,'maxlength="500" rows="3"')+field('evidenceReference','Employer evidence reference',v.evidenceReference,'text','maxlength="300"')+textarea('reviewReason','Applicability review reason',v.reviewReason,'required maxlength="500" rows="3"')
 const history=profile?disclosure('Current employer decision',`<p>${h(person(s,staffId))} · ${h(profile.label)}</p><p>${h(profile.legalBasis)}</p><p>${h(profile.evidenceReference)}</p>`):''
 const reviewed=preview?card('Review worker applicability',`<p><strong>${h(person(s,preview.review.worker.staffId))}</strong> · ${h(preview.review.worker.label)}</p><p>${h(preview.input.legalBasis)}</p><p>${h(preview.input.evidenceReference)}</p>${policyWorkweeks(s,preview.review)}${form('policy.worker.save',back,Object.entries(preview.input).filter(([k])=>k!=='reviewDigest').map(([k,v])=>hidden(k,v)).join('')+hidden('reviewDigest',preview.review.digest)+'<label class="check"><input type="checkbox" required> I reviewed the legal basis, evidence and affected open workweeks.</label>','Apply reviewed applicability','data-worker-apply')}`,'','worker-preview'):''
 return card('Worker applicability',`<p>No exemption is inferred from pay, job title or app role. Without an explicit employer decision, calculations assume the covered core. Review each rule family independently.</p>${pick}${staffId?history+form('policy.worker.preview',back,fields,'Preview applicability','data-worker-editor'):''}`,'','worker-policy')+reviewed
}
