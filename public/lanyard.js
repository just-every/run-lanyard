/* Form conveniences. Application authorization stays on the server. */
(() => {
  document.querySelector('[data-signout]')?.addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true
    try {
      await window.LanyardClock.signOut(button)
    } catch { button.disabled = false; button.textContent = 'Retry sign out' }
  })
  // Shared icon-control tooltip: delayed pointer hover, immediate keyboard focus.
  const tooltip = document.createElement('span')
  tooltip.id = 'control-tooltip'; tooltip.role = 'tooltip'; tooltip.hidden = true
  document.body.append(tooltip)
  let tipTimer, tipTarget
  const hideTip = () => { clearTimeout(tipTimer); tooltip.hidden = true; tipTarget?.removeAttribute('aria-describedby'); tipTarget = null }
  const showTip = target => {
    hideTip(); tipTarget = target; tooltip.textContent = target.dataset.tooltip; tooltip.hidden = false
    target.setAttribute('aria-describedby', tooltip.id)
    const box = target.getBoundingClientRect(), bounds = tooltip.getBoundingClientRect()
    tooltip.style.left = Math.max(8, Math.min(innerWidth - bounds.width - 8, box.left + box.width / 2 - bounds.width / 2)) + 'px'
    tooltip.style.top = Math.min(innerHeight - bounds.height - 8, box.bottom + 6) + 'px'
  }
  document.querySelectorAll('[data-tooltip]').forEach(target => {
    target.addEventListener('mouseenter', () => { tipTimer = setTimeout(() => showTip(target), 300) })
    target.addEventListener('mouseleave', hideTip)
    target.addEventListener('focus', () => showTip(target))
    target.addEventListener('blur', hideTip)
  })
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hideTip() })
  window.addEventListener('scroll', hideTip, true)
  const timezone = document.body.dataset.timezone
  const wallFormat = new Intl.DateTimeFormat('en-GB-u-ca-gregory-nu-latn', {
    timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',
  })
  const wallAt = instant => {
    const parts = Object.fromEntries(wallFormat.formatToParts(new Date(instant)).filter(p => p.type !== 'literal').map(p => [p.type,p.value]))
    return `${parts.year.padStart(4,'0')}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
  }
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
  window.LanyardSchedule?.start({localToUTC})
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
  if (clock) window.LanyardClock.start(clock)
})()
