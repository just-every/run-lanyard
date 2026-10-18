import { check, icons, intro, section } from '../parts'

// 11 · The payroll agent clears six exceptions by name before the noon cutoff,
// Ana sends 64 approved timesheets to Gusto, and Tuesday's readback matches.
const exceptions = [
  { name: 'Marisol Peña', text: 'Barrio Logan · Sun Oct 25 · no clock-out', thread: true, approval: '→ 7:00 am – 3:00 pm · 7.5 hrs · Hector Vega approved 8:20 am' },
  { name: 'Ben Carter', text: 'North Park · Wed Oct 21 · meal premium $19.00 · Ben confirmed · Carmen Ruiz approved 8:31 am' },
  { name: 'Rosa Jimenez', text: 'North Park · Thu Oct 22 · kiosk camera failed at clock-out · exception recorded · Carmen Ruiz approved 8:33 am' },
  { name: 'Tomas Silva', text: 'Ocean Beach · Sat · 1:00 → 3:30 added at 12:41 pm · Kim Tran approved 8:45 am' },
  { name: 'Luis Ortega', text: 'Sat at Ocean Beach · 7.5 hrs · costed to Ocean Beach · Kim Tran approved 8:47 am' },
  { name: 'Jess Morales', text: 'Sat · 7.5 hrs California paid sick leave · balance 16.5 hrs · Ana approved 11:40 am' },
]
const thread = '<div class="thread" lang="es"><p class="bubble bubble-agent"><strong>Agent</strong> 8:04 am · Hola Marisol: el domingo 25 no marcaste la salida en Barrio Logan. ¿A qué hora saliste?</p><p class="bubble bubble-staff"><strong>Marisol 8:12 am</strong> · A las 3:00.</p></div>'
const lines = [['Regular', '2,229.0 hrs'], ['California sick', '7.5 hrs'], ['Overtime', '0.0 hrs'], ['Meal premium', '1 × $19.00'], ['Tips', '$15,286.40'], ['Employees', '64 of 64 matched']]

const agent = `<div class="payroll-left"><p class="clean-bar">58 clean · bulk-approved by Ana 9:30 am ${check()}</p><div class="card agent-card"><p class="agent-head"><strong>Payroll agent</strong> · Mon Oct 26 from 8:00 am · 6 exceptions · cutoff 12:00 pm</p><ol class="exceptions">${exceptions.map(item => `<li><div><p><strong>${item.name}</strong> · ${item.text}</p>${item.thread ? `${thread}<p class="thread-done">${item.approval} ${check()}</p>` : ''}</div>${check('approved')}</li>`).join('')}</ol><p class="agent-foot">64 of 64 approved · Mon Oct 26, 11:40 am</p></div></div>`

const gusto = `<div class="card gusto-card"><p class="gusto-name">Gusto</p><p class="gusto-sent">Sent to Gusto by Ana · Mon Oct 26, 12:05 pm · accepted 12:06 pm</p><table><caption class="sr-only">Sent and read back</caption><thead><tr><th scope="col">Line</th><th scope="col">Sent</th><th scope="col">Read back</th><td></td></tr></thead><tbody>${lines.map(([line, value]) => `<tr><th scope="row">${line}</th><td>${value}</td><td>${value}</td><td>${check('matches')}</td></tr>`).join('')}</tbody></table><div class="gusto-foot"><p><span>Tue Oct 27, 9:00 am · Gusto payroll Oct 19 – 25 · pay date Fri Oct 30</span><strong>2,236.5 hrs + $15,286.40 tips · totals match</strong></p>${icons.checkCircle}</div></div>`

export const payroll = () => section('payroll', 'white', `<div class="site-width">${intro('payroll', 'Payroll · Mon Oct 26 – Tue Oct 27', 'Sent Monday. Matched Tuesday.', 'The payroll agent clears six exceptions before the noon cutoff. Ana sends 64 approved timesheets, and Gusto’s readback matches line for line.', 'intro-center')}<div class="payroll-layout">${agent}<span class="payroll-arrow" aria-hidden="true">→</span>${gusto}</div></div>`)
