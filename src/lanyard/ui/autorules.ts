// AUTO-001 screen (owner, on Payroll): each cafe's automatic approval rule with its live preview — what
// it would approve now and why the rest stays for a human — and authorize, pause and revoke.
import {h,rows,form,field,hidden,card,disclosure,exact,person} from './shared'

export function autoRulesCard(s:any) {
 const previews=rows(s,'autorulePreviews'),list=rows(s,'autorules').filter(r=>r.status!=='revoked')
 const one=(r:any)=>{
  const v=previews.find(p=>p.ruleId===r.id),items=(v?.items??[]).map((x:any)=>`<li>${h(person(s,x.staffId))}: ${x.decision==='approve'?'<strong>would approve</strong>':`for a person · ${h(x.reasons.join(', '))}`}</li>`).join('')
  const actions=[r.status==='active'?'':form('autorule.authorize','payroll',exact(r)+hidden('digest',v?.digest??''),`Authorize v${r.version} as previewed`,'','primary small'),r.status==='active'?form('autorule.pause','payroll',exact(r),'Pause','','secondary small'):'',form('autorule.revoke','payroll',exact(r),'Revoke','','secondary small')].join('')
  return `<li><strong>${h(r.site||'Your cafe')}</strong> · v${h(r.version)} · ${h(r.status)}${items?`<ul class="note">${items}</ul>`:'<p class="note">No waiting time.</p>'}<div class="row-actions">${actions}</div></li>`
 }
 const add=disclosure('Add a rule',form('autorule.save','payroll',`<div class="fields">${field('site','Cafe','','text','maxlength="80"')}</div>`,'Save rule (starts paused)','','secondary'))
 return card('Automatic approval',`<p class="note">A rule approves only punched time that starts and ends in the same minutes as its published shift, keeps the scheduled break with the employee’s break attestation and has no exception, premium, correction, edit or overtime. Managers’ own time always goes to a person.</p>${list.length?`<ul class="swap-list">${list.map(one).join('')}</ul>`:''}${add}`,'','auto-approval')
}
