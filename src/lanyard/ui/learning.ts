// LEARN-001 card on the demand screen: comparable service days with attributed and unknown error sources,
// the held-out comparison behind any proposed growth change, and its approve, decline and revert controls.
import {h,card,form,field,hidden,disclosure,status} from './shared'
import {day,money,stamp} from './format'

const cents=(v:number)=>(v<0?'−':'+')+money(Math.abs(v))
export function learningCard(l:any,tz:string,back:string) {
 const days=l.days.length?`<table class="list stack"><thead><tr><th>Day</th><th>Forecast (observed hours)</th><th>Actual</th><th>Error</th><th>Known error sources</th></tr></thead><tbody>${l.days.map((d:any)=>`<tr><td data-label="Day">${h(day(d.date))}</td><td data-label="Forecast">${h(money(d.computedCents))}</td><td data-label="Actual">${h(money(d.actualCents))}</td><td data-label="Error">${h(cents(d.errorCents))}</td><td data-label="Known error sources">${d.sources.map((x:string)=>h(x)).join('; ')}</td></tr>`).join('')}</tbody></table>`:'<p class="note">No comparable service days yet.</p>'
 const skipped=Object.entries(l.excluded).map(([k,n])=>`${h(n)} × ${h(k)}`).join('; ')
 const e=l.evaluation
 const verdict=l.status==='proposal'?`<div class="banner"><p><strong>Proposed:</strong> ${h(l.proposal.explanation)}</p>${form('learn.propose',back,hidden('site',l.site)+hidden('weeks',l.weeks)+hidden('digest',l.digest),'Record this proposal','','secondary')}</div>`:`<p class="note">No proposal: ${h(l.reason)}.</p>`
 const held=e?`<p class="note">Fitted on ${h(e.trainDates.length)} earlier days, held out ${h(e.holdoutDates.length)} latest days (${h(e.holdoutHours)} hours): mean hourly error ${h(money(e.currentMeanAbsoluteErrorCents))} now, ${h(money(e.candidateMeanAbsoluteErrorCents))} with a ${h(e.biasPercent>0?'+':'')}${h(e.biasPercent)}% change.</p>`:''
 const list=l.proposals.map((r:any)=>{
  const decide=r.status==='proposed'?form('learn.decide',back,hidden('id',r.id)+hidden('revision',r.revision)+field('reason','Reason','','text','required maxlength="280"')+`<select name="decision"><option value="approved">Approve and apply</option><option value="declined">Decline</option></select>`,'Decide','','secondary'):r.status==='approved'?form('learn.revert',back,hidden('id',r.id)+hidden('revision',r.revision)+field('reason','Reason to revert','','text','required maxlength="280"'),'Revert to '+r.change.from+'%','','secondary'):''
  const why=r.decision?.reason?` · ${h(r.decision.reason)}`:''
  return `<li>Version ${h(r.version)} · growth ${h(r.change.from)}% → ${h(r.change.to)}% · ${status(r.status)} · ${h(stamp(r.proposedAt,tz,false))}${why}${r.decision?.revertReason?` · reverted: ${h(r.decision.revertReason)}`:''}${decide}</li>`
 }).join('')
 return card('Learning from forecast errors',`<p class="note">Compares each completed day's pre-override forecast with entered sales. Missing sales and incomplete forecasts stay unknown, unresolved no-shows are unobserved causes, and nothing changes until a manager approves.</p>${days}${skipped?`<p class="note">Not compared: ${skipped}.</p>`:''}${held}${verdict}${list?disclosure('Proposals and decisions',`<ul class="swap-list">${list}</ul>`,l.proposals.some((r:any)=>r.status==='proposed')):''}`,`<p class="card-note">${h(l.comparableDays)} comparable days</p>`,'learning')
}
