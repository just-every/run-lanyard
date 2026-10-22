/* An authorized manager may explicitly report retained device captures for review.
 * Recovery never replays a clock command or exposes another actor's capture details. */
(() => {
  const {role,actor} = document.body.dataset
  if (!['owner','manager'].includes(role) || !actor) return
  const revokedKiosks=new Set(JSON.parse(document.body.dataset.revokedKiosks||'[]'))
  const inactiveStaff = new Set(JSON.parse(document.body.dataset.inactiveStaff))
  const main = document.querySelector('main'), clock = window.LanyardClock
  if (!main || !clock?.withState || !clock?.databaseName) return

  const card = document.createElement('section'), heading = document.createElement('h2')
  const notice = document.createElement('p'), status = document.createElement('p'), submit = document.createElement('button')
  card.className = 'card'; card.dataset.clockRecovery = ''; card.hidden = true
  heading.textContent = 'Unsynced punches from a revoked session'
  notice.className = 'note'; notice.dataset.clockRecoveryCount = ''
  status.className = 'note'; status.setAttribute('role','status'); status.setAttribute('aria-live','polite')
  Object.assign(submit,{type:'button',className:'secondary',textContent:'Submit unsynced punches for review'})
  submit.dataset.clockRecover = ''
  card.append(heading,notice,submit,status); main.prepend(card)
  let busy = false, count = null
  const publicError = message => Object.assign(new Error(message), {publicRecoveryMessage:message})

  async function databases() {
    if (typeof indexedDB.databases !== 'function') throw new Error('This browser cannot list saved device punches for review.')
    const prefix = clock.databaseName(''), own = clock.databaseName(actor)
    return (await indexedDB.databases()).map(database => database.name).filter(name => typeof name === 'string' && name.startsWith(prefix) && name !== own && name.length > prefix.length).sort().map(name => name.slice(prefix.length))
  }
  const remaining = state => (state.revoked === true || inactiveStaff.has(state.owner?.staffId) || state.client==='kiosk'&&revokedKiosks.has(state.deviceId)) ? state.events.filter(event => !event.recovered) : []
  function render(message = '', hasError = false) {
    card.hidden = !count && !message
    notice.textContent = count === null ? 'The saved punch count is unavailable.' : `${count} unsynced ${count === 1 ? 'punch' : 'punches'} from a revoked session on this device.`
    submit.hidden = !count; submit.disabled = busy
    status.textContent = message
    status.setAttribute('aria-live',hasError ? 'assertive' : 'polite')
  }
  async function recount() {
    const actors = await databases()
    const counts = await Promise.allSettled(actors.map(savedActor => clock.withState(savedActor, null, state => remaining(state).length)))
    if (counts.some(result => result.status === 'rejected')) { count = null; throw new Error('Saved punch count unavailable') }
    count = counts.reduce((total, result) => total + result.value, 0)
  }
  async function recover(savedActor, event) {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 20000)
    try {
      const response = await fetch('/api/lanyard/command', {
        method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},signal:controller.signal,
        body:JSON.stringify({name:'clock.recover',input:{
          commandId:event.recoveryId,capture:event.capture,actorId:event.originalActorId||savedActor,
          error:event.error || 'Device-reported unsynced capture from a revoked session',
        }}),
      })
      // Server errors can name people or include capture facts. Keep this shared-device
      // notice count-only, including when the current manager lacks the required cafe scope.
      if (!response.ok) throw publicError(`The server refused the review submission (HTTP ${response.status}). Saved punches remain on this device.`)
      let payload
      try { payload = await response.json() } catch { throw publicError('The server response could not confirm the review submission. Saved punches remain on this device; retry uses the same report ID.') }
      if (payload?.ok !== true) throw publicError('The server did not confirm the review submission. Saved punches remain on this device.')
    } catch (error) {
      if (error instanceof TypeError || error.name === 'AbortError') throw publicError('The connection failed before review could be confirmed. Saved punches remain on this device; retry uses the same report ID.')
      throw error
    } finally { clearTimeout(timeout) }
  }
  submit.addEventListener('click', async () => {
    if (busy) return
    busy = true; render('Submitting saved punches for manager review…')
    let message = '', failed = false
    try {
      for (const savedActor of await databases()) {
        await clock.withState(savedActor, null, async (state, save) => {
          for (const event of remaining(state)) {
            if (!event.recoveryId) { event.recoveryId = crypto.randomUUID(); await save() }
            await recover(savedActor, {...event,originalActorId:state.client==='kiosk'?state.owner?.actorId:undefined})
            state.revoked = true
            event.recovered = true; event.reported = true; event.status = 'rejected'
            event.error ||= 'Submitted for manager review after access was revoked. This original will not be replayed.'
            await save()
          }
        })
      }
      message = 'Saved punches were submitted for review. Their encrypted originals remain on this device. No punches were automatically applied.'
    } catch (error) {
      failed = true
      // Only recover() creates safe public errors. Storage exceptions are intentionally
      // replaced below so actor identifiers and encrypted queue internals never reach UI.
      message = error.publicRecoveryMessage || 'Review submission could not be completed. Saved punches remain on this device; retry when storage and your authorized session are available.'
    }
    try { await recount() } catch {
      failed = true; count = null
      message = 'Saved punches could not be counted. Their encrypted originals remain on this device. Reload before trying again.'
    }
    busy = false; render(message, failed)
  })

  recount().then(() => render()).catch(() => render('Saved device punches could not be checked. Reload when browser storage is available.', true))
})()
