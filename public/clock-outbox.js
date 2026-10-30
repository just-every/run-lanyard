/* Actor-scoped encrypted captures. The server alone decides whether a capture is accepted. */
(() => {
  const t=(source,values)=>window.LanyardStaff.t(source,values),text=(strings,...values)=>window.LanyardStaff.text(strings,...values),errorText=source=>window.LanyardStaff.error(source)
  const names = {'clock.in':t('Clock in'),'clock.out':t('Clock out'),'clock.breakStart':t('Start break'),'clock.breakEnd':t('End break'),'clock.transfer':t('Change job')}
  const encoder = new TextEncoder(), decoder = new TextDecoder()
  const stopped = new Set(), channels = new Map()
  const databaseName = actor => `lanyard.clock.outbox.${actor}`
  const request = value => new Promise((resolve, reject) => { value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error) })
  const completed = tx => new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(tx.error || new Error(t('Browser storage failed.'))) })
  const channelFor = actor => {
    if (!channels.has(actor) && window.BroadcastChannel) {
      const channel = new BroadcastChannel(databaseName(actor))
      channel.addEventListener('message', event => {
        if (event.data === 'signedout') stopped.add(actor)
        window.dispatchEvent(new CustomEvent('lanyard-clock-change', {detail:actor}))
      })
      channels.set(actor, channel)
    }
    return channels.get(actor)
  }
  const notify = actor => channelFor(actor)?.postMessage('changed')
  function exclusive(actor, work) {
    if (!navigator.locks || !window.indexedDB || !crypto.subtle) return Promise.reject(new Error(t('Secure browser storage and Web Locks are required to capture time on this device.')))
    return navigator.locks.request(databaseName(actor), async () => {
      if (stopped.has(actor)) throw new Error(t('You have signed out. Sign in again before using the clock.'))
      return work()
    })
  }
  async function open(actor) {
    const opening = indexedDB.open(databaseName(actor), 1)
    opening.onupgradeneeded = () => opening.result.createObjectStore('vault')
    const db = await request(opening)
    db.onversionchange = () => db.close()
    return db
  }
  function validCapture(capture) {
    return capture && names[capture.name] && typeof capture.input?.commandId === 'string' && capture.input.commandId.length > 0 && typeof capture.input.capturedAt === 'string' && Number.isFinite(Date.parse(capture.input.capturedAt))
  }
  // The CryptoKey is persisted by structured clone, never exported. The actor is authenticated
  // encryption data as well as the database namespace; a lost key never creates a new empty queue.
  async function read(db, actor, initial) {
    const tx = db.transaction('vault', 'readonly'), done = completed(tx), store = tx.objectStore('vault')
    const [key, sealed] = await Promise.all([request(store.get('key')), request(store.get('state'))])
    await done
    if (sealed && !key) throw new Error(t('The saved clock encryption key is missing. The saved captures cannot be read.'))
    const secret = key || await crypto.subtle.generateKey({name:'AES-GCM',length:256}, false, ['encrypt','decrypt'])
    let state = {base:initial,events:[]}
    if (sealed) {
      const plain = await crypto.subtle.decrypt({name:'AES-GCM',iv:sealed.iv,additionalData:encoder.encode(actor)}, secret, sealed.data)
      state = JSON.parse(decoder.decode(plain))
      if (!Array.isArray(state.events) || state.events.some(event => !validCapture(event.capture) || !['pending','rejected'].includes(event.status))) throw new Error(t('The saved clock queue cannot be read.'))
    }
    return {state,secret}
  }
  async function write(db, actor, secret, state) {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const data = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(actor)}, secret, encoder.encode(JSON.stringify(state)))
    const tx = db.transaction('vault', 'readwrite'), done = completed(tx), store = tx.objectStore('vault')
    store.put(secret, 'key'); store.put({iv,data}, 'state')
    await done
  }
  async function withState(actor, initial, work) {
    return exclusive(actor, () => openedState(actor, initial, work))
  }
  async function openedState(actor, initial, work) {
    const db = await open(actor)
    try {
      const {state,secret} = await read(db, actor, initial)
      const save = () => write(db, actor, secret, state)
      // Migration removes plaintext only after encrypted persistence has committed. Repeated
      // migration after interruption deduplicates the original command identity.
      const legacy = localStorage.getItem(databaseName(actor))
      if (legacy) {
        const parsed = JSON.parse(legacy), captures = Array.isArray(parsed) ? parsed : [parsed]
        if (!captures.every(validCapture)) throw new Error(t('The legacy clock queue cannot be read. It has been kept on this device.'))
        for (const capture of captures) if (!state.events.some(event => event.capture.input.commandId === capture.input.commandId)) state.events.push({capture,status:'pending'})
        await save()
        localStorage.removeItem(databaseName(actor))
      }
      return await work(state, save)
    } finally { db.close() }
  }
  // Projection is deliberately limited to valid local transitions. A rejected original is
  // retained for review but must not invent an accepted clock-in or break on this device.
  function apply(base, capture) {
    const clock = base ? structuredClone(base) : null, at = capture.input.capturedAt
    const current = clock?.breaks?.find(item => !item.end)
    if (capture.name === 'clock.in' && !clock) return {start:at,status:'open',breaks:[],job:capture.input.job ?? '',site:capture.input.site ?? ''}
    if (!clock || at < clock.start) throw new Error(t('This event does not follow the current clock. Resolve the earlier captures first.'))
    if (capture.name === 'clock.out' && !current && at > clock.start && (clock.transfers || []).every(item => at > item.at) && (clock.breaks || []).every(item => at >= item.end)) return null
    if (capture.name === 'clock.breakStart' && !current && ['meal','rest'].includes(capture.input.kind)) {
      const last = clock.breaks?.at(-1)
      if (last?.end && at < last.end) throw new Error(t('A break must follow the previous break.'))
      if ((clock.transfers || []).some(item => at < item.at)) throw new Error(t('A break must follow the last job change.'))
      clock.breaks = [...(clock.breaks || []),{kind:capture.input.kind,start:at,end:null}]
      return clock
    }
    if (capture.name === 'clock.breakEnd' && current && at > current.start) { current.end = at; return clock }
    if (capture.name === 'clock.transfer' && !current && at > clock.start && (clock.transfers || []).every(item => at > item.at) && (clock.breaks || []).every(item => at >= item.end) && capture.input.job) {
      clock.transfers = [...(clock.transfers || []),{at,job:capture.input.job,site:capture.input.site ?? null}]
      return clock
    }
    throw new Error(t('This event does not follow the current clock. Resolve the earlier captures first.'))
  }
  function project(state) {
    let clock = state.base
    for (const event of state.events) {
      if (event.status === 'rejected') break
      try { clock = apply(clock, event.capture) } catch { break }
    }
    return clock
  }
  async function post(capture) {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 20000)
    try {
      const response = await fetch('/api/lanyard/command', {method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',signal:controller.signal,body:JSON.stringify(capture)})
      let payload
      try { payload = await response.json() } catch { payload = null }
      const error = typeof payload?.error === 'string' ? payload.error : payload?.error?.message || payload?.message || text`Request failed (${response.status}).`
      return {response,payload,error}
    } finally { clearTimeout(timeout) }
  }
  async function report(event) {
    const result = await post({name:'clock.report',input:{commandId:event.reportId,capture:event.capture,error:event.error}})
    if (result.response.ok && result.payload?.ok === true) event.reported = true
    return result
  }
  function fieldsFor(clock, phase) {
    const template = clock.querySelector(`template[data-clock-fields="${phase}"]`)
    if (!template) throw new Error(t('Clock fields are missing. Reload before capturing time.'))
    return template.content.cloneNode(true)
  }
  function start(clock) {
    const actor = clock.dataset.actor, form = clock.querySelector('[data-clock-form]'), status = clock.querySelector('[data-clock-status]'), retry = clock.querySelector('[data-clock-retry]')
    if (!actor || !form || !status || !retry) return
    const show = text => { status.textContent = text }
    let initial
    try {
      if (!Object.hasOwn(clock.dataset, 'state')) throw new Error(t('Clock state is missing. Reload before capturing time.'))
      initial = JSON.parse(clock.dataset.state)
    } catch (error) { show(errorText(error.message)); form.querySelectorAll('button').forEach(button => { button.disabled = true }); return }
    let fields
    try { fields = {in:fieldsFor(clock, 'in'),out:fieldsFor(clock, 'out')} } catch (error) { show(error.message); form.querySelectorAll('button').forEach(button => { button.disabled = true }); return }
    const primary = form.querySelector('button.primary') || form.querySelector('button[type="submit"]')
    const submit = primary.cloneNode(true), fieldset = document.createElement('fieldset'), actions = document.createElement('div')
    fieldset.style.border = '0'; fieldset.style.padding = '0'; fieldset.style.margin = '0'
    actions.className = 'break-actions'
    form.replaceChildren(fieldset, actions, submit)
    const events = document.createElement('ul'); events.className = 'note'; events.dataset.clockEvents = ''
    retry.after(events)
    let phase = '', snapshot, syncing = false, capturing = false, ready = false, failed = false
    const timezone = document.body.dataset.timezone
    const display = at => `${new Intl.DateTimeFormat(document.documentElement.lang, {timeZone:timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(at))} (${timezone})`
    function render(state) {
      snapshot = structuredClone(state)
      const projected = project(state), onBreak = projected?.breaks?.find(item => !item.end), next = !projected ? 'in' : onBreak ? 'break' : 'out'
      if (phase !== next) {
        phase = next
        fieldset.replaceChildren(...(next === 'break' ? [] : [fields[next].cloneNode(true)]))
        actions.replaceChildren()
        if (next === 'out') for (const kind of ['meal','rest']) {
          const button = document.createElement('button')
          Object.assign(button,{type:'submit',className:'secondary',textContent:text`Start ${t(kind)} break`,formNoValidate:true})
          button.dataset.command = 'clock.breakStart'; button.dataset.kind = kind; actions.append(button)
        }
      }
      const timedMeal = projected?.breaks?.some(item => item.kind === 'meal')
      const meal = fieldset.querySelector('[name="breakMinutes"]')
      if (meal) { meal.readOnly = Boolean(timedMeal); if (timedMeal) meal.value = '0' }
      form.dataset.command = !projected ? 'clock.in' : onBreak ? 'clock.breakEnd' : 'clock.out'
      submit.textContent = onBreak ? text`End ${t(onBreak.kind)} break` : names[form.dataset.command]
      const heading = clock.querySelector('.clock-state strong')
      if (heading) heading.textContent = projected ? text`Clocked in at ${display(projected.start)}${onBreak ? text` · on ${t(onBreak.kind)} break` : ''}` : t('You are clocked out.')
      const staleBreaks = clock.querySelector(':scope > .breaks'); if (staleBreaks) staleBreaks.hidden = true
      events.replaceChildren()
      for (const item of state.events) {
        const li = document.createElement('li'), capture = item.capture
        li.append(`${names[capture.name]}${capture.name === 'clock.breakStart' ? ` (${t(capture.input.kind)})` : ''} · ${display(capture.input.capturedAt)} · ${item.status === 'rejected' ? text`Unresolved: ${errorText(item.error)}${item.reported ? t(' Reported for manager review.') : t(' Kept on this device; not yet reported.')}` : t('Pending sync.')}`)
        if (item.status === 'rejected') {
          const discard = document.createElement('button')
          Object.assign(discard,{type:'button',className:'secondary small',textContent:t('Discard local copy')})
          discard.addEventListener('click', () => discardEvent(capture.input.commandId)); li.append(' ',discard)
        }
        events.append(li)
      }
      retry.hidden = !state.events.length; retry.disabled = syncing
      retry.textContent = t('Retry queued clock events')
      form.querySelectorAll('button').forEach(button => { button.disabled = capturing || !ready || failed || state.events.some(item => item.status === 'rejected') })
      show(text`${state.events.filter(item => item.status === 'pending').length} pending · ${state.events.filter(item => item.status === 'rejected').length} unresolved${syncing ? t(' · Syncing…') : ''}`)
    }
    function failure(error) {
      failed = true; form.querySelectorAll('button').forEach(button => { button.disabled = true })
      show(text`${errorText(error.message) || t('Browser storage failed.')} Your saved clock events have not been discarded. Reload before capturing more time.`)
    }
    async function refresh() {
      try { await withState(actor, initial, async state => { render(state) }) } catch (error) { failure(error) }
    }
    async function discardEvent(id) {
      if (!confirm(t('Discard this unresolved capture from this device? This cannot be undone. A report already sent to your manager is retained there.'))) return
      try {
        await withState(actor, initial, async (state, save) => { state.events = state.events.filter(item => item.capture.input.commandId !== id || item.status !== 'rejected'); await save(); render(state) })
        notify(actor)
      } catch (error) { failure(error) }
    }
    async function sync() {
      if (syncing || !ready || failed || navigator.onLine === false) return
      syncing = true; if (snapshot) render(snapshot)
      let syncError = '', acceptedChange = false
      try {
        await withState(actor, initial, async (state, save) => {
          let blockedBy = ''
          for (const item of [...state.events]) {
            if (item.status === 'rejected') {
              blockedBy = item.capture.input.commandId
              if (!item.reported) { const sent = await report(item); await save(); if ([401,403].includes(sent.response.status)) break }
              continue
            }
            if (blockedBy) {
              item.status = 'rejected'; item.error = text`Not replayed because earlier capture ${blockedBy} was rejected. Ask your manager to reconcile these original captures.`
              item.reportId = crypto.randomUUID(); item.reported = false
              await save(); render(state); notify(actor)
              const sent = await report(item); await save()
              if ([401,403].includes(sent.response.status)) break
              continue
            }
            const result = await post(item.capture)
            if (result.response.ok && result.payload?.ok === true) {
              const accepted = result.payload.result?.clock || result.payload.result
              if (!accepted || typeof accepted.status !== 'string') throw new Error(t('The server response did not include the accepted clock state. Retry uses the same capture ID.'))
              state.base = accepted.status === 'open' ? accepted : null
              state.version = result.payload.version
              acceptedChange = true
              state.events = state.events.filter(event => event !== item)
              await save(); render(state); notify(actor); continue
            }
            if (result.response.status < 400 || result.response.status >= 500 || [408,429].includes(result.response.status)) throw new Error(text`${errorText(result.error)} The original captures remain queued.`)
            item.status = 'rejected'; item.error = result.error; item.reportId = crypto.randomUUID(); item.reported = false
            blockedBy = item.capture.input.commandId
            await save(); render(state); notify(actor)
            if ([401,403].includes(result.response.status)) { state.revoked = true; await save(); break }
            const sent = await report(item); await save()
            if ([401,403].includes(sent.response.status)) break
          }
          render(state)
        })
      } catch (error) { syncError = text`${errorText(error.message) || t('Connection failed.')} Original captures remain on this device.` }
      finally { syncing = false; if (snapshot) { retry.disabled = false; show(text`${snapshot.events.filter(item => item.status === 'pending').length} pending · ${snapshot.events.filter(item => item.status === 'rejected').length} unresolved${syncError ? ` · ${syncError}` : ''}`) } }
      if (acceptedChange && !snapshot.events.length && !capturing) window.location.reload()
    }
    form.addEventListener('submit', async event => {
      event.preventDefault()
      if (!ready || failed || capturing) return
      const name = event.submitter?.dataset.command || form.dataset.command
      const input = {commandId:crypto.randomUUID(),capturedAt:new Date().toISOString()}, data = new FormData(form)
      if (name === 'clock.in' || name === 'clock.out') {
        const answers = {}
        for (const [key,value] of data) if (key.startsWith('answer:') && value !== '') answers[key.slice(7)] = value
        if (Object.keys(answers).length) input.answers = answers
      }
      if (name === 'clock.breakStart') input.kind = event.submitter.dataset.kind
      if (name === 'clock.transfer') {
        input.job = data.get('transferJob') || ''
        if (data.get('transferSite')) input.site = data.get('transferSite')
      }
      if (name === 'clock.out') {
        input.breakMinutes = Number(data.get('breakMinutes'))
        if (data.get('meal')) input.meal = data.get('meal')
        if (data.get('waiveMeal')) input.waiveMeal = true
        if (data.get('breakNote')) input.breakNote = data.get('breakNote')
      }
      const capture = {name,input}
      capturing = true; if (snapshot) render(snapshot)
      try {
        await withState(actor, initial, async (state, save) => {
          if (state.events.some(item => item.status === 'rejected')) throw new Error(t('Resolve the saved rejected captures before recording more events.'))
          Object.assign(input, await window.LanyardPunchLocation?.capture(clock,name,input.capturedAt) ?? {})
          Object.assign(input, await window.LanyardPunchPhoto?.capture(clock,name) ?? {})
          apply(project(state), capture)
          state.events.push({capture,status:'pending'}); await save(); render(state)
        })
        notify(actor); sync()
      } catch (error) { show(text`${errorText(error.message)} This new event was not queued or sent.`) }
      finally { capturing = false; form.querySelectorAll('button').forEach(button => { button.disabled = !ready || failed || snapshot?.events.some(item => item.status === 'rejected') }) }
    })
    retry.addEventListener('click', sync)
    window.addEventListener('online', sync)
    window.addEventListener('lanyard-clock-change', event => { if (event.detail === actor) refresh() })
    window.addEventListener('pageshow', () => { if (ready) refresh().then(sync) })
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ready) refresh().then(sync) })
    channelFor(actor)
    form.querySelectorAll('button').forEach(button => { button.disabled = true })
    withState(actor, initial, async (state, save) => {
      state.owner = {actorId:actor,staffId:document.body.dataset.staffId}
      const renderedVersion = Number(clock.dataset.version)
      if (!state.events.length && (state.version === undefined || Number.isFinite(renderedVersion) && renderedVersion >= state.version)) {
        state.base = initial
        if (Number.isFinite(renderedVersion)) state.version = renderedVersion
      }
      await save(); ready = true; render(state)
    }).then(sync).catch(failure)
  }
  async function signOut(button) {
    const actor = document.querySelector('[data-clock]')?.dataset.actor || button.dataset.actor || document.body.dataset.actor
    const send = async () => {
      const response = await fetch('/auth/signout', {method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:'{}'})
      if (!response.ok) throw new Error(t('Could not sign out'))
    }
    if (!actor) throw new Error(t('Your clock identity is missing. Reload before signing out.'))
    let signedOut = false
    await exclusive(actor, async () => {
      await openedState(actor, null, async state => {
        const count = state.events.length
        if (count && !confirm(text`There ${count === 1 ? t('is 1 saved clock event') : text`are ${count} saved clock events`} on this device, including pending and unresolved captures. Signing out will delete these local originals. Cancel to keep them and sync or ask your manager first. Sign out and delete?`)) return
        await send(); stopped.add(actor); signedOut = true
      })
      if (signedOut) {
        channelFor(actor)?.postMessage('signedout')
        await request(indexedDB.deleteDatabase(databaseName(actor)))
      }
    })
    if (!signedOut) { button.disabled = false; return }
    location.assign('/signin')
  }
  window.LanyardClock = {start,signOut,withState,databaseName,apply,project}
})()
