import assert from 'node:assert/strict'
import {readFile,mkdir,mkdtemp,cp,rm,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {spawnSync} from 'node:child_process'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
const pin=r=>({id:r.id,revision:r.revision})
const now='2026-11-04T12:00:00.000Z',week='2026-11-02',site='Synthetic cafe'
export async function languageJourney(){
 const h=await harness({secure:true,now}),browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
 try{
  await h.cmd('settings.save',{timezone:'UTC'})
  const spanish=await h.person('Synthetices'),english=await h.person('Syntheticen')
  for(const p of [spanish,english]){
   await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:'staff',active:true,site,position:'Counter',hourlyRate:'20.00'})
   await h.cmd('availability.save',{start:week+'T00:00:00Z',end:'2026-11-09T00:00:00Z'},p.cookie)
  }
  const startQuestion=await h.cmd('question.save',{site,when:'in',kind:'yesno',text:'Ready for work?',textEs:'¿Listo para trabajar?',required:true})
  const injuryQuestion=await h.cmd('question.save',{site,when:'out',kind:'injury',text:'Any injury today?',textEs:'¿Alguna lesión hoy?',required:false})
  await h.cmd('breakrule.save',{site,mealAfterMinutes:300,mealMinutes:30,waiveUpTo:360,restEveryMinutes:0,restMinutes:10,premium:false})
  const q=await h.cmd('question.save',{site,when:'out',kind:'breaks',text:'Did you take all your breaks?',textEs:'¿Tomaste todos tus descansos?',required:true})
  const draft=await h.cmd('roster.prepare',{week,shifts:[{staffId:spanish.id,site,start:'2026-11-05T09:00:00Z',end:'2026-11-05T12:00:00Z',breakMinutes:0,label:'Clock in'}]})
  await h.cmd('roster.publish',pin(draft))
  const original=(await h.state()).shifts.find(x=>x.rosterId===draft.id)
  await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded','x-test-now':String(Date.parse(now))},body:'confirm=yes',redirect:'manual'})
  const context=await browser.newContext({viewport:{width:1440,height:1000},ignoreHTTPSErrors:true}),errors=[]
  let blockCapture=false,unknownSave=false,browserNow=now
  await context.route('**/*',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname
   if(blockCapture&&['/api/lanyard/command','/api/lanyard/kiosk/capture'].includes(path)&&req.method()==='POST'&&req.postDataJSON()?.name?.startsWith('clock.'))return route.abort('internetdisconnected')
   if(unknownSave&&path==='/app/action'){unknownSave=false;return route.abort('connectionfailed')}
   if(path.startsWith('/fonts/')||path.startsWith('/brand/')||path.endsWith('.css')||path.endsWith('.js'))try{return await route.fulfill({body:await readFile(join('public',path.slice(1))),contentType:path.endsWith('.js')?'application/javascript':path.endsWith('.css')?'text/css':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}
   await route.continue({headers:{...req.headers(),'x-test-now':String(Date.parse(browserNow))}})
  })
  let page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date(now))
  const identity=async cookie=>{await context.clearCookies();const [name,...value]=cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin,secure:true}])}
  const open=async path=>{await page.goto(h.origin+path);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)}
  const shot=async name=>{if(process.env.LANGUAGE_SCREENS){await mkdir(process.env.LANGUAGE_SCREENS,{recursive:true});for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:join(process.env.LANGUAGE_SCREENS,`${name}-${width}.png`),fullPage:true})}await page.setViewportSize({width:1440,height:1000});await writeFile(join(process.env.LANGUAGE_SCREENS,name+'.txt'),await page.locator('body').innerText())}}
  const submit=async(button,command)=>{await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/app/action'&&new URL(r.url()).searchParams.get('name')===command),button.click()]);await page.waitForFunction(()=>Boolean(document.querySelector('.notice[role]')))}
  await identity(spanish.cookie);await open('/app/schedule?week='+week);await page.getByLabel('Account',{exact:true}).click();await page.getByRole('link',{name:'Settings',exact:true}).click()
  await page.getByLabel('My language').selectOption('es');await submit(page.getByRole('button',{name:'Save language',exact:true}),'clocklanguage.save')
  assert.equal(await page.locator('html').getAttribute('lang'),'es-US');assert.equal((await h.state(spanish.cookie)).clocklanguages[0].language,'es')
  await shot('spanish-settings')
  await h.cmd('clocklanguage.save',{language:'en'},english.cookie)
  assert.match((await h.send('/app/access',undefined,spanish.cookie)).text,/value="es" selected>Español/,'changing a PIN starts with the same personal language preference')
  const beforePrefs=await Promise.all([h.state(spanish.cookie),h.state(english.cookie)]).then(states=>states.map(s=>s.clocklanguages))
  await h.cmd('clocklanguage.save',{language:'es',staffId:english.id},spanish.cookie,400)
  assert.deepEqual(await Promise.all([h.state(spanish.cookie),h.state(english.cookie)]).then(states=>states.map(s=>s.clocklanguages)),beforePrefs,'personal preference cannot administer another employee')
  await open('/app/schedule?week='+week+'&day=2026-11-05');await page.getByRole('heading',{name:site+' · Mis turnos'}).waitFor()
  assert.ok((await page.locator('main').innerText()).includes('Clock in'),'authored shift label is not translated as a catalog key')
  await page.locator('.shift summary').first().click();await submit(page.getByRole('button',{name:'Confirmar turno',exact:true}),'shift.confirm')
  assert.ok((await h.state()).shifts.find(x=>x.id===original.id).confirmedAt)
  await page.getByRole('link',{name:'Semana anterior',exact:true}).focus();await page.getByRole('tooltip').waitFor({state:'visible'});assert.equal(await page.getByRole('tooltip').innerText(),'Semana anterior');await page.keyboard.press('Escape')
  await shot('spanish-schedule')
  const swap=()=>page.locator('form[action*="name=swap.propose"]').first()
  await page.locator('#swaps summary').click();await swap().locator('[name=to]').selectOption(english.id);await swap().getByLabel('Mensaje (opcional)').fill('Clock in')
  await context.setOffline(true);await swap().getByRole('button',{name:'Proponer intercambio'}).click()
  assert.match(await swap().locator('[data-save-feedback]').innerText(),/Sin conexión.*No enviado/);assert.equal((await h.state()).swaps.length,0);assert.equal(await swap().getByLabel('Mensaje (opcional)').inputValue(),'Clock in')
  await context.setOffline(false);unknownSave=true;await swap().getByRole('button',{name:'Proponer intercambio'}).click()
  await page.waitForFunction(()=>document.querySelector('[data-save-feedback]')?.textContent.includes('No se confirmó el guardado'))
  assert.equal(await swap().getByLabel('Mensaje (opcional)').inputValue(),'Clock in');assert.equal((await h.state()).swaps.length,0);await shot('spanish-save-unknown')
  await page.getByRole('link',{name:'Revisar registros actuales'}).click();await page.locator('#swaps summary').click();await swap().locator('[name=to]').selectOption(english.id);await swap().getByLabel('Mensaje (opcional)').fill('Clock in')
  await swap().locator('[name=revision]').evaluate(input=>input.value=String(Number(input.value)+1))
  await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/app/action'),swap().getByRole('button',{name:'Proponer intercambio'}).click()])
  await page.waitForFunction(()=>document.querySelector('[data-save-feedback]')?.textContent.includes('La revisión cambió'))
  assert.equal((await h.state()).swaps.length,0);assert.equal(await swap().getByLabel('Mensaje (opcional)').inputValue(),'Clock in')
  await page.getByRole('link',{name:'Revisar registros actuales'}).click();await page.locator('#swaps summary').click();await swap().locator('[name=to]').selectOption(english.id);await swap().getByLabel('Mensaje (opcional)').fill('Clock in')
  await submit(swap().getByRole('button',{name:'Proponer intercambio'}),'swap.propose')
  let change=(await h.state()).swaps.at(-1);assert.equal(change.note,'Clock in');await shot('spanish-swap')
  await identity(english.cookie);await open('/app/schedule?week='+week+'&day=2026-11-05')
  assert.equal(await page.locator('q').first().innerText(),'Clock in')
  await submit(page.getByRole('button',{name:'Agree',exact:true}),'swap.respond');change=(await h.state()).swaps.find(x=>x.id===change.id)
  await h.cmd('swap.decide',{...pin(change),decision:'approved'})
  const offer=await h.cmd('openshift.post',{site,start:'2026-11-06T09:00:00Z',end:'2026-11-06T12:00:00Z',breakMinutes:0,approval:'manager',label:'Registrar salida'})
  await identity(spanish.cookie);await open('/app/schedule?week='+week+'&day=2026-11-05')
  await submit(page.locator('#open-shifts').getByRole('button',{name:'Solicitar',exact:true}),'openshift.request')
  const pickup=(await h.state()).pickups.find(x=>x.openShiftId===offer.id&&x.staffId===spanish.id);assert.equal(pickup.status,'requested')
  await h.cmd('openshift.approve',pin(pickup));await open('/app/schedule?week='+week+'&day=2026-11-06');assert.ok((await page.locator('main').innerText()).includes('Registrar salida'));await shot('spanish-pickup')
  await open('/app/time?week='+week);await page.getByRole('heading',{name:'Mis horas',exact:true}).waitFor()
  const clock=()=>page.locator('[data-clock]')
  await clock().getByRole('button',{name:'Registrar entrada',exact:true}).waitFor({state:'visible'})
  await clock().getByRole('button',{name:'Registrar entrada',exact:true}).click();assert.equal(await clock().getByLabel('¿Listo para trabajar?').evaluate(field=>field.validationMessage),'Completa este campo.');assert.equal((await h.state(spanish.cookie)).clocks.length,0)
  blockCapture=true;await clock().getByLabel('¿Listo para trabajar?').selectOption('yes');await clock().getByRole('button',{name:'Registrar entrada',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-clock-status]').textContent.includes('1 pendientes'))
  browserNow='2026-11-04T12:05:00Z';await page.clock.setFixedTime(new Date(browserNow));await clock().getByRole('button',{name:'Iniciar descanso de comida',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-clock-status]').textContent.includes('2 pendientes'))
  browserNow='2026-11-04T12:15:00Z';await page.clock.setFixedTime(new Date(browserNow));await clock().getByRole('button',{name:'Terminar descanso de comida',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-clock-status]').textContent.includes('3 pendientes'))
  browserNow='2026-11-04T12:30:00Z';await page.clock.setFixedTime(new Date(browserNow));await clock().getByLabel('¿Tomaste todos tus descansos?').selectOption('no');await clock().getByLabel('Comentarios sobre tus descansos de hoy').fill('Clock in')
  await clock().getByRole('button',{name:'Registrar salida',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-clock-status]').textContent.includes('4 pendientes'))
  const saved=await page.evaluate(()=>window.LanyardClock.withState(document.querySelector('[data-clock]').dataset.actor,null,state=>structuredClone(state)))
  assert.equal(saved.events[3].capture.input.answers[q.id],'no');assert.equal(saved.events[0].capture.input.capturedAt,now);await shot('spanish-browser-pending')
  await page.close();await h.restart();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date('2026-11-04T12:30:00Z'));const offlineAttempt=page.waitForEvent('requestfailed',{predicate:r=>new URL(r.url()).pathname==='/api/lanyard/command'});await open('/app/time?week='+week);await offlineAttempt
  await page.waitForFunction(()=>document.querySelector('[data-clock-status]').textContent.includes('4 pendientes'))
  await page.waitForFunction(()=>!document.querySelector('[data-clock-retry]').disabled)
  blockCapture=false;await clock().getByRole('button',{name:'Reintentar registros pendientes'}).click();await page.waitForFunction(()=>document.querySelector('[data-clock-status]').textContent.includes('0 pendientes'))
  const own=(await h.state(spanish.cookie)).timesheets.find(t=>t.staffId===spanish.id);assert.equal(own.minutes,20);assert.equal(own.breakMinutes,10);assert.equal(own.start,now);assert.equal(own.end,'2026-11-04T12:30:00.000Z');assert.equal(own.answers.find(a=>a.questionId===q.id).value,'no');assert.equal(own.answers.find(a=>a.questionId===q.id).text,q.text);assert.equal(own.answers.find(a=>a.questionId===q.id).textEs,q.textEs);assert.equal(own.breakAttestation.note,'Clock in')
  await shot('spanish-timesheet')
  await identity(english.cookie);await open('/app/time?week='+week);await clock().getByLabel('Ready for work?').selectOption('yes')
  await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/lanyard/command'&&r.request().postDataJSON().name==='clock.in'),clock().getByRole('button',{name:'Clock in',exact:true}).click()]);await page.waitForFunction(()=>document.querySelector('[data-clock-form]').dataset.command==='clock.out')
  browserNow='2026-11-04T12:45:00Z';await page.clock.setFixedTime(new Date(browserNow));await clock().getByLabel('Did you take all your breaks?').selectOption('yes');await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/lanyard/command'&&r.request().postDataJSON().name==='clock.out'),clock().getByRole('button',{name:'Clock out',exact:true}).click()]);await page.waitForFunction(()=>document.querySelector('[data-clock-form]').dataset.command==='clock.in')
  assert.equal((await h.state(english.cookie)).timesheets.find(t=>t.staffId===english.id).minutes,15);await shot('english-timesheet')
  const revisedQuestion=await h.cmd('question.save',{...pin(q),site,when:'out',kind:'breaks',text:'Were all your breaks taken?',textEs:'¿Tomaste cada descanso?',required:true})
  assert.equal((await h.state(spanish.cookie)).timesheets.find(t=>t.id===own.id).answers.find(a=>a.questionId===q.id).version,1)

  // Shared kiosk proof continues in the same native implementation, without provider or hardware claims.
  for(const [p,language,pinValue]of [[spanish,'es','123456'],[english,'en','234567']])await h.cmd('kiosk.pin',{pin:pinValue,language,consent:true},p.cookie)
  const enrolled=await h.send('/api/lanyard/command',{name:'kiosk.enroll',input:{site,label:'Synthetic kiosk',photo:true,consent:true}},h.owner)
  assert.equal(enrolled.status,200,enrolled.text);await identity(enrolled.cookie);await open('/app/kiosk')
  const signin=async(p,pinValue)=>{await page.locator('#kiosk-signin [name=email]').fill(p.email);await page.locator('#kiosk-signin [name=pin]').fill(pinValue);await page.getByRole('button',{name:'Verify employee',exact:true}).click();await page.locator('#kiosk-person').waitFor({state:'visible'})}
  await signin(spanish,'123456');await page.getByRole('heading',{name:'Tu reloj',exact:true}).waitFor();assert.match(await page.locator('#consent-copy').innerText(),/consentimiento.*privada.*propietario/)
  await shot('spanish-kiosk')
  blockCapture=true;browserNow='2026-11-04T12:46:00Z';await page.clock.setFixedTime(new Date(browserNow));await page.locator('#kiosk-questions').getByLabel('¿Listo para trabajar?').selectOption('yes');await page.locator('[name=photoFailure]').selectOption('camera denied')
  await page.getByRole('button',{name:'Registrar entrada',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#kiosk-pending').textContent.startsWith('1 registros'))
  await page.locator('#kiosk-questions').getByLabel('¿Tomaste cada descanso?').selectOption('yes');await page.locator('#kiosk-questions').getByLabel('Comentarios sobre tus descansos de hoy').fill('Start meal')
  browserNow='2026-11-04T12:47:00Z';await page.clock.setFixedTime(new Date(browserNow));await page.locator('[name=photoFailure]').selectOption('camera denied');await page.getByRole('button',{name:'Registrar salida',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#kiosk-pending').textContent.startsWith('2 registros'))
  await shot('spanish-kiosk-pending');await page.close();await h.restart();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date(browserNow))
  const kioskAttempt=page.waitForEvent('requestfailed',{predicate:r=>new URL(r.url()).pathname==='/api/lanyard/kiosk/capture'});await open('/app/kiosk');await kioskAttempt
  await page.waitForFunction(()=>document.querySelector('#kiosk-pending').textContent.startsWith('2 registros'))
  blockCapture=false;await page.getByRole('button',{name:'Reintentar registros guardados'}).click();await page.waitForFunction(()=>document.querySelector('#kiosk-pending').textContent.startsWith('0 registros'))
  const kioskTime=(await h.state(spanish.cookie)).timesheets.find(t=>t.start==='2026-11-04T12:46:00.000Z');assert.equal(kioskTime.minutes,1);assert.equal(kioskTime.breakAttestation.note,'Start meal');assert.equal(kioskTime.answers.find(a=>a.questionId===q.id).version,revisedQuestion.version);assert.equal(kioskTime.answers.find(a=>a.questionId===q.id).textEs,'¿Tomaste cada descanso?')
  const spanishReceipts=(await h.state(spanish.cookie)).kioskreceipts;assert.equal(spanishReceipts.length,2);assert.ok(spanishReceipts.every(r=>r.staffId===spanish.id&&r.language==='es'&&!r.photoConsent&&r.photoException==='camera denied'));assert.equal(spanishReceipts.find(r=>r.name==='clock.in').capturedAt,'2026-11-04T12:46:00.000Z')
  await page.getByRole('button',{name:'Cerrar sesión para la siguiente persona'}).click();await signin(english,'234567');await page.getByRole('heading',{name:'Your clock',exact:true}).waitFor()
  assert.equal(await page.locator('#consent-copy').innerText(),'I consent to this punch photo being stored privately for me and the owner until explicitly deleted.')
  assert.equal(await page.locator('[name=photoFailure] option').nth(1).innerText(),'Camera permission denied');assert.equal(await page.locator('[data-kiosk-video]').getAttribute('aria-label'),'Punch camera preview');await shot('english-kiosk-reset')
  assert.equal(await page.locator('[name=photoConsent]').isChecked(),false)
  const enState=await context.request.get(h.origin+'/api/lanyard/kiosk/state',{headers:{'x-test-now':String(Date.parse(browserNow))}});assert.equal((await enState.json()).staffId,english.id)
  browserNow='2026-11-04T12:48:00Z';await page.clock.setFixedTime(new Date(browserNow));await page.locator('#kiosk-questions').getByLabel('Ready for work?').selectOption('yes');await page.locator('[name=photoFailure]').selectOption('camera denied');await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/lanyard/kiosk/capture'&&r.request().postDataJSON().name==='clock.in'),page.getByRole('button',{name:'Clock in',exact:true}).click()]);await page.locator('#kiosk-questions').getByLabel('Were all your breaks taken?').waitFor();await page.waitForFunction(()=>document.querySelector('#kiosk-pending').textContent.startsWith('0 saved')&&!document.querySelector('#kiosk-clock button[name="clock.out"]').disabled)
  browserNow='2026-11-04T12:49:00Z';await page.clock.setFixedTime(new Date(browserNow));await page.locator('#kiosk-questions').getByLabel('Were all your breaks taken?').selectOption('yes');await page.locator('[name=photoFailure]').selectOption('camera denied');await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/lanyard/kiosk/capture'&&r.request().postDataJSON().name==='clock.out'),page.getByRole('button',{name:'Clock out',exact:true}).click()]);await page.waitForFunction(()=>document.querySelector('#kiosk-pending').textContent.startsWith('0 saved')&&!document.querySelector('#kiosk-clock button[name="clock.in"]').disabled)
  assert.equal((await h.state(english.cookie)).timesheets.find(t=>t.start==='2026-11-04T12:48:00.000Z').minutes,1);assert.ok((await h.state(english.cookie)).kioskreceipts.every(r=>r.staffId===english.id&&r.language==='en'))
  await page.getByRole('button',{name:'Sign out for next employee',exact:true}).click();await page.locator('#kiosk-person').waitFor({state:'hidden'});assert.equal(await page.locator('#kiosk-current').innerText(),'');assert.equal(await page.locator('#kiosk-person').isVisible(),false)
  // Punch-specific notices and exceptions use Spanish without changing their retained facts.
  await h.cmd('photo.save',{site,phone:true,browser:true,kiosk:false,breaks:false,retentionDays:30,consent:true})
  await h.cmd('geofence.save',{site,latitude:37.76,longitude:-122.5,radiusMeters:200,maxAccuracyMeters:50,retentionDays:30,enabled:true,consent:true})
  const device=await h.send('/api/lanyard/command',{name:'clockbrowser.enroll',input:{site,label:'Synthetic browser',type:'browser'}},h.owner)
  assert.equal(device.status,200,device.text)
  await identity(spanish.cookie);const [deviceName,...deviceValue]=device.cookie.split('=');await context.addCookies([{name:deviceName,value:deviceValue.join('='),url:h.origin,secure:true}])
  browserNow='2026-11-04T13:00:00Z';await page.clock.setFixedTime(new Date(browserNow))
  await page.addInitScript(()=>{
   window.punchPermissionCalls={camera:0,location:0}
   Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:(_success,fail)=>{window.punchPermissionCalls.location++;fail({code:1})}}})
   Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{window.punchPermissionCalls.camera++;throw new DOMException('Denied','NotAllowedError')}}})
  })
  await open('/app/time?week='+week)
  assert.deepEqual(await page.evaluate(()=>window.punchPermissionCalls),{camera:0,location:0})
  await clock().getByLabel('¿Listo para trabajar?').selectOption('yes')
  const beforePrivate=(await h.state(spanish.cookie)).clocks.length
  await clock().getByRole('button',{name:'Registrar entrada',exact:true}).click()
  await page.waitForFunction(()=>document.querySelector('[data-clock-status]').textContent.includes('Lee y confirma el aviso de ubicación'))
  assert.equal((await h.state(spanish.cookie)).clocks.length,beforePrivate)
  assert.deepEqual(await page.evaluate(()=>window.punchPermissionCalls),{camera:0,location:0})
  await clock().getByLabel('He leído el aviso de ubicación de este lugar').check()
  // Declining location does not request it, and a missing photo notice still prevents a new capture.
  await clock().getByRole('button',{name:'Registrar entrada',exact:true}).click()
  await page.waitForFunction(()=>document.querySelector('[data-clock-status]').textContent.includes('Lee y confirma el aviso de fotos'))
  assert.equal((await h.state(spanish.cookie)).clocks.length,beforePrivate)
  assert.deepEqual(await page.evaluate(()=>window.punchPermissionCalls),{camera:0,location:0})
  await clock().getByLabel('He leído el aviso de fotos de este lugar').check()
  await clock().getByLabel('Doy mi consentimiento para capturar la ubicación de este registro').check()
  await clock().getByLabel('Doy mi consentimiento para una foto de este registro').check()
  await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/lanyard/command'&&r.request().postDataJSON().name==='clock.in'),clock().getByRole('button',{name:'Registrar entrada',exact:true}).click()])
  await page.waitForFunction(()=>document.querySelector('[data-clock-form]').dataset.command==='clock.out')
  browserNow='2026-11-04T13:15:00Z';await page.clock.setFixedTime(new Date(browserNow))
  await clock().getByLabel('¿Tomaste cada descanso?').selectOption('yes')
  await clock().getByLabel('He leído el aviso de ubicación de este lugar').check();await clock().getByLabel('He leído el aviso de fotos de este lugar').check()
  await clock().getByLabel('¿Alguna lesión hoy?').selectOption('yes')
  // Refused consent remains a coordinate-free and image-free captured exception.
  assert.equal(await clock().getByLabel('Doy mi consentimiento para capturar la ubicación de este registro').isChecked(),false)
  assert.equal(await clock().getByLabel('Doy mi consentimiento para una foto de este registro').isChecked(),false)
  await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/lanyard/command'&&r.request().postDataJSON().name==='clock.out'),clock().getByRole('button',{name:'Registrar salida',exact:true}).click()])
  await page.waitForFunction(()=>document.querySelector('[data-clock-form]').dataset.command==='clock.in')
  const privateTime=(await h.state(spanish.cookie)).timesheets.find(t=>t.start==='2026-11-04T13:00:00.000Z')
  assert.equal(privateTime.minutes,15);assert.ok(privateTime.exceptions.includes('location permission denied'));assert.ok(privateTime.exceptions.includes('location consent declined'));assert.ok(privateTime.exceptions.includes('punch photo unavailable: camera denied'));assert.ok(privateTime.exceptions.includes('punch photo unavailable: photo consent declined'))
  const privatePhotos=(await h.state()).timesheets.find(t=>t.id===privateTime.id).photoReview
  assert.equal(privatePhotos.length,2);assert.ok(privatePhotos.every(r=>!r.photoId&&!r.photoConsent));assert.equal(privateTime.photoReview,undefined,'employee snapshot retains the existing owner-only photo review boundary');assert.equal(privateTime.locationReview.length,2);assert.ok(privateTime.locationReview.every(r=>r.latitude===undefined&&r.longitude===undefined&&!r.consent))
  const privateRow=page.locator('tr').filter({has:page.locator('.punch-locations')})
  await privateRow.getByText('Registrar entrada · permiso de ubicación denegado',{exact:true}).waitFor()
  await privateRow.getByText('Registrar salida · consentimiento de ubicación rechazado',{exact:true}).waitFor()
  assert.match(await privateRow.innerText(),/permiso de cámara denegado/);assert.match(await privateRow.innerText(),/foto del registro no disponible: consentimiento rechazado/)
  const injury=(await h.state(spanish.cookie)).injuries.find(r=>r.questionId===injuryQuestion.id&&r.answer==='yes')
  assert.ok(injury);assert.match(await page.locator('#safety').innerText(),/¿Alguna lesión hoy\?.”? sí · abierto/)
  await h.cmd('injury.resolve',{...pin(injury),reason:'Clock in'})
  await open('/app/time?week='+week)
  assert.match(await page.locator('#safety').innerText(),/resuelto: Clock in/,'generated follow-up state is translated while the authored resolution stays unchanged')
  await shot('spanish-private-punch-exceptions')
  await context.close();assert.deepEqual(errors,[])

  console.log('LANG-001 native preference, assignment changes, encrypted clock replay, original text and kiosk language reset passed')
 }finally{await browser.close();await h.close()}
}
export async function untranslatedBuildRefusal(){
 const root=await mkdtemp(join(tmpdir(),'lanyard-language-'))
 try{
  for(const path of ['./src/lanyard/ui','src/lanyard/localization.ts','src/lanyard/staff-catalog.json','src/lanyard/domain/photos.ts','src/lanyard/domain/geofence.ts','public'])await cp(path,join(root,path),{recursive:true})
  const run=()=>spawnSync(process.execPath,['scripts/check-staff-strings.mjs','--root',root],{encoding:'utf8'})
  assert.equal(run().status,0)
  const file=join(root,'src/lanyard/ui/swaps.ts'),source=await readFile(file,'utf8')
  await writeFile(file,source.replace('<p>Nothing changes','<p>synthetic-lanyard-untranslated</p><p>Nothing changes'))
  let result=run();assert.notEqual(result.status,0);assert.match(result.stderr,/Missing Spanish.*synthetic-lanyard-untranslated/)
  const catalogFile=join(root,'src/lanyard/staff-catalog.json'),catalog=JSON.parse(await readFile(catalogFile,'utf8'));catalog['synthetic-lanyard-untranslated']='Texto de prueba';await writeFile(catalogFile,JSON.stringify(catalog));assert.equal(run().status,0,'supplying Spanish restores the build gate')
  await writeFile(file,source.replace("card(tr(s,'Shift swaps')", "card('synthetic-lanyard-helper'"))
  result=run();assert.notEqual(result.status,0);assert.match(result.stderr,/Missing Spanish.*synthetic-lanyard-helper/)
  await writeFile(file,source)
  const noticeFile=join(root,'src/lanyard/domain/photos.ts'),noticeSource=await readFile(noticeFile,'utf8')
  await writeFile(noticeFile,noticeSource.replace('A still photo is captured','synthetic-lanyard-notice A still photo is captured'))
  result=run();assert.notEqual(result.status,0);assert.match(result.stderr,/Missing Spanish.*synthetic-lanyard-notice/)
  await writeFile(noticeFile,noticeSource)
  const cameraFile=join(root,'public/punch-photo.js'),cameraSource=await readFile(cameraFile,'utf8')
  await writeFile(cameraFile,cameraSource.replace('Photo is too large','synthetic-lanyard-camera message'))
  result=run();assert.notEqual(result.status,0);assert.match(result.stderr,/Missing Spanish.*synthetic-lanyard-camera/)

 }finally{await rm(root,{recursive:true,force:true})}
}
if(process.argv[1]===new URL(import.meta.url).pathname){await languageJourney();await untranslatedBuildRefusal()}
