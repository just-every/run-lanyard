import {h,rows,owner,person,card,disclosure,form,field,hidden,exact,moment,venue,empty} from './shared'
const range=(p:any)=>`${p.start} to ${p.end}`

export function cutoffCard(s:any){
 if(!owner(s))return ''
 const reports=rows(s,'cutoffReports')
 const labels:Record<string,string>={no_cutoff:'No cutoff configured',needs_attention:'Native review needs attention',ready:'Native review complete'}
 const body=reports.map(r=>`<article data-cutoff-period="${h(r.period.id)}"><h3>${h(range(r.period))} · ${h(labels[r.nativeReadiness])}</h3>${r.configuration?`<p>Reviewed cutoff ${moment(r.configuration.cutoffAt,venue(s))} · <code>${h(r.configuration.cutoffAt)}</code> · ${r.timing==='before'?`${Math.ceil(r.remainingMilliseconds/60000)} minutes remaining`:r.timing==='at'?'Cutoff is now':'Cutoff has passed'}</p><p>Selected export template: ${h(r.template?.name??'Unavailable')} · current revision ${h(r.template?.revision??'unknown')} · reviewed revision ${h(r.configuration.templateRevision)}. Period revision ${h(r.period.revision)}; cutoff reviewed against revision ${h(r.configuration.periodRevision)}.</p>`:'<p>No deadline has been inferred from the pay date.</p>'}<p><strong>Provider state: unknown.</strong> ${h(r.providerExplanation)}</p>${r.issues.length?`<ul class="swap-list">${r.issues.map((i:any)=>`<li>${i.staffId?`<strong>${h(person(s,i.staffId))}</strong> · `:''}${h(i.message)} <a class="text-link" href="${h(i.href)}">Review source</a><div class="note">${h(i.source.kind)} · <code>${h(i.source.id)}</code> · revision ${h(i.source.revision)}</div></li>`).join('')}</ul>`:'<p>Current native checks are clear. Payroll still requires separate human review and authorization; provider acceptance and payment remain unknown.</p>'}<p><a class="text-link" href="/app/settings#pay-cutoffs">Review cutoff Settings</a></p></article>`).join('')
 return card('Payroll cutoff monitoring',body||empty('Define a pay period before reviewing its cutoff.'),'<p class="card-note">Owner review only · no automatic submission or outreach</p>','pay-cutoff-monitor')
}

function mappingSettings(s:any,t:any){
 if(t.preset)return ''
 const issues=rows(s,'cutoffReports').flatMap(r=>r.configuration?.templateId===t.id?r.issues.filter((i:any)=>i.kind==='mapping'):[])
 const staff=rows(s,'staff').filter(p=>p.active||Object.hasOwn(t.employees,p.id))
 const codeKeys=[...new Set(['regular',...Object.keys(t.codes),...issues.filter((i:any)=>i.message.startsWith('Unmapped earning code: ')).map((i:any)=>i.message.slice('Unmapped earning code: '.length))])]
 const segments=rows(s,'timesheets').flatMap(t=>t.workSegments?.length?t.workSegments:[t])
 const jobKeys=[...new Set([...Object.keys(t.jobs),...rows(s,'jobs').map(j=>j.id),...segments.map(t=>t.job??'').filter(Boolean)])]
 const sites=[...new Set([...Object.keys(t.locations),...rows(s,'staff').map(p=>p.site??''),...segments.map(t=>t.site??'')])].filter(Boolean)
 const employeeFields=staff.map(p=>`<fieldset><legend>${h(p.name)}</legend>${field('employee:'+p.id,'Provider employee ID',t.employees[p.id]?.id??'','text','maxlength="120"')}<label>Reviewed worker treatment<select name="workflow:${h(p.id)}"><option value="unclassified"${!t.employees[p.id]||t.employees[p.id]?.workflow==='unclassified'?' selected':''}>Unclassified · review required</option>${['W-2','1099'].map(v=>`<option${t.employees[p.id]?.workflow===v?' selected':''}>${v}</option>`).join('')}</select></label></fieldset>`).join('')
 const mappings=codeKeys.map(k=>field('code:'+k,'Earning code · '+k,t.codes[k]??'','text','maxlength="120"')).join('')+jobKeys.map(k=>field('job:'+k,'Job · '+(rows(s,'jobs').find(j=>j.id===k)?.name??k),t.jobs[k]??'','text','maxlength="120"')).join('')+sites.map(k=>field('location:'+k,'Cafe · '+k,t.locations[k]??'','text','maxlength="120"')).join('')
 return card('Export mappings · '+t.name,`<p>Revision ${h(t.revision)}. Changing these mappings requires another explicit cutoff review. Existing exported files keep their original bytes.</p>`+disclosure('Review export mappings',form('payroll.template.save','/app/settings#template-'+t.id,exact(t)+hidden('mappingEdit','true')+employeeFields+mappings+'<label class="check"><input name="approved" type="checkbox" required> I reviewed these mappings and worker treatment and approve this export template.</label>','Approve export mappings','','secondary')),'',`template-${t.id}`)
}

export function cutoffSettings(s:any){
 if(!owner(s))return ''
 const templates=rows(s,'paytemplates').filter(t=>t.approved===true)
 const periods=rows(s,'periods').slice().sort((a,b)=>b.start.localeCompare(a.start))
 const forms=periods.map(p=>{
  const c=rows(s,'cutoffs').find(c=>c.periodId===p.id)
  const options=templates.map(t=>`<option value="${h(t.id+'|'+t.revision)}"${c?.templateId===t.id?' selected':''}>${h(t.name)} · revision ${h(t.revision)}</option>`).join('')
  const fields=hidden('periodId',p.id)+hidden('periodRevision',p.revision)+hidden('revision',c?.revision??0)+field('cutoffAt','Cutoff instant in UTC',c?.cutoffAt??'','text','required placeholder="2026-11-02T01:30:00Z"')+`<label>Owner-approved export template<select name="cutoffTemplate" required><option value="">Choose a reviewed template</option>${options}</select></label>`+field('reason','Review reason','','text','required maxlength="500"')+'<label class="check"><input name="reviewed" type="checkbox" required> I reviewed this exact UTC instant, period revision and export template revision.</label>'
  return `<article><h3>${h(range(p))} · revision ${h(p.revision)}</h3>${c?`<p>Current cutoff <code>${h(c.cutoffAt)}</code> · review revision ${h(c.revision)} · ${h(c.reason)}</p>`:''}${disclosure(c?'Review cutoff again':'Review payroll cutoff',form('cutoff.save','/app/settings#pay-cutoffs',fields,'Save reviewed cutoff','','secondary'))}</article>`
 }).join('')
 return card('Payroll cutoffs',`<p>Use an explicit UTC instant, including across daylight saving changes. Lanyard does not infer a provider deadline or send reminders outside the app.</p>${forms||empty('Define a pay period in Payroll first.')}<p><a class="text-link" href="/app/payroll#pay-cutoff-monitor">Open cutoff monitoring</a></p>`,'','pay-cutoffs')+rows(s,'paytemplates').map(t=>mappingSettings(s,t)).join('')
}
