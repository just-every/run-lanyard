/* AI preparation uses native forms; only row serialization and validation need scripting. */
for(const form of document.querySelectorAll('[data-ai-upload]')){
 form.addEventListener('submit',event=>{const file=form.elements.image.files[0],status=form.querySelector('[data-ai-upload-status]');if(file&&file.size>1048576){event.preventDefault();status.textContent='Choose an image of 1 MB or less.'}else status.textContent='Saving source and consent. Nothing has been sent to OpenAI yet.'})
}
for(const form of document.querySelectorAll('[data-ai-extract]'))form.addEventListener('submit',()=>{const button=form.querySelector('button[type=submit]');button.disabled=true;button.textContent='Extracting…';form.setAttribute('aria-busy','true')})
for(const form of document.querySelectorAll('[data-ai-review]')){
 const rows=()=>[...form.querySelectorAll('[data-ai-row]')]
 function exclusions(){for(const row of rows()){const omitted=row.querySelector('[data-ai-field=omit]').checked;for(const input of row.querySelectorAll('[data-ai-field]'))if(!['omit','confirmed','startChoice','endChoice','label'].includes(input.dataset.aiField))input.required=!omitted}}
 form.addEventListener('change',event=>{if(event.target.matches('[data-ai-field=omit]'))exclusions();else if(event.target.matches('[data-ai-field]')&&!event.target.matches('[data-ai-field=confirmed]')){event.target.closest('[data-ai-row]').querySelector('[data-ai-field=confirmed]').checked=false}})
 form.addEventListener('submit',event=>{try{const data=rows().map(row=>{const values={sourceIndex:Number(row.dataset.aiRow)};for(const input of row.querySelectorAll('[data-ai-field]'))values[input.dataset.aiField]=input.type==='checkbox'?input.checked:input.dataset.aiField==='breakMinutes'?input.value===''?null:Number(input.value):input.value;return values});form.querySelector('[data-ai-rows]').value=JSON.stringify(data)}catch(error){event.preventDefault();form.querySelector('[data-ai-review-status]').textContent=error.message}})
 exclusions()
}
