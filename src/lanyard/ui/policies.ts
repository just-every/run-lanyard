import {alternatePolicySettings} from './policy-alternate'
import {policyFields} from './policy-fields'
import {workerPolicySettings} from './policy-coverage'
import {policyWorkweeks} from './policy-review'
import {BREAK_VERSION,BREAK_VERSIONS,breakSources} from '../domain/policy-breaks'
import {VERSION,POLICY_VERSIONS,policyPresets} from '../domain/policy-catalog'
import {h,rows,card,form,field,hidden,textarea,exact,disclosure,person,titleRow,moment,venue} from './shared'
import {dateKey,money} from './format'

const names:Record<string,string>={federal:'Federal',CA:'California',AK:'Alaska',NV:'Nevada',CO:'Colorado',OR:'Oregon',WA:'Washington',NY:'New York',IL:'Illinois',custom:'Custom · unmaintained'}
const label=(preset:string)=>names[preset]??preset
const select=(name:string,title:string,values:readonly string[],value:string,labels:(v:string)=>string=v=>v)=>`<label>${h(title)}<select name="${h(name)}"${name==='site'?'':' required'}>${values.map(v=>`<option value="${h(v)}"${v===value?' selected':''}>${h(labels(v))}</option>`).join('')}</select></label>`
const sources=(preset:string)=>{const p=policyPresets.find(p=>p.id===preset);return p?`<ul>${[p.source,...p.breakSources].map((url,i)=>`<li><a class="text-link" href="${h(url)}" target="_blank" rel="noreferrer">${i?'Meal and rest source '+i:'Overtime source'} ↗</a></li>`).join('')}</ul>`:'<p class="note">Employer-configured thresholds are unmaintained. Review them against your applicable requirements.</p>'}

function record(s:any,p:any){
 return `<p><strong>${h(label(p.preset))}</strong> · revision ${h(p.revision)} · effective ${h(p.from)}</p><p class="note">Overtime ${h(p.presetVersion)} · breaks ${h(p.breakVersion??'No maintained rules')} · employer minimum rest ${h(p.minimumRestMinutes??0)} minutes</p>${p.preset==='custom'?`<p>${h(p.jurisdiction)} · daily ${h(p.dailyMinutes)}, double time ${h(p.doubleMinutes)}, weekly ${h(p.weeklyMinutes)} minutes · unmaintained</p>`:''}${p.preset==='NY'?`<p>${h(p.industry??'nonfactory')} establishment coverage · employer reviewed</p>`:''}<p>${h(p.reviewReason)}</p><p class="note">Reviewed ${moment(p.at,venue(s))}${p.releaseReview?' · release review retained':''}</p>${sources(p.preset)}${p.releaseReview?disclosure('Reviewed recalculation',policyWorkweeks(s,p.releaseReview)):''}`
}

function edit(s:any,p:any,v:any,back:string){
 const custom=v.preset==='custom',breaks=Boolean(breakSources[v.preset])
 const content=(p?exact(p):'')+hidden('site',v.site)+hidden('preset',v.preset)+`<div class="fields">${field('from','Effective from',v.from,'date','required')}${select('presetVersion','Overtime rule version',POLICY_VERSIONS,v.presetVersion)}${breaks?select('breakVersion','Meal and rest rule version',BREAK_VERSIONS,v.breakVersion):''}${v.preset==='NY'?select('industry','Reviewed establishment coverage',['nonfactory','factory'],v.industry??'nonfactory',v=>v==='factory'?'Factory · employer reviewed':'Nonfactory · employer reviewed'):''}${field('minimumRestMinutes','Employer minimum rest (minutes)',v.minimumRestMinutes,'number','required min="0" max="1440" step="1"')}</div><p class="note">Employer minimum rest is unmaintained. Zero leaves it unset.</p>`+(custom?`<fieldset><legend>Custom thresholds · unmaintained</legend>${field('jurisdiction','Jurisdiction',v.jurisdiction,'text','required maxlength="120"')}<div class="fields">${field('dailyMinutes','Daily overtime after (minutes)',v.dailyMinutes,'number','required min="1" max="10080" step="1"')}${field('doubleMinutes','Double time after (minutes)',v.doubleMinutes,'number','required min="1" max="10080" step="1"')}${field('weeklyMinutes','Weekly overtime after (minutes)',v.weeklyMinutes,'number','required min="1" max="10080" step="1"')}</div></fieldset>`:'')+textarea('reviewReason','Review reason',v.reviewReason,'required maxlength="500" rows="3"')+`<p class="note">Preview open workweeks before applying. Locked and closed payroll cannot be recalculated.</p>`
 return card(`${p?'Review changes':'Configure policy'} · ${v.site||'Default cafe'}`,form('policy.preview',back,content,'Preview policy changes','data-policy-editor','primary')+disclosure('Scope and official sources',`${sources(v.preset)}<p>Nonexempt overtime core and selected break review estimates. Exemptions, alternate workdays and premium payroll remain incomplete. Your payroll provider’s regular-rate treatment is authoritative.</p>`),'','policy-config')
}


