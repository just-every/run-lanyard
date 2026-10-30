// Failed requests keep the owner's entered inputs and exact saved review.
async function tipCommand(name,input){
 const response=await fetch('/api/lanyard/command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,input})})
 const payload=await response.json()
 if(!response.ok)throw new Error(payload.error||'Pool review could not be saved')
 return payload.result
}
for(const form of document.querySelectorAll('[data-tip-prepare],[data-tip-approve]')){
 let busy=false
 const status=form.querySelector('[data-tip-status]'),prepares=form.matches('[data-tip-prepare]')
 if(prepares){
  form.querySelector('[data-add-tip-input]').addEventListener('click',()=>form.querySelector('[data-tip-inputs]').append(form.querySelector('template').content.cloneNode(true)))
  form.querySelector('[data-tip-inputs]').addEventListener('click',event=>{if(event.target.closest('[data-remove-tip-input]'))event.target.closest('[data-tip-input]').remove()})
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault()
  if(busy||!form.reportValidity())return
  const fields=new FormData(form)
  const input=prepares?{
   site:fields.get('site'),date:fields.get('date'),jobs:fields.getAll('jobs'),participants:fields.getAll('participants'),
   declarationIds:fields.getAll('declarationIds'),reason:fields.get('reason'),
   inputs:[...form.querySelectorAll('[data-tip-input]')].filter(row=>row.querySelector('[name=reference]').value||row.querySelector('[name=cents]').value).map(row=>({reference:row.querySelector('[name=reference]').value,cents:row.querySelector('[name=cents]').value===''?null:Number(row.querySelector('[name=cents]').value)})),
   ...(fields.get('corrects')?{corrects:fields.get('corrects')}:{})
  }:{id:fields.get('id'),revision:Number(fields.get('revision')),consent:fields.get('consent')==='on'}
  busy=true;status.textContent=prepares?'Preparing review…':'Approving exact revision…'
  const controls=[...form.querySelectorAll('button,input,select,textarea')],disabled=controls.map(c=>c.disabled)
  for(const control of controls)control.disabled=true
  try{
   const result=await tipCommand(prepares?'tip.pool.prepare':'tip.pool.approve',input)
   const url=new URL(location.href)
   url.searchParams.delete('tipCorrects');url.searchParams.set('tipReview',result.id);url.searchParams.set('tipSite',result.site);url.searchParams.set('tipDate',result.date);url.hash='tip-pools'
   if(url.href===location.href)location.reload();else location.assign(url)
  }catch(error){
   status.textContent=(error.message||'Pool review could not be saved')+'. Your entered inputs are still here. Prepare a fresh review if sources changed.'
  }finally{busy=false;controls.forEach((c,i)=>c.disabled=disabled[i])}
 })
}
