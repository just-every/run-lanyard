/* Form conveniences and a durable clock outbox. Application authorization stays on the server. */
(() => {
  document.querySelector('[data-signout]')?.addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true
    try {
      const response = await fetch('/auth/signout', {method:'POST',headers:{'content-type':'application/json'},body:'{}'})
      if (!response.ok) throw new Error('Could not sign out')
      location.assign('/signin')
    } catch { button.disabled = false; button.textContent = 'Retry sign out' }
  })
  const timezone = document.body.dataset.timezone
  const wallFormat = new Intl.DateTimeFormat('en-GB-u-ca-gregory-nu-latn', {
    timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',
  })
  const displayFormat = new Intl.DateTimeFormat('en-US', {timeZone:timezone,dateStyle:'medium',timeStyle:'short'})
  const wallAt = instant => {
    const parts = Object.fromEntries(wallFormat.formatToParts(new Date(instant)).filter(p => p.type !== 'literal').map(p => [p.type,p.value]))
    return `${parts.year.padStart(4,'0')}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
  }
  const displayInstant = instant => `${displayFormat.format(new Date(instant))} (${timezone})`
  function localToUTC(value) {
    const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2})(\.\d{1,3})?)?$/.exec(value)
    if (!match) throw new Error('Enter a complete local date and time.')
    const wall = `${match[1]}:${match[2] || '00'}`
    const naive = Date.parse(`${wall}${match[3] || ''}Z`)
    if (!Number.isFinite(naive) || new Date(naive).toISOString().slice(0,19) !== wall) throw new Error('Enter a valid date and time.')
    // Discover both offsets surrounding a transition instead of guessing the device offset.
    // A venue wall time is valid only when exactly one resulting instant formats back to it.
    const offsets = new Set()
    const anchor = Math.floor(naive / 1000) * 1000
    for (let hours = -48; hours <= 48; hours += 6) {
      const sample = anchor + hours * 3600000
      offsets.add(Date.parse(`${wallAt(sample)}Z`) - sample)
    }
    const candidates = [...offsets].map(offset => naive - offset).filter(candidate => wallAt(candidate) === wall)
    if (!candidates.length) throw new Error(`This time does not exist in ${timezone} because the clocks move forward. Choose a valid time outside the daylight-saving transition.`)
    if (candidates.length !== 1) throw new Error(`This time occurs twice in ${timezone} because the clocks move back. Choose an unambiguous boundary outside the daylight-saving transition.`)
    return new Date(candidates[0]).toISOString()
  }
  const toAPI = input => input.dataset.utc && input.value === input.dataset.initialLocal ? new Date(input.dataset.utc).toISOString() : localToUTC(input.value)
  document.querySelectorAll('time[datetime]').forEach(time => {
    time.textContent = displayFormat.format(new Date(time.dateTime))
    time.title = `${timezone} · ${time.dateTime}`
  })
  document.querySelectorAll('input[data-utc]').forEach(input => {
    if (input.dataset.utc) input.value = wallAt(Date.parse(input.dataset.utc))
    input.dataset.initialLocal = input.value
  })
  document.addEventListener('input', event => {
    if (event.target.matches('input[data-utc], [data-shift]')) event.target.setCustomValidity('')
  })
  document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', event => {
      for (const input of form.querySelectorAll('input[data-utc]')) {
        try { toAPI(input) } catch (error) {
          input.setCustomValidity(error.message)
          input.reportValidity()
          event.preventDefault(); event.stopImmediatePropagation(); return
        }
      }
    }, true)
    form.addEventListener('formdata', event => {
      for (const input of form.querySelectorAll('input[data-utc]')) event.formData.set(input.name,toAPI(input))
    })
  })
  const roster = document.querySelector('[data-roster-form]')
  if (roster) {
    const container = roster.querySelector('[data-shift-rows]')
    const template = container.firstElementChild.cloneNode(true)
    const output = roster.querySelector('[data-shifts-output]')
    // JSON remains available without JavaScript; convenience controls have no submitted names.
    container.querySelectorAll('select').forEach(select => select.required = false)
    roster.querySelector('[data-add-shift]').addEventListener('click', () => {
      const row = template.cloneNode(true)
      row.querySelectorAll('select').forEach(select => select.required = false)
      container.append(row)
      row.querySelector('select').focus()
    })
    container.addEventListener('click', event => {
      if (event.target.closest('[data-remove-shift]')) event.target.closest('.shift-input').remove()
    })
    roster.addEventListener('submit', event => {
      const shifts = []
      for (const row of container.querySelectorAll('.shift-input')) {
        const control = key => row.querySelector(`[data-shift="${key}"]`)
        const value = key => control(key).value.trim()
        if (![value('staffId'),value('start'),value('end'),value('label')].some(Boolean)) continue
        for (const key of ['staffId','start','end']) {
          const input = control(key)
          if (!input.value) {
            input.setCustomValidity('Complete this shift or remove it before preparing the roster.')
            input.reportValidity(); event.preventDefault(); return
          }
        }
        const shift = {staffId:value('staffId'),breakMinutes:Number(value('breakMinutes')),...(value('label') ? {label:value('label')} : {})}
        for (const key of ['start','end']) {
          const input = control(key)
          try { shift[key] = localToUTC(input.value) } catch (error) {
            input.setCustomValidity(error.message)
            input.reportValidity(); event.preventDefault(); return
          }
        }
        shifts.push(shift)
      }
      if (shifts.length) output.value = JSON.stringify(shifts)
      if (!output.value.trim()) { event.preventDefault(); output.focus() }
    })
  }
  const payroll = document.querySelector('[data-payroll-form]')
  if (payroll) payroll.addEventListener('submit', () => {
    payroll.querySelector('[data-payroll-ids]').value = JSON.stringify([...payroll.querySelectorAll('[data-payroll-id]:checked')].map(input => input.dataset.payrollId))
  })
  const clock = document.querySelector('[data-clock]')
  if (!clock) return
  const form = clock.querySelector('[data-clock-form]')
  const retry = clock.querySelector('[data-clock-retry]')
  const message = clock.querySelector('[data-clock-status]')
  const storageKey = `lanyard.clock.outbox.${clock.dataset.actor}`
  let pending = null
  let busy = false
  const show = text => { message.textContent = text }
  const update = () => {
    retry.hidden = !pending
    retry.disabled = busy
    form.querySelector('button').disabled = busy || Boolean(pending)
  }
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved) pending = JSON.parse(saved)
    if (pending && (!['clock.in','clock.out'].includes(pending.name) || typeof pending.input?.commandId !== 'string' || typeof pending.input?.capturedAt !== 'string')) throw new Error('Invalid queue')
    if (pending) show(`Queued ${pending.name === 'clock.in' ? 'clock-in' : 'clock-out'} captured at ${displayInstant(pending.input.capturedAt)}. Retry to submit this same event.`)
  } catch {
    show('The saved clock queue cannot be read. Do not capture a replacement event until browser storage is available.')
    form.querySelector('button').disabled = true
    return
  }
  const clear = () => { localStorage.removeItem(storageKey); pending = null }
  async function send() {
    if (!pending || busy) return
    busy = true; update(); show('Sending captured clock event…')
    let response
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    try {
      response = await fetch('/api/lanyard/command', {method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',signal:controller.signal,body:JSON.stringify(pending)})
    } catch {
      show('Connection failed. Your original clock event is queued on this device; retry when connected.')
      busy = false; update(); return
    } finally { clearTimeout(timeout) }
    let payload
    try { payload = await response.json() } catch { payload = null }
    if (response.ok && payload?.ok === true) {
      try { clear() } catch {
        show('Clock event accepted, but browser storage could not be cleared. Retry is safe with this same command ID.')
        busy = false; update(); return
      }
      show('Clock event saved. Updating…')
      window.location.reload(); return
    }
    const error = typeof payload?.error === 'string' ? payload.error : payload?.error?.message || payload?.message || `Request failed (${response.status}).`
    if (response.status >= 400 && response.status < 500 && ![408,429].includes(response.status)) {
      try { clear() } catch {
        pending = null; busy = false; retry.hidden = true
        form.querySelector('button').disabled = true
        show(`${error} The server rejected this event. Browser storage could not be cleared; clear this device’s saved Lanyard clock event before using the clock again.`)
        return
      }
      show(`${error} This clock event was rejected and is not queued. Reload the page before capturing another event.`)
      busy = false; update(); form.querySelector('button').disabled = true; return
    }
    show(`${error} The original event remains queued; retry safely when available.`)
    busy = false; update()
  }
  form.addEventListener('submit', event => {
    event.preventDefault()
    if (busy || pending) return
    const input = {commandId:crypto.randomUUID(),capturedAt:new Date().toISOString()}
    if (form.dataset.command === 'clock.out') input.breakMinutes = Number(new FormData(form).get('breakMinutes'))
    const eventPayload = {name:form.dataset.command,input}
    try { localStorage.setItem(storageKey,JSON.stringify(eventPayload)) } catch {
      show('Browser storage is unavailable. The clock event was not sent; enable storage before capturing time.')
      return
    }
    pending = eventPayload; update(); send()
  })
  retry.addEventListener('click', send)
  window.addEventListener('online', () => { if(pending) send() })
  update()
})()