function preview(s:any,result:any,back:string){
 const {review,input}=result,fields=policyFields(input)
 const periods=review.periods.length?`<ul>${review.periods.map((p:any)=>`<li>${h(p.start)}–${h(p.end)} · ${h(p.status)} · revision ${h(p.revision)}</li>`).join('')}</ul>`:'<p class="note">No payroll periods at or after this effective date.</p>'

 return card('Review policy release',`<p><strong>${h(label(review.preset))}</strong> · ${h(review.site||'Default cafe')} · effective ${h(review.from)}</p><p class="note">Overtime ${h(review.presetVersion)} · breaks ${h(review.breakVersion??'No maintained rules')}</p><p>${h(input.reviewReason)}</p>${policyWorkweeks(s,review)}${disclosure('Affected payroll periods',periods)}<p class="note">${h(review.label)}. Wage estimates exclude meal and rest premiums; break premiums are shown separately. Missing timing stays unknown.</p>${form('policy.save',back,fields+hidden('reviewDigest',review.digest)+`<label class="check"><input type="checkbox" required> I reviewed the before and after estimates and approve this exact policy change.</label>`,'Apply reviewed policy','data-policy-apply','primary')}`,'','policy-preview')
}

/** Owner maintenance uses the same native commands and retained revisions as the API. */
export function policiesPage(s:any,q:URLSearchParams,extras:any,now:number){
 const input=extras.result?.policyInput,review=extras.result?.policyPreview
 const all=rows(s,'policies'),sites=[...new Set([...rows(s,'staff').map(p=>p.site??''),...all.map(p=>p.site)])].sort() as string[]
 if(!sites.length)sites.push('')
 const site=String(input?.site??q.get('site')??sites[0]),p=all.find(p=>p.site===site),preset=String(input?.preset??q.get('preset')??p?.preset??'federal')
 const same=p?.preset===preset,v={industry:same?p.industry??'nonfactory':'nonfactory',site,preset,from:p?.from??dateKey(now,venue(s)),presetVersion:same?p.presetVersion:VERSION,breakVersion:same?p.breakVersion:BREAK_VERSION,minimumRestMinutes:p?.minimumRestMinutes??0,jurisdiction:same?p.jurisdiction:'',dailyMinutes:same?p.dailyMinutes:480,doubleMinutes:same?p.doubleMinutes:720,weeklyMinutes:same?p.weeklyMinutes:2400,reviewReason:'',...input}
 const back='/app/settings?'+new URLSearchParams({site,preset}),pick=`<form method="get" action="/app/settings"><div class="fields">${select('site','Cafe',sites,site,v=>v||'Default cafe')}${select('preset','Policy preset',[...policyPresets.map(p=>p.id),'custom'],preset,label)}</div><button type="submit" class="secondary">Open policy</button></form>`
 return titleRow('Settings',s,now)+card('Overtime, meals and rest',pick,'','policy-pick')+(p?card('Current policy',record(s,p)+(p.versions?.length?disclosure('Policy revision history',p.versions.slice().reverse().map((v:any)=>`<article>${record(s,v)}</article>`).join('')):''),'','policy-current'):card('Current policy','<p>No policy is configured for this cafe.</p>'))+(review?preview(s,review,back):'')+edit(s,p,v,back)+workerPolicySettings(s,p,q,extras,back)+alternatePolicySettings(s,p,back)
}
