/* Responsive native-session workflows. Only clock captures have a durable outbox. */
(() => {
  if (!['schedule', 'time'].includes(document.querySelector('main')?.dataset.page)) return
  const focusNotice = document.querySelector('.notice[role]')
  if (focusNotice) { focusNotice.tabIndex = -1; focusNotice.focus() }
  const feedback = (form, text, review = false) => {
    let note = form.querySelector('[data-save-feedback]')
    if (!note) {
      note = document.createElement('p'); note.dataset.saveFeedback = ''; note.className = 'note'
      note.tabIndex = -1; note.setAttribute('role', 'status'); note.setAttribute('aria-live', 'polite')
      form.append(note)
    }
    note.replaceChildren(document.createTextNode(text))
    if (review) {
      const link = document.createElement('a'); link.className = 'text-link'
      link.href = new URL(form.action).searchParams.get('returnTo') || location.href
      link.textContent = 'Review current records'
      note.append(document.createTextNode(' '), link)
    }
    return note
  }
  document.addEventListener('submit', async event => {
    const form = event.target, action = new URL(form.action, location.href)
    if (event.defaultPrevented || form.method !== 'post' || action.origin !== location.origin || action.pathname !== '/app/action') return
    event.preventDefault()
    document.querySelectorAll('.notice[role]').forEach(note => note.remove())
    if (form.dataset.saveState === 'pending' || form.dataset.saveState === 'unknown') return
    if (!navigator.onLine) {
      form.dataset.saveState = 'unsent'
      feedback(form, 'Offline. Not sent. Your entries stay on this page; reconnect and submit again.').focus()
      return
    }
    const fields = new FormData(form, event.submitter)
    const body = form.enctype === 'multipart/form-data' ? fields : new URLSearchParams([...fields].map(([key, value]) => [key, String(value)]))
    const buttons = [...form.querySelectorAll('button[type=submit]')]
    form.dataset.saveState = 'pending'; form.setAttribute('aria-busy', 'true')
    buttons.forEach(button => { button.disabled = true })
    feedback(form, 'Saving. Keep this page open until the result is confirmed.')
    let confirmed = false
    try {
      const response = await fetch(action, {method:'POST', body, credentials:'same-origin', cache:'no-store', signal:AbortSignal.timeout(15000)})
      if (response.redirected) { location.assign(response.url); return }
      if (!response.headers.get('content-type')?.includes('text/html')) {
        location.assign(action.searchParams.get('returnTo') || '/app/schedule'); return
      }
      const html = await response.text(), result = new DOMParser().parseFromString(html, 'text/html')
      const error = result.querySelector('.notice.error')
      confirmed = true
      if (error) {
        form.dataset.saveState = 'refused'
        feedback(form, error.textContent, true).focus()
        return
      }
      // Keep the server-rendered result, including bulk skips and current revisions.
      // No mutation is retried automatically, and nothing is copied into local storage.
      history.replaceState(null, '', action.searchParams.get('returnTo') || location.href)
      document.open(); document.write(html); document.close()
    } catch {
      form.dataset.saveState = 'unknown'
      feedback(form, 'Save not confirmed. Your entries remain here. Review current records before another attempt; this change may have reached the server.', true).focus()
    } finally {
      if (form.isConnected) {
        form.removeAttribute('aria-busy')
        if (confirmed) { buttons.forEach(button => { button.disabled = false }); delete form.dataset.saveState }
      }
    }
  })
  document.addEventListener('click', async event => {
    const link = event.target.closest('[data-attendance-refresh]')
    if (!link) return
    event.preventDefault()
    const board = link.closest('#attendance'), note = board.querySelector('[data-attendance-status]')
    if (board.getAttribute('aria-busy') === 'true') return
    board.setAttribute('aria-busy', 'true'); note.textContent = 'Updating attendance…'
    try {
      const response = await fetch(link.href, {credentials:'same-origin', cache:'no-store', signal:AbortSignal.timeout(15000)})
      if (response.redirected) { location.assign(response.url); return }
      if (!response.ok) throw new Error('Attendance unavailable')
      const result = new DOMParser().parseFromString(await response.text(), 'text/html').querySelector('#attendance')
      if (!result) { location.assign(link.href); return }
      board.replaceWith(result)
      result.querySelector('[data-attendance-status]').focus()
    } catch {
      note.textContent = 'Attendance could not be updated. The last received view is still shown. Reconnect and refresh.'
      note.focus()
    } finally { board.removeAttribute('aria-busy') }
  })
})()
