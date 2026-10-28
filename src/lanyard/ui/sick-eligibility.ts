import {h,rows,card,form,field,hidden,exact,disclosure,person} from './shared'
import {sickExclusions,sickClassificationLabel} from '../domain/sick-eligibility'
import {sickJurisdiction} from '../domain/sick-purposes'

/** Extend the existing Settings disclosure and field patterns. No new readers. */
export function sickEligibilitySettings(s:any){
 const policies=rows(s,'sickpolicies').filter(p=>sickExclusions[sickJurisdiction(p.preset)])
 if(!policies.length)return ''
 const people=rows(s,'staff').filter(w=>w.active&&!w.erased_at)
 const select=(name:string,label:string,options:[string,string][])=>`<label>${h(label)}<select name="${name}" required>${options.map(([value,label])=>`<option value="${h(value)}">${h(label)}</option>`).join('')}</select></label>`
 return card('Sick leave eligibility',`<p>Review employment and jurisdiction facts here. App roles, wages and payroll mappings never establish an exemption. A review preserves earlier earned minutes and cannot rewrite approved sources. A covered-core assumption is not legal verification.</p>${policies.map(p=>disclosure(`${p.site} · ${p.preset} · employee eligibility`,
 `<p><a href="${h(p.source)}" target="_blank" rel="noreferrer">Jurisdiction source</a></p>${(p.workerCoverage??[]).map((w:any)=>`<article><h3>${h(person(s,w.staffId))} · ${h(sickClassificationLabel(w.classification))}</h3><p>${h(w.legalBasis)} · ${h(w.evidenceReference)}</p><p>Effective ${h(p.from)}${w.qualifiedFrom?` · qualifying service completed ${h(w.qualifiedFrom)}`:''}</p></article>`).join('')}`+
 form('sickworker.save','settings',exact(p)+`<div class="fields">${select('staffId','Employee',people.map(w=>[w.id,w.name]))}${field('from','Review effective from','','date','required')}${select('classification','Reviewed classification',['covered','unresolved',...sickExclusions[sickJurisdiction(p.preset)]].map(v=>[v,sickClassificationLabel(v)]))}${['SF','SEATTLE'].includes(sickJurisdiction(p.preset))?select('occasional','Occasional work in this city',[['no','Regular work'],['yes','Occasional work · city threshold applies']]):''}${field('qualifiedFrom','Qualifying workplace service completed (optional)','','date')}${field('legalBasis','Applicability legal basis','','text','required maxlength="500"')}${field('evidenceReference','Employer evidence reference','','text','required maxlength="300"')}${field('reviewReason','Review reason','','text','required maxlength="500"')}</div><p>Use a qualifying-service date only for documented service not established by the approved work here. Exclusions require a source-backed employer decision; no diagnoses or case details. Reviews apply after the latest approved source for this employee and bank.</p>`,'Save eligibility review','','secondary')
 )).join('')}`,'','sick-eligibility')
}
