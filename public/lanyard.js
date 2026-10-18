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
  // Menus (cafe, account, shift) close when another opens, on Escape and on an outside click.
  const menus = [...document.querySelectorAll('details.menu, details.shift')]
  menus.forEach(menu => menu.addEventListener('toggle', () => { if (menu.open) menus.forEach(other => { if (other !== menu && !other.contains(menu)) other.open = false }) }))
  document.addEventListener('click', event => menus.forEach(menu => { if (menu.open && !menu.contains(event.target)) menu.open = false }))
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') menus.forEach(menu => { menu.open = false })
    const find = document.querySelector('[data-find]')
    if (find && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); find.focus() }
  })
  // Phones show one day of the week; switching days needs no reload.
  const week = document.querySelector('.week[data-show]')
  document.querySelectorAll('.day-picker a[data-show]').forEach(link => link.addEventListener('click', event => {
    if (!week) return
    event.preventDefault()
    week.dataset.show = link.dataset.show
    document.querySelectorAll('.day-picker a').forEach(other => other.toggleAttribute('aria-current', other === link))
    history.replaceState(null, '', link.href)
  }))
  // The open shortlist ends above the labor footer: it rises no higher than just under the
  // shifts in the call-out's row, and only a week too short for it makes room above the footer.
  const cover = week?.querySelector('.cover')
  const fitCover = () => {
    if (!cover) return
    cover.style.translate = ''; week.style.removeProperty('--cover-room')
    if (getComputedStyle(cover).position !== 'absolute') return
    const foot = week.querySelector('.foot .wk-cell'), row = [...cover.parentElement.parentElement.querySelectorAll('.wk-cell.day:not(.has-cover) .shift')]
    const box = cover.getBoundingClientRect(), limit = foot ? foot.getBoundingClientRect().top - 8 : week.getBoundingClientRect().bottom - 8
    const over = box.bottom - limit
    if (over <= 0) return
    const rise = Math.max(0, Math.min(over, box.top - Math.max(week.querySelector('.head .wk-cell')?.getBoundingClientRect().bottom ?? 0, ...row.map(x => x.getBoundingClientRect().bottom)) - 6))
    if (rise) cover.style.translate = `0 ${-rise}px`
    if (over > rise && foot) week.style.setProperty('--cover-room', `${Math.ceil(over - rise)}px`)
  }
  fitCover()
  document.fonts?.ready.then(fitCover)
  window.addEventListener('resize', fitCover)
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
  // Shift rows are convenience controls with no submitted names: on submit they become the
  // hidden `shifts` field (UTC instants), the same input agents send to roster.prepare.
  const roster = document.querySelector('[data-roster-form]')
  if (roster) {
    const container = roster.querySelector('[data-shift-rows]')
    const current = roster.querySelector('[data-current-rows]')
    const template = container.firstElementChild.cloneNode(true)
    const output = roster.querySelector('[data-shifts-output]')
    roster.querySelector('[data-add-shift]').addEventListener('click', () => {
      const row = template.cloneNode(true)
      container.append(row)
      row.querySelector('select').focus()
    })
    roster.addEventListener('click', event => {
      if (event.target.closest('[data-remove-shift]')) event.target.closest('.shift-input').remove()
    })
    const refuse = (input, message, event) => { input.setCustomValidity(message); input.reportValidity(); event.preventDefault() }
    roster.addEventListener('submit', event => {
      const shifts = []
      // New rows join the week's current shifts unless the manager chose to replace them.
      const keep = roster.querySelector('[data-keep]')
      const rows = [...container.querySelectorAll('.shift-input'), ...(current && keep?.checked ? current.querySelectorAll('.shift-input') : [])]
      for (const row of rows) {
        const control = key => row.querySelector(`[data-shift="${key}"]`)
        const value = key => control(key).value.trim()
        if (![value('staffId'),value('start'),value('end'),value('label')].some(Boolean)) continue
        for (const key of ['staffId','start','end']) {
          const input = control(key)
          if (!input.value) {
            if (input.closest('details')) input.closest('details').open = true
            return refuse(input, 'Complete this shift or remove it before preparing the draft.', event)
          }
        }
        const site = control('site') ? value('site') : ''
        const shift = {staffId:value('staffId'),breakMinutes:Number(value('breakMinutes')),...(value('label') ? {label:value('label')} : {}),...(site ? {site} : {})}
        for (const key of ['start','end']) {
          const input = control(key)
          try { shift[key] = localToUTC(input.value) } catch (error) {
            if (input.closest('details')) input.closest('details').open = true
            return refuse(input, error.message, event)
          }
        }
        shifts.push(shift)
      }
      if (!shifts.length) return refuse(container.querySelector('[data-shift="staffId"]') || roster.querySelector('[data-add-shift]'), 'Add at least one shift.', event)
      output.value = JSON.stringify(shifts)
    })
  }
  // The pay-week checkboxes choose the timesheets; the hidden `ids` field carries them.
  const payroll = document.querySelector('[data-payroll-form]')
  if (payroll) {
    const boxes = [...payroll.querySelectorAll('[data-payroll-id]')]
    const ids = payroll.querySelector('[data-payroll-ids]')
    const write = () => { ids.value = JSON.stringify(boxes.filter(box => box.checked).flatMap(box => box.dataset.payrollId.split(','))); boxes[0]?.setCustomValidity('') }
    boxes.forEach(box => { box.disabled = false; box.addEventListener('change', write) })
    write()
    payroll.addEventListener('submit', event => {
      write()
      if (!boxes.some(box => box.checked)) { boxes[0].setCustomValidity('Choose at least one row to include.'); boxes[0].reportValidity(); event.preventDefault() }
    })
  }
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
