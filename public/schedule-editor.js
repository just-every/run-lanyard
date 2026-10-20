/* SCHEDULE-001: edits are local until the manager prepares and reviews a revision. */
window.LanyardSchedule={start({localToUTC}) {
 const form=document.querySelector('[data-roster-form]');if(!form)return
 const container=form.querySelector('[data-shift-rows]'),board=form.querySelector('[data-editor-board]'),live=form.querySelector('[data-live-review]'),status=form.querySelector('[data-editor-status]')
 const template=container.lastElementChild.cloneNode(true),undo=form.querySelector('[data-undo-shift]'),history=[]
 const fields=['staffId','start','end','breakMinutes','label','site'],rows=()=>[...container.querySelectorAll('.shift-input')],control=(r,k)=>r.querySelector(`[data-shift="${k}"]`)
 const values=r=>Object.fromEntries(fields.map(k=>[k,control(r,k).value]))
 const snapshot=()=>rows().map(r=>({values:values(r),selected:r.querySelector('[data-select-shift]').checked}))
 let previous=JSON.stringify(snapshot()),request=0,timer,dragged
 const remember=()=>{const next=JSON.stringify(snapshot());if(next!==previous){history.push(previous);previous=next;undo.disabled=false}}
 const restore=entries=>{container.replaceChildren();for(const e of entries){const row=template.cloneNode(true);for(const k of fields)control(row,k).value=e.values[k];row.querySelector('[data-select-shift]').checked=e.selected;container.append(row)}}
 const addDays=(value,days)=>{const d=new Date(value+'Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,16)}
 const read=()=>rows().flatMap(r=>{const v=values(r);if(!v.staffId&&!v.start&&!v.end&&!v.label)return [];if(!v.staffId||!v.start||!v.end)throw Error('Complete each shift’s person and start/end, or remove it.');return [{...v,start:localToUTC(v.start),end:localToUTC(v.end),breakMinutes:Number(v.breakMinutes)}]})
 const node=(tag,text,parent,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;parent.append(n);return n}
 const describe=x=>`${form.querySelector(`[data-shift="staffId"] option[value="${CSS.escape(x.staffId)}"]`)?.textContent??'Person'} · ${new Date(x.start).toLocaleString('en-US',{timeZone:document.body.dataset.timezone})} – ${new Date(x.end).toLocaleTimeString('en-US',{timeZone:document.body.dataset.timezone})} · ${x.breakMinutes} min meal${x.label?' · '+x.label:''}${x.site?' · '+x.site:''}`
 function renderReview(review){
  live.replaceChildren();node('h3','Unsaved schedule review',live)
  node('p',`${review.added.length} added · ${review.removed.length} removed · ${review.unchanged.length} unchanged. Nothing sent to employees.`,live)
  const warnings=node('ul',undefined,live);for(const c of review.conflicts)node('li',`Conflict: ${c.reason}`,warnings)
  for(const w of review.warnings)node('li',`${w.site||'Cafe'}${w.date?' · '+w.date:''}: ${w.message}`,warnings)
  for(const d of review.days)node('p',`${d.date}: ${d.headcount} people · ${d.shifts} shifts · ${d.minutes/60} hours · $${(d.costCents/100).toFixed(2)} estimated · ${d.gaps} known gaps`,live)
  const diff=node('details',undefined,live);node('summary','Employee-facing change preview',diff)
  node('p','Each employee will see only changes to their own shifts after publication. Changed shifts appear as removed and added.',diff)
  const list=node('ul',undefined,diff);for(const [kind,items] of [['Removed',review.removed],['Added',review.added]])for(const x of items)node('li',`${kind}: ${describe(x)}`,list)
 }
 async function review(){const seq=++request;let shifts;try{shifts=read();if(!shifts.length){live.textContent='Add a shift to see conflicts, coverage and estimated cost.';return}}catch(e){live.textContent=e.message;return}
  live.setAttribute('aria-busy','true')
  try{const response=await fetch('/api/lanyard/schedule/review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({week:form.elements.week.value,shifts})});const result=await response.json();if(seq!==request)return;if(!response.ok)throw Error(result.error||'Could not review this schedule.');renderReview(result)}catch(e){if(seq===request)live.textContent=`Review unavailable: ${e.message}. Prepare again after resolving this error.`}finally{if(seq===request)live.removeAttribute('aria-busy')}
 }
 function draw(){
  board.replaceChildren();const week=form.elements.week.value,select=form.querySelector('[data-editor-view]');for(let i=0;i<7;i++){const date=addDays(week+'T00:00',i).slice(0,10);select.options[i+1].value=date;select.options[i+1].textContent=date}const filter=select.value
  for(let day=0;day<7;day++){
   const date=addDays(week+'T00:00',day).slice(0,10);if(filter!=='week'&&date!==filter)continue
   const col=node('section',undefined,board,'editor-day');col.dataset.date=date;node('h3',new Date(date+'T12:00Z').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'}),col)
   col.addEventListener('dragover',e=>{e.preventDefault();col.dataset.over='true'});col.addEventListener('dragleave',()=>delete col.dataset.over)
   col.addEventListener('drop',e=>{e.preventDefault();delete col.dataset.over;const r=rows()[dragged];if(!r)return;const v=values(r),days=Math.round((Date.parse(date)-Date.parse(v.start.slice(0,10)))/86400000);control(r,'start').value=addDays(v.start,days);control(r,'end').value=addDays(v.end,days);changed('Shift moved; prepare a draft to save it.')})
   rows().forEach((r,i)=>{const v=values(r);if(v.start.slice(0,10)!==date||!v.staffId)return
    const card=node('div',undefined,col,'editor-shift');card.draggable=true;card.dataset.row=i;card.addEventListener('dragstart',e=>{dragged=i;e.dataTransfer.setData('text/plain',String(i))})
    node('strong',control(r,'staffId').selectedOptions[0].textContent,card);node('small',`${v.start.slice(11)} – ${v.end.slice(11)} · ${v.label||'Shift'}${v.site?' · '+v.site:''}`,card)
    node('small',`${v.breakMinutes} min meal`,card)
    const label=node('label','Duration in minutes',card),slider=node('input',undefined,label);slider.type='range';slider.min=Number(v.breakMinutes)+1;slider.max=2880;slider.step=1;slider.value=Math.round((Date.parse(v.end+'Z')-Date.parse(v.start+'Z'))/60000);slider.setAttribute('aria-label',`Resize ${control(r,'staffId').selectedOptions[0].textContent} shift`)
    slider.addEventListener('change',()=>{control(r,'end').value=new Date(Date.parse(v.start+'Z')+Number(slider.value)*60000).toISOString().slice(0,16);changed('Shift resized; prepare a draft to save it.')})
    const edit=node('button','Edit or select',card);edit.type='button';edit.className='secondary small';edit.onclick=()=>{r.querySelector('[data-select-shift]').checked=true;control(r,'start').focus();r.scrollIntoView({block:'center',behavior:'smooth'})}
   })
  }
 }
 function changed(message){remember();draw();if(message)status.textContent=message;clearTimeout(timer);timer=setTimeout(review,250)}
 form.querySelector('[data-add-shift]').onclick=()=>{container.append(template.cloneNode(true));changed('Shift row added.');container.lastElementChild.querySelector('select').focus()}
 form.addEventListener('click',e=>{if(e.target.closest('[data-remove-shift]')){e.target.closest('.shift-input').remove();changed('Shift removed from this unsaved edit.')}})
 const selected=()=>rows().filter(r=>r.querySelector('[data-select-shift]').checked)
 form.querySelector('[data-bulk-apply]').onclick=()=>{const chosen=selected();if(!chosen.length){status.textContent='Select at least one shift.';return}const bulk=k=>form.querySelector(`[data-bulk="${k}"]`).value
  for(const r of chosen){for(const k of ['staffId','breakMinutes','label','site'])if(bulk(k)!=='')control(r,k).value=bulk(k);const days=Number(bulk('days'));if(days)for(const k of ['start','end'])if(control(r,k).value)control(r,k).value=addDays(control(r,k).value,days)}changed(`${chosen.length} shifts edited. Review warnings before preparing.`)}
 form.querySelector('[data-copy-shifts]').onclick=()=>{for(const r of selected()){const copy=r.cloneNode(true);for(const k of fields)control(copy,k).value=control(r,k).value;copy.querySelector('[data-select-shift]').checked=false;container.append(copy)}changed('Selected shifts copied. Move or reassign copies to resolve overlap warnings.')}
 form.querySelector('[data-delete-shifts]').onclick=()=>{for(const r of selected())r.remove();changed('Selected shifts removed from this unsaved edit.')}
 undo.onclick=()=>{const prior=history.pop();if(!prior)return;restore(JSON.parse(prior));previous=prior;undo.disabled=!history.length;draw();review();status.textContent='Last unsaved edit undone. Published history is unchanged.'}
 // Avoid moving the clicked control during an input's blur/change event.
 form.addEventListener('change',e=>{if(e.target.matches('[data-select-shift]'))previous=JSON.stringify(snapshot());if(e.target.matches('[data-shift], [name=week]')){remember();status.textContent='Unsaved changes; prepare a draft to save.';clearTimeout(timer);timer=setTimeout(()=>{draw();review()},250)}if(e.target.matches('[data-editor-view]'))draw()})
 form.addEventListener('input',e=>{if(e.target.matches('[data-shift]')){clearTimeout(timer);timer=setTimeout(()=>{draw();review()},250)}})
 form.addEventListener('submit',e=>{try{const shifts=read();if(!shifts.length)throw Error('Add at least one shift.');form.querySelector('[data-shifts-output]').value=JSON.stringify(shifts)}catch(error){e.preventDefault();status.textContent=error.message;status.setAttribute('role','alert')}})
 draw();review()
}}
