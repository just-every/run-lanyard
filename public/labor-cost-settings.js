// Weekly burden assumptions save without replacing the form or losing edits.
for(const form of document.querySelectorAll('[data-labor-burden]')) {
 let saving=false,changed=false
 const status=form.querySelector('[data-burden-status]')
 async function save(){
  if(saving){changed=true;return}
  if(!form.reportValidity())return
  saving=true;changed=false;status.textContent='Saving…'
  const fields=new FormData(form),input=Object.fromEntries(fields)
  input.days=fields.getAll('days').map(Number);input.revision=Number(input.revision)
  try {
   const response=await fetch('/api/lanyard/command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'forecast.save',input})}),payload=await response.json()
   if(!response.ok)throw new Error(payload.error||'Burden estimate could not be saved')
   form.elements.revision.value=String(payload.result.revision);status.textContent='Saved'
  } catch(error) {changed=false;status.textContent=error.message||'Burden estimate could not be saved'}
  finally {saving=false;if(changed)save()}
 }
 form.addEventListener('change',save)
 form.addEventListener('submit',event=>{event.preventDefault();save()})
}
