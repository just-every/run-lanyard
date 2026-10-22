(() => {
 const status=document.querySelector('#kiosk-status'),login=document.querySelector('#kiosk-signin'),panel=document.querySelector('#kiosk-person'),form=document.querySelector('#kiosk-clock'),pending=document.querySelector('#kiosk-pending')
 let current=null,key=null,busy=false
 const words={en:['Your clock','Clock in','Start meal','End break','Change job','Clock out','Retry saved captures','Sign out for next employee'],es:['Tu reloj','Registrar entrada','Iniciar comida','Terminar descanso','Cambiar trabajo','Registrar salida','Reintentar registros guardados','Cerrar sesión para la siguiente persona']}
 const request=async(path,body)=>{const r=await fetch('/api/lanyard/kiosk/'+path,{method:body?'POST':'GET',headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const value=await r.json();if(!r.ok)throw Object.assign(new Error(value.error||'Kiosk request failed'),{status:r.status});return value}
 const vault=work=>window.LanyardClock.withState(key,{open:null},work)
 const render=state=>{pending.textContent=`${state.events.length} saved captures · ${state.events.filter(e=>e.status==='rejected').length} need review`;document.querySelector('#kiosk-current').textContent=current.clocks.some(k=>k.status==='open')?(current.language==='es'?'Entrada registrada':'Clocked in'):(current.language==='es'?'Salida registrada':'Clocked out')}
 async function load(){
  try{current=await request('state');key=`kiosk:${current.deviceId}:${current.actorId}`;login.hidden=true;panel.hidden=false;document.documentElement.lang=current.language;const w=words[current.language]||words.en;document.querySelector('#kiosk-heading').textContent=w[0];[...form.querySelectorAll('button'),document.querySelector('#kiosk-retry'),document.querySelector('#kiosk-signout')].forEach((b,i)=>b.textContent=w[i+1]);document.querySelector('#photo-label').hidden=!current.photoRequired;document.querySelector('#photo-consent-label').hidden=!current.photoRequired
   await vault(async(state,save)=>{state.owner={actorId:current.actorId,staffId:current.staffId};state.client='kiosk';state.deviceId=current.deviceId;await save();render(state)});await sync()
  }catch(e){status.textContent=e.status===401?'Verify your personal PIN to use this clock.':e.message}
 }
 async function sync(){if(busy||!current)return;busy=true
  try{await vault(async(state,save)=>{for(const e of state.events){if(e.status==='rejected')break;try{await request('capture',{...e.capture,photo:e.photo,photoConsent:e.photoConsent});current=await request('state');state.events=state.events.filter(x=>x!==e);await save()}catch(error){if(!error.status)break;e.status='rejected';e.error=error.message;if([401,403].includes(error.status))state.revoked=true;await save();status.textContent='Capture retained for manager review. '+error.message;break}}render(state)})}
  catch(e){status.textContent=e.message}finally{busy=false}
 }
 login.addEventListener('submit',async event=>{event.preventDefault();try{await request('signin',Object.fromEntries(new FormData(login)));login.reset();status.textContent='';await load()}catch(e){status.textContent=e.message}})
 form.addEventListener('submit',async event=>{event.preventDefault();if(!current||busy)return;busy=true
  try{const name=event.submitter.name,input={commandId:crypto.randomUUID(),capturedAt:new Date().toISOString()},data=new FormData(form);if(name==='clock.out')input.breakMinutes=0;if(name==='clock.breakStart')input.kind='meal';if(name==='clock.transfer')input.job=data.get('job');let photo
   if(current.photoRequired){const f=data.get('photo');if(!f?.size||f.size>100000||!data.get('photoConsent'))throw new Error('Choose a JPEG photo and explicitly consent before capture.');const bytes=new Uint8Array(await f.arrayBuffer());photo=btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''))}
   await vault(async(state,save)=>{if(state.revoked||state.events.some(e=>e.status==='rejected'))throw new Error('Saved captures need manager review before recording more time.');state.events.push({capture:{name,input},photo,photoConsent:Boolean(photo),status:'pending'});await save();render(state)});form.reset()
  }catch(e){status.textContent=e.message}finally{busy=false;await sync()}
 })
 document.querySelector('#kiosk-retry').addEventListener('click',sync);window.addEventListener('online',sync)
 document.querySelector('#kiosk-signout').addEventListener('click',async()=>{try{let yes=false;await vault(async(state,save)=>{if(state.events.length&&!confirm('Signing out deletes local originals. Cancel and ask the owner to recover unresolved captures first. Delete and sign out?'))return;await request('signout',{});state.events=[];await save();yes=true});if(yes){current=null;key=null;panel.hidden=true;login.hidden=false;status.textContent='Signed out. Ready for the next employee.';form.reset()}}catch(e){status.textContent=e.message}})
 load()
})()
