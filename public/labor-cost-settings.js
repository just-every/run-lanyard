// Both editors retain the cafe-week forecast and use the native revision fence.
const costForms=[...document.querySelectorAll('[data-labor-burden],[data-job-budgets]')]
const forecastInput=form=>{
 const fields=new FormData(form),input=Object.fromEntries(fields)
 input.days=fields.getAll('days').map(Number);input.revision=Number(input.revision)
 return input
}
async function saveForecast(form,input){
 const response=await fetch('/api/lanyard/command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'forecast.save',input})})
 const payload=await response.json()
 if(!response.ok){
  if(response.status===409)form.dataset.stale='true'
  throw new Error(payload.error||'Cost settings could not be saved')
 }
 for(const editor of costForms)if(editor.elements.week.value===input.week&&editor.elements.site.value===input.site)editor.elements.revision.value=String(payload.result.revision)
 form.querySelector('[data-cost-reload]').hidden=true
}
for(const form of costForms.filter(f=>f.matches('[data-labor-burden]'))) {
 let saving=false,changed=false
 const status=form.querySelector('[data-burden-status]'),retry=form.querySelector('[data-cost-retry]')
 async function save(){
  if(form.dataset.stale)return
  if(saving){changed=true;return}
  if(!form.reportValidity())return
  saving=true;changed=false;status.textContent='Saving…';retry.hidden=true
  try {
   await saveForecast(form,forecastInput(form));status.textContent='Saved'
  } catch(error) {
   changed=false;status.textContent=(error.message||'Burden estimate could not be saved')+'. Your edits are still here.'
   form.querySelector('[data-cost-reload]').hidden=false;retry.hidden=Boolean(form.dataset.stale)
  } finally {saving=false;if(changed)save()}
 }
 form.addEventListener('change',save)
 form.addEventListener('submit',event=>{event.preventDefault();save()})
}
for(const form of costForms.filter(f=>f.matches('[data-job-budgets]'))) {
 let saving=false
 const caps=form.querySelector('[data-job-caps]'),status=form.querySelector('[data-cap-status]'),submit=form.querySelector('[type=submit]')
 const dirty=()=>{if(!form.dataset.stale)status.textContent='Unsaved job cap changes'}
 form.querySelector('[data-add-cap]').addEventListener('click',()=>{
  caps.append(form.querySelector('template').content.cloneNode(true));dirty();caps.lastElementChild.querySelector('select').focus()
 })
 caps.addEventListener('click',event=>{if(event.target.closest('[data-remove-cap]')){event.target.closest('[data-job-cap]').remove();dirty()}})
 form.addEventListener('input',dirty)
 form.addEventListener('change',dirty)
 form.addEventListener('submit',async event=>{
  event.preventDefault()
  if(saving||form.dataset.stale||!form.reportValidity())return
  const input=forecastInput(form)
  input.jobBudgets=[...caps.querySelectorAll('[data-job-cap]')].map(row=>({
   job:row.querySelector('[name=job]').value==='__unassigned__'?'':row.querySelector('[name=job]').value,
   weeklyCents:Number(row.querySelector('[name=weeklyCents]').value),
   days:[...row.querySelectorAll('[name=dailyCents]')].map(field=>field.value===''?null:Number(field.value))
  }))
  // Only native command fields leave the editor.
  delete input.job;delete input.weeklyCents;delete input.dailyCents
  saving=true;status.textContent='Saving…'
  const controls=[...form.querySelectorAll('fieldset,button')];for(const control of controls)control.disabled=true
  try{await saveForecast(form,input);status.textContent='Job caps saved';submit.textContent='Save job caps'}
  catch(error){status.textContent=(error.message||'Job caps could not be saved')+'. Your edits are still here.';form.querySelector('[data-cost-reload]').hidden=false;submit.textContent='Retry job cap save'}
  finally{saving=false;for(const control of controls)control.disabled=false;submit.disabled=Boolean(form.dataset.stale)}
 })
}
