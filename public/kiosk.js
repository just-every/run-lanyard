(() => {
 const status=document.querySelector('#kiosk-status'),login=document.querySelector('#kiosk-signin'),panel=document.querySelector('#kiosk-person'),form=document.querySelector('#kiosk-clock'),pending=document.querySelector('#kiosk-pending')
 let current=null,key=null,busy=false
 const words={en:['Your clock','Clock in','Start meal','End break','Change job','Clock out','Retry saved captures','Sign out for next employee'],es:['Tu reloj','Registrar entrada','Iniciar comida','Terminar descanso','Cambiar trabajo','Registrar salida','Reintentar registros guardados','Cerrar sesión para la siguiente persona']}
 const request=async(path,body)=>{
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000)
  try{
   const r=await fetch('/api/lanyard/kiosk/'+path,{method:body?'POST':'GET',headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:controller.signal})
   let value;try{value=await r.json()}catch{}
   if(!r.ok)throw Object.assign(new Error(value?.error||'Kiosk request failed'),{status:r.status})
   if(!value||typeof value!=='object')throw new Error('The response could not be confirmed. Retry the saved original.')
   return value
  }finally{clearTimeout(timeout)}
 }
 const clear=()=>{pending.textContent='';document.querySelector('#kiosk-current').textContent='';document.querySelector('#kiosk-events')?.replaceChildren()}
 const vault=work=>window.LanyardClock.withState(key,current.open,work)
 const render=state=>{
  const count=state.events.length,errors=state.events.filter(e=>e.status==='rejected').length,es=current.language==='es'
  pending.textContent=es?`${count} registros guardados · ${errors} requieren revisión`:`${count} saved captures · ${errors} need review`
  const clock=window.LanyardClock.project(state),onBreak=clock?.breaks?.some(b=>!b.end),job=clock?.transfers?.at(-1)?.job??clock?.job
  const jobName=current.jobs.find(j=>j.id===job)?.name,working=clock?(es?'Entrada registrada':'Clocked in'):(es?'Salida registrada':'Clocked out')
  document.querySelector('#kiosk-current').textContent=working+(jobName?` · ${es?'Puesto':'Working'} ${jobName} · ${current.site}`:'')+(onBreak?(es?' · En descanso':' · On meal break'):'')+(count?(es?' · Pendiente de sincronizar':' · Pending sync'):'')
  const blocked=state.revoked||errors>0
  for(const button of form.querySelectorAll('button'))button.disabled=Boolean(blocked||(button.name==='clock.in'?clock:button.name==='clock.breakEnd'?!onBreak:!clock||onBreak))
  form.querySelector('[name=job]').disabled=Boolean(blocked||!clock||onBreak)
  let list=document.querySelector('#kiosk-events')
  if(!list){list=document.createElement('ul');list.id='kiosk-events';pending.after(list)}
  list.replaceChildren(...state.events.map(e=>{const li=document.createElement('li'),i=['clock.in','clock.breakStart','clock.breakEnd','clock.transfer','clock.out'].indexOf(e.capture.name),job=current.jobs.find(j=>j.id===e.capture.input.job)?.name;li.textContent=`${(words[current.language]||words.en)[i+1]}${job?' · '+job:''} · ${e.capture.input.capturedAt} · ${e.status==='rejected'?(es?'Requiere revisión':'Needs review'):(es?'Pendiente':'Pending')}`;return li}))
 }

 async function load(){
  form.inert=true;clear()
  try{await request('enter',{});current=await request('state');key=`kiosk:${current.deviceId}:${current.actorId}`;login.hidden=true;panel.hidden=false;if(current.photoEnrollmentNeeded){form.hidden=true;status.textContent='Photo policy requires owner-approved enrollment before further captures.';return}form.hidden=false;document.documentElement.lang=current.language;if(current.language==='es'){document.querySelector('#kiosk-title').textContent='Reloj compartido';document.title='Reloj compartido · Lanyard';document.querySelector('#photo-copy').textContent='Foto en el momento del registro; la cámara se cierra inmediatamente.';document.querySelector('#consent-copy').textContent='Doy mi consentimiento para guardar esta foto de forma privada para mí y el propietario hasta que se elimine explícitamente.';document.querySelector('#failure-copy').textContent='Estado de la foto (un fallo guarda el registro con una excepción)';form.querySelectorAll('[name=photoFailure] option').forEach((o,i)=>o.textContent=['Tomar foto ahora','Permiso de cámara denegado','Cámara no disponible o con fallo','Rechazo una foto'][i]);document.querySelector('#job-copy').textContent='Puesto (para cambiar de trabajo)'}const job=form.querySelector('[name=job]'),selected=job.value;job.replaceChildren(new Option(current.language==='es'?'Elige un puesto':'Choose a job',''),...current.jobs.map(j=>new Option(j.name,j.id)));job.value=selected;const w=words[current.language]||words.en;document.querySelector('#kiosk-heading').textContent=w[0];[...form.querySelectorAll('button'),document.querySelector('#kiosk-retry'),document.querySelector('#kiosk-signout')].forEach((b,i)=>b.textContent=w[i+1]);document.querySelector('#photo-label').hidden=!current.photoRequired;document.querySelector('#photo-consent-label').hidden=!current.photoRequired;document.querySelector('#photo-failure-label').hidden=!current.photoRequired
   await vault(async(state,save)=>{state.owner={actorId:current.actorId,staffId:current.staffId};state.client='kiosk';state.deviceId=current.deviceId;if(state.base&&Object.hasOwn(state.base,'open'))state.base=current.open;if(state.events.length&&state.sessionId&&state.sessionId!==current.sessionId){state.revoked=true;for(const e of state.events){e.status='rejected';e.error||='The original kiosk session was revoked. Owner review is required.'}}if(!state.events.length){state.base=current.open;state.sessionId=current.sessionId;state.revoked=false}else state.sessionId||=current.sessionId;await save();render(state);form.inert=false});await sync()
  }catch(e){if(e.status===401)login.hidden=false;status.textContent=e.status===401?'Verify your personal PIN to use this clock.':e.message}
 }
 async function sync(){if(busy||!current)return;busy=true;status.textContent='';document.querySelector('#kiosk-retry').disabled=true
  try{await vault(async(state,save)=>{for(const e of state.events){if(state.revoked||e.status==='rejected')break;try{
   const accepted=await request('capture',{...e.capture,photo:e.photo,photoConsent:e.photoConsent,photoFailure:e.photoFailure})
   if(accepted.ok!==true)throw new Error('The response did not confirm the capture. Retry the saved original.')
   current=await request('state');state.base=current.open;state.events=state.events.filter(x=>x!==e);await save();status.textContent=''
  }catch(error){
   if(!error.status||error.status>=500||[408,429].includes(error.status)){
    status.textContent=current.language==='es'?'Los registros originales siguen guardados. Reintenta cuando haya conexión.':'Original captures remain saved. Retry when the connection is available.'
    break
   }
   e.status='rejected';e.error=error.message
   for(const later of state.events.slice(state.events.indexOf(e)+1)){later.status='rejected';later.error='An earlier capture was refused. Owner review is required before applying dependent time.'}
   if([401,403].includes(error.status))state.revoked=true
   await save();status.textContent=current.language==='es'?'El registro se conserva para revisión del encargado.':'Capture retained for manager review. '+error.message;break
  }}render(state)})}
  catch(e){status.textContent=e.message}finally{busy=false;document.querySelector('#kiosk-retry').disabled=false}
 }
 login.addEventListener('submit',async event=>{event.preventDefault();try{await request('signin',Object.fromEntries(new FormData(login)));login.reset();status.textContent='';await load()}catch(e){status.textContent=e.message}})
 form.addEventListener('submit',async event=>{event.preventDefault();if(!current||busy)return;busy=true
  try{const name=event.submitter.name,input={commandId:crypto.randomUUID(),capturedAt:new Date().toISOString()},data=new FormData(form);if(name==='clock.out')input.breakMinutes=0;if(name==='clock.breakStart')input.kind='meal';if(name==='clock.transfer')input.job=data.get('job');let photo,photoFailure
   const photoRequired=current.photoRequired&&(!name.startsWith('clock.break')||current.photoBreaks)&& (name!=='clock.transfer'||current.photoTransfers)
   if(photoRequired&&data.get('photoFailure'))photoFailure=String(data.get('photoFailure'));
   else if(photoRequired){
    if(!data.get('photoConsent'))photoFailure='photo consent declined'
    else{const captured=await window.LanyardPunchPhoto.still(document.querySelector('[data-kiosk-video]'));photo=captured.photo;photoFailure=captured.photoFailure}
   }
   await vault(async(state,save)=>{if(state.revoked||state.events.some(e=>e.status==='rejected'))throw new Error('Saved captures need manager review before recording more time.');const capture={name,input};if(name==='clock.transfer'&&!current.jobs.some(j=>j.id===input.job))throw new Error('Choose an available job.');window.LanyardClock.apply(window.LanyardClock.project(state),capture);state.events.push({capture,photo,photoConsent:Boolean(photo),photoFailure,status:'pending'});await save();render(state)});form.reset()
  }catch(e){status.textContent=e.message}finally{busy=false;await sync()}
 })
 document.querySelector('#kiosk-retry').addEventListener('click',sync);window.addEventListener('online',sync)
 document.querySelector('#kiosk-signout').addEventListener('click',async()=>{try{let yes=false;await vault(async(state,save)=>{if(state.events.length&&!confirm('Signing out deletes local originals. Cancel and ask the owner to recover unresolved captures first. Delete and sign out?'))return;await request('signout',{});state.events=[];await save();yes=true});if(yes){current=null;key=null;clear();panel.hidden=true;login.hidden=false;status.textContent='Signed out. Ready for the next employee.';form.reset()}}catch(e){status.textContent=e.message}})
 load()
})()
